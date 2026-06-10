import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CssEmitter,
  defaultRegistry,
  mergeConfig,
  parseCassConfig,
  type CompiledRule,
  type CassConfig,
  type CassPlugin,
  type Registry,
  type ResolvedCassConfig,
} from '@cassida/compiler';
import { postProcessLightningCss, resolveTargets, type Targets } from '@cassida/compiler/internal';
import {
  createModuleCache,
  loadTsconfigPaths,
  transform,
  type CassParserPlugin,
  type PathAliases,
} from '@cassida/parser';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * One virtual CSS module per source file, keyed by the file's resolved id.
 * The plugin injects an `import "virtual:cassida.css?file=<encoded id>"` at the
 * top of every transformed JSX file, so the CSS for that file is loaded
 * by Rollup *after* its transform completes — which sidesteps the load /
 * transform race that a single shared virtual module suffers in build mode.
 */
const VIRTUAL_PREFIX = 'virtual:cassida.css?file=';
const RESOLVED_PREFIX = '\0' + VIRTUAL_PREFIX;
const CONFIG_FILENAME = 'cassida.config.json';

/**
 * Plugin options exposed to `vite.config.ts`. Anything declared in
 * `CassConfig` (the JSON-serializable shape) can also live in a
 * `cassida.config.json` at the project root; plugin options take precedence
 * over the file. `registry` and `include` are runtime-only and have no
 * file-config equivalent.
 */
export interface CassPluginOptions extends CassConfig {
  readonly registry?: Registry;
  readonly include?: RegExp;
  /**
   * Build-time FSS plugins (e.g. `@cassida/plugin-hover-fix`). Each
   * plugin receives the post-collapse `ScopeBag` tree and returns a
   * new one; the className is derived from the post-plugin form. So
   * enabling or disabling a plugin will change every affected hash —
   * caches invalidate cleanly.
   *
   * Plugins are not config-file serializable (they're functions), so
   * this option lives on the inline plugin options only.
   */
  readonly plugins?: readonly CassPlugin[];
  /**
   * AST-level parser plugins. Run earlier than the CSS-level
   * `plugins` above: each plugin gets a chance to handle JSX
   * spreads the default chain walk doesn't recognize (e.g.
   * conditional spreads, custom DSL shapes). See
   * `@cassida/parser`'s `CassParserPlugin` interface for the shape.
   *
   * Like CSS plugins, these are inline-only (function values are
   * not serializable to `cassida.config.json`).
   */
  readonly parserPlugins?: readonly CassParserPlugin[];
  /**
   * TypeScript-style path aliases for the cross-file evaluator. By
   * default the plugin auto-discovers `compilerOptions.paths` from
   * `tsconfig.json` at the project root (via
   * `loadTsconfigPaths(projectRoot)`). Pass an explicit map to override,
   * or `false` to disable auto-discovery — useful when the project
   * uses Vite's own `resolve.alias` instead of tsconfig paths.
   */
  readonly pathAliases?: PathAliases | false;
}

export default function cassida(options: CassPluginOptions = {}): Plugin {
  const include = options.include ?? /\.[jt]sx$/;
  const registry = options.registry ?? defaultRegistry;

  // Filled in `configResolved`; until then we use the in-memory defaults
  // so unit-test usages without a Vite config still work.
  let resolved: ResolvedCassConfig = mergeConfig(extractConfig(options));

  const rulesByFile = new Map<string, readonly CompiledRule[]>();
  let server: ViteDevServer | undefined;
  // lightningcss `Targets` are derived once per plugin instance from
  // either the explicit config string or auto-discovered browserslist
  // queries. `null` means "no targets passed → lightningcss default".
  let cachedTargets: Targets | null = null;
  let projectRoot = process.cwd();
  // Shared cross-file module cache, scoped to the plugin instance
  // (and therefore the build). Without this, every consumer file's
  // `transform()` call would re-read and re-parse `theme.ts` etc.;
  // with it, each design-token module is parsed once per build.
  const crossFileCache = createModuleCache();
  // Resolved in `configResolved` once `projectRoot` is known. Null
  // when the user disabled auto-discovery or no tsconfig.json was
  // found at the project root.
  let resolvedAliases: PathAliases | null = null;

  function emitForFile(file: string): string {
    const rules = rulesByFile.get(file);
    if (!rules || rules.length === 0) return '';
    const emitter = new CssEmitter({
      layer: resolved.layer,
      mediaSort: resolved.media.sort,
    });
    for (const r of rules) emitter.add(r);
    const css = emitter.emit();
    if (!resolved.css.lightningcss.enabled || css === '') return css;
    return postProcessLightningCss(css, file, resolved, cachedTargets);
  }

  function virtualIdFor(file: string): string {
    return VIRTUAL_PREFIX + encodeURIComponent(file);
  }

  function invalidateVirtualForFile(file: string) {
    if (!server) return;
    const resolvedId = '\0' + virtualIdFor(file);
    const mod = server.moduleGraph.getModuleById(resolvedId);
    if (!mod) return;
    server.moduleGraph.invalidateModule(mod);
    const path = virtualIdFor(file);
    server.ws.send({
      type: 'update',
      updates: [
        {
          type: 'js-update',
          path,
          acceptedPath: path,
          timestamp: Date.now(),
        },
      ],
    });
  }

  return {
    name: 'cassida',
    enforce: 'pre',

    configResolved(viteConfig) {
      projectRoot = viteConfig.root;
      const fileCfg = loadFileConfig(projectRoot);
      // Resolution priority: defaults < cassida.config.json < plugin options.
      resolved = mergeConfig(fileCfg, extractConfig(options));
      cachedTargets = resolveTargets(resolved.css.lightningcss.targets, projectRoot);
      // Path aliases: explicit > auto-discovery > none. `false` opts
      // out of both, leaving cross-file eval relative-only.
      if (options.pathAliases === false) {
        resolvedAliases = null;
      } else if (options.pathAliases) {
        resolvedAliases = options.pathAliases;
      } else {
        resolvedAliases = loadTsconfigPaths(projectRoot);
      }
    },

    configureServer(s) {
      server = s;
    },

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return '\0' + id;
      return null;
    },

    load(id) {
      if (id.startsWith(RESOLVED_PREFIX)) {
        const file = decodeURIComponent(id.slice(RESOLVED_PREFIX.length));
        return emitForFile(file);
      }
      return null;
    },

    transform(code, id) {
      const cleanId = id.split('?')[0] ?? id;
      if (!include.test(cleanId)) return null;
      if (!code.includes(resolved.importSource)) return null;

      const result = transform(code, {
        registry,
        filename: cleanId,
        importSource: resolved.importSource,
        shorthandPolicy: resolved.shorthand.policy,
        crossFileEvaluation: { cache: crossFileCache },
        ...(resolvedAliases ? { pathAliases: resolvedAliases } : {}),
        ...(options.plugins ? { plugins: options.plugins } : {}),
        ...(options.parserPlugins
          ? { parserPlugins: options.parserPlugins }
          : {}),
      });

      if (!result.transformed) {
        if (rulesByFile.delete(cleanId)) invalidateVirtualForFile(cleanId);
        return null;
      }

      rulesByFile.set(cleanId, result.rules);
      invalidateVirtualForFile(cleanId);

      const importStmt = `import ${JSON.stringify(virtualIdFor(cleanId))};\n`;
      return {
        code: importStmt + result.code,
        // Babel's source map shape conforms to Rollup's SourceMapInput
        // structurally, but rollup's types aren't a direct dep here so
        // we type-launder to `never` (the bottom type, assignable to
        // anything). This is a known idiom for Vite plugin map fields.
        map: result.map as never,
      };
    },
  };
}

/**
 * Extract the JSON-friendly config slice from plugin options and run
 * it through the same Zod validator as `cassida.config.json`. Drops
 * runtime-only fields (`registry`, `include`) so the result can be
 * fed cleanly into `mergeConfig`. Inline options receive the same
 * validation guarantees as the file: typos and out-of-range values
 * surface as a single error at plugin construction time.
 */
function extractConfig(options: CassPluginOptions): CassConfig | undefined {
  const { registry, include, plugins, parserPlugins, ...cfg } = options;
  void registry;
  void parserPlugins;
  void include;
  void plugins;
  if (Object.keys(cfg).length === 0) return undefined;
  return parseCassConfig(cfg, '<vite.config.ts plugin options>');
}

function loadFileConfig(root: string): CassConfig | undefined {
  const path = resolve(root, CONFIG_FILENAME);
  if (!existsSync(path)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (e) {
    throw new Error(
      `[cassida] failed to read ${path}: ${(e as Error).message}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `[cassida] failed to parse ${path}: ${(e as Error).message}`,
    );
  }
  // Zod-validated at the I/O boundary — typos in the file surface as
  // build-time errors with a precise field path.
  return parseCassConfig(json, path);
}
