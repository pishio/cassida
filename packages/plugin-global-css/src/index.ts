import type { Plugin } from 'vite';

/**
 * Options for `cassidaGlobalCss`.
 */
export interface GlobalCssOptions {
  /**
   * The raw CSS to serve. The plugin does not parse or transform it —
   * it is passed through to Vite's CSS pipeline as-is, then wrapped in
   * an `@layer` block when `layer` is non-null.
   */
  readonly css: string;
  /**
   * Cascade layer to wrap the CSS in. Defaults to `'base'` so that the
   * canonical `@layer base, cas;` declaration order in the consuming
   * app lets ordinary Cassida classes (which live in `@layer cas`) win
   * without specificity tricks. Pass `null` to skip the wrap entirely
   * — the CSS is then emitted at the document-default layer and ranks
   * above any layered rules, which is rarely what you want.
   *
   * The CSS spec only accepts a single `<layer-name>` here — one ident,
   * optionally dot-separated (`base`, `framework.preflight`). A
   * comma-separated list (`base, cas`) is the *declaration* form, not
   * the *block* form, and would produce invalid CSS. The plugin
   * validates this at construction.
   */
  readonly layer?: string | null;
  /**
   * Virtual module id to expose. Defaults to `'virtual:cassida-global.css'`.
   * Override only if you need multiple global stylesheets in the same
   * app (each must have a distinct id).
   */
  readonly virtualId?: string;
}

const DEFAULT_VIRTUAL_ID = 'virtual:cassida-global.css';

/**
 * CSS `<layer-name>` accepts one ident token, optionally dot-separated.
 * Matches the grammar from css-cascade-5 §4.1 closely enough to catch
 * the realistic mistake (`'base, extra'`, `'base extra'`) without
 * pretending to be a full CSS tokenizer. Errors here are config bugs
 * caught at plugin construction, not silent miscompiles at runtime.
 */
const LAYER_NAME_RE = /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/;

/**
 * Global / tag-selector CSS injection for Cassida projects.
 *
 * Cassida's chains always emit a single class per element — there is
 * no built-in escape hatch for `body { ... }` or `*, ::before, ::after`
 * style rules. This plugin fills that gap by exposing a virtual CSS
 * module that Vite bundles like any other stylesheet.
 *
 *   ```ts
 *   // vite.config.ts
 *   import { defineConfig } from 'vite';
 *   import { cassida } from '@cassida/vite-plugin';
 *   import { cassidaGlobalCss } from '@cassida/plugin-global-css';
 *   import { recommended } from '@cassida/recommended';
 *   import preflight from './preflight.css?raw';
 *
 *   export default defineConfig({
 *     plugins: [
 *       cassida(recommended()),
 *       cassidaGlobalCss({ css: preflight, layer: 'base' }),
 *     ],
 *   });
 *   ```
 *
 *   ```ts
 *   // main.tsx
 *   import 'virtual:cassida-global.css';
 *   ```
 *
 * The default `@layer base` wrap pairs with the recommended cascade
 * declaration `@layer base, cas;` so Cassida's single-class rules
 * always beat preflight without resorting to `!important` or
 * specificity bumps. Set `layer: null` to opt out of the wrap.
 */
export function cassidaGlobalCss(options: GlobalCssOptions): Plugin {
  const virtualId = options.virtualId ?? DEFAULT_VIRTUAL_ID;
  // Vite convention: prefix resolved virtual ids with `\0` to opt out
  // of normal module resolution and signal "this is synthesized".
  const resolvedVirtualId = '\0' + virtualId;
  // `layer === undefined` -> default to 'base'; `layer === null` -> no wrap.
  const layer = options.layer === undefined ? 'base' : options.layer;
  if (layer !== null && !LAYER_NAME_RE.test(layer)) {
    throw new Error(
      `[cassida-global-css] invalid \`layer\` option ${JSON.stringify(layer)}. ` +
        `CSS \`@layer name { ... }\` accepts a single ident (optionally dot-separated). ` +
        `Pass \`null\` to skip the wrap.`,
    );
  }
  const payload =
    layer === null ? options.css : `@layer ${layer} {\n${options.css}\n}`;

  return {
    name: 'cassida-global-css',
    resolveId(id) {
      // Vite frequently appends query parameters (`?inline`, `?url`,
      // HMR timestamps) to the import specifier. Match the bare id and
      // any query-suffixed variant; pass the suffix through to `load`
      // so downstream behavior (e.g. `?inline`) is preserved.
      if (id === virtualId || id.startsWith(virtualId + '?')) {
        return '\0' + id;
      }
      return null;
    },
    load(id) {
      if (
        id === resolvedVirtualId ||
        id.startsWith(resolvedVirtualId + '?')
      ) {
        return payload;
      }
      return null;
    },
  };
}
