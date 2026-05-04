import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import browserslist from 'browserslist';
import { browserslistToTargets, transform as lightningTransform } from 'lightningcss';
import type { Targets } from 'lightningcss';
import {
  CssEmitter,
  defaultRegistry,
  mergeConfig,
  parseFssConfig,
  type CompiledRule,
  type FssConfig,
  type Registry,
  type ResolvedFssConfig,
} from '@fss/compiler';
import { transform } from '@fss/parser';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * One virtual CSS module per source file, keyed by the file's resolved id.
 * The plugin injects an `import "virtual:fss.css?file=<encoded id>"` at the
 * top of every transformed JSX file, so the CSS for that file is loaded
 * by Rollup *after* its transform completes — which sidesteps the load /
 * transform race that a single shared virtual module suffers in build mode.
 */
const VIRTUAL_PREFIX = 'virtual:fss.css?file=';
const RESOLVED_PREFIX = '\0' + VIRTUAL_PREFIX;
const CONFIG_FILENAME = 'fss.config.json';

/**
 * Plugin options exposed to `vite.config.ts`. Anything declared in
 * `FssConfig` (the JSON-serializable shape) can also live in a
 * `fss.config.json` at the project root; plugin options take precedence
 * over the file. `registry` and `include` are runtime-only and have no
 * file-config equivalent.
 */
export interface FssPluginOptions extends FssConfig {
  readonly registry?: Registry;
  readonly include?: RegExp;
}

export default function fss(options: FssPluginOptions = {}): Plugin {
  const include = options.include ?? /\.[jt]sx$/;
  const registry = options.registry ?? defaultRegistry;

  // Filled in `configResolved`; until then we use the in-memory defaults
  // so unit-test usages without a Vite config still work.
  let resolved: ResolvedFssConfig = mergeConfig(extractConfig(options));

  const rulesByFile = new Map<string, readonly CompiledRule[]>();
  let server: ViteDevServer | undefined;
  // lightningcss `Targets` are derived once per plugin instance from
  // either the explicit config string or auto-discovered browserslist
  // queries. `null` means "no targets passed → lightningcss default".
  let cachedTargets: Targets | null = null;
  let projectRoot = process.cwd();

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
    name: 'fss',
    enforce: 'pre',

    configResolved(viteConfig) {
      projectRoot = viteConfig.root;
      const fileCfg = loadFileConfig(projectRoot);
      // Resolution priority: defaults < fss.config.json < plugin options.
      resolved = mergeConfig(fileCfg, extractConfig(options));
      cachedTargets = resolveTargets(resolved.css.lightningcss.targets, projectRoot);
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
 * it through the same Zod validator as `fss.config.json`. Drops
 * runtime-only fields (`registry`, `include`) so the result can be
 * fed cleanly into `mergeConfig`. Inline options receive the same
 * validation guarantees as the file: typos and out-of-range values
 * surface as a single error at plugin construction time.
 */
function extractConfig(options: FssPluginOptions): FssConfig | undefined {
  const { registry, include, ...cfg } = options;
  void registry;
  void include;
  if (Object.keys(cfg).length === 0) return undefined;
  return parseFssConfig(cfg, '<vite.config.ts plugin options>');
}

/**
 * Run the emitter's CSS string through lightningcss for autoprefixing,
 * minification (when `minify: true`), and target-aware downleveling.
 *
 * `@property` rules are preserved through this pass — lightningcss
 * supports the Houdini descriptor natively. We additionally split the
 * input so emitter-emitted property declarations are processed in the
 * same pass as the `@layer` block; they share a single document.
 */
function postProcessLightningCss(
  css: string,
  filename: string,
  resolved: ResolvedFssConfig,
  targets: Targets | null,
): string {
  const result = lightningTransform({
    filename,
    code: Buffer.from(css, 'utf-8'),
    minify: resolved.css.lightningcss.minify,
    ...(targets ? { targets } : {}),
  });
  return Buffer.from(result.code).toString('utf-8');
}

/**
 * Resolve a `Targets` object from the user's config, or fall back to
 * auto-discovering a browserslist query from the project root
 * (`.browserslistrc`, `package.json#browserslist`, or environment
 * defaults). Returning `null` lets lightningcss apply its own default.
 *
 * The `'defaults'` literal in `defaultConfig` is treated as "no
 * explicit override given, please auto-discover" — only when the user
 * actually puts a different string in the config (or the auto-
 * discovery picks up a project file) do we set explicit targets.
 */
function resolveTargets(configTargets: string, root: string): Targets | null {
  // `'defaults'` is the synthetic placeholder coming from the resolved
  // config defaults; treat it as "no explicit user choice" and let
  // browserslist read project files first.
  if (configTargets !== 'defaults') {
    const queries = browserslist(configTargets);
    return browserslistToTargets(queries);
  }
  try {
    const queries = browserslist(undefined, { path: root });
    if (queries.length === 0) return null;
    return browserslistToTargets(queries);
  } catch {
    // No project browserslist + no explicit env defaults — let
    // lightningcss decide.
    return null;
  }
}

function loadFileConfig(root: string): FssConfig | undefined {
  const path = resolve(root, CONFIG_FILENAME);
  if (!existsSync(path)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (e) {
    throw new Error(
      `[fss] failed to read ${path}: ${(e as Error).message}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `[fss] failed to parse ${path}: ${(e as Error).message}`,
    );
  }
  // Zod-validated at the I/O boundary — typos in the file surface as
  // build-time errors with a precise field path.
  return parseFssConfig(json, path);
}
