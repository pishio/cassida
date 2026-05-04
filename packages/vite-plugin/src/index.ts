import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  function emitForFile(file: string): string {
    const rules = rulesByFile.get(file);
    if (!rules || rules.length === 0) return '';
    const emitter = new CssEmitter({
      layer: resolved.layer,
      mediaSort: resolved.media.sort,
    });
    for (const r of rules) emitter.add(r);
    return emitter.emit();
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
      const fileCfg = loadFileConfig(viteConfig.root);
      // Resolution priority: defaults < fss.config.json < plugin options.
      resolved = mergeConfig(fileCfg, extractConfig(options));
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
