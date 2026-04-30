import {
  CssEmitter,
  defaultRegistry,
  type CompiledRule,
  type Registry,
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

export interface FssPluginOptions {
  readonly registry?: Registry;
  /**
   * File-name pattern for the JSX/TSX inputs to transform.
   * Defaults to `/\.[jt]sx$/`.
   */
  readonly include?: RegExp;
  /**
   * `@layer` name for the wrapping cascade layer. Set to `null` to emit
   * bare rules.
   */
  readonly layer?: string | null;
  /**
   * Module specifier to recognize as the source of `fss`. Defaults to
   * `@fss/core`.
   */
  readonly importSource?: string;
}

export default function fss(options: FssPluginOptions = {}): Plugin {
  const include = options.include ?? /\.[jt]sx$/;
  const registry = options.registry ?? defaultRegistry;
  const importSource = options.importSource ?? '@fss/core';

  const rulesByFile = new Map<string, readonly CompiledRule[]>();
  let server: ViteDevServer | undefined;

  function emitForFile(file: string): string {
    const rules = rulesByFile.get(file);
    if (!rules || rules.length === 0) return '';
    const emitterOpts =
      options.layer !== undefined ? { layer: options.layer } : {};
    const emitter = new CssEmitter(emitterOpts);
    for (const r of rules) emitter.add(r);
    return emitter.emit();
  }

  function virtualIdFor(file: string): string {
    return VIRTUAL_PREFIX + encodeURIComponent(file);
  }

  function invalidateVirtualForFile(file: string) {
    if (!server) return;
    const resolved = '\0' + virtualIdFor(file);
    const mod = server.moduleGraph.getModuleById(resolved);
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
      if (!code.includes(importSource)) return null;

      const result = transform(code, {
        registry,
        filename: cleanId,
        importSource,
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
        map: result.map as never,
      };
    },
  };
}
