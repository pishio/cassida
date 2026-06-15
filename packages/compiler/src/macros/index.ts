import type { CassPlugin } from '../plugin.js';
import { defaultMacros, zIndexMacro, transformMacro, positionStickyMacro } from './builtins.js';
import { defineMacro, MACRO_NAME_PREFIX } from './define-macro.js';
import { CSS_GLOBAL_KEYWORDS } from './macro-types.js';
import type { CssGlobalKeyword, MacroDefinition } from './macro-types.js';

export type { CssGlobalKeyword, MacroDefinition };
export {
  defineMacro,
  defaultMacros,
  CSS_GLOBAL_KEYWORDS,
  zIndexMacro,
  transformMacro,
  positionStickyMacro,
};

/**
 * Strip the runtime `macro:` prefix back off a `CassPlugin.name` so it
 * lines up with the bare names users write in `config.macros.disable`.
 * Macros not produced by `defineMacro` (custom user plugins) flow
 * through unchanged.
 */
function bareMacroName(prefixed: string): string {
  return prefixed.startsWith(MACRO_NAME_PREFIX)
    ? prefixed.slice(MACRO_NAME_PREFIX.length)
    : prefixed;
}

/**
 * Env var that silences the macros.disable typo warning. Used the same
 * way `CASSIDA_QUIET_RACE_WARNING` silences the cross-compiler bridge
 * race warning emitted by `CassidaWebpackPlugin` (see
 * `packages/next-plugin/src/webpack-plugin.ts`).
 */
const CASSIDA_QUIET_MACRO_TYPO_WARNING = 'CASSIDA_QUIET_MACRO_TYPO_WARNING';

/**
 * Resolve the macros that should run for this compile. Built-in
 * macros listed in `disabled` are removed; the remainder is returned
 * in `defaultMacros` order. The returned array is `Object.freeze`d
 * so the result is non-mutable regardless of whether the `disabled`
 * input was empty (`defaultMacros` is itself frozen) or non-empty
 * (newly allocated filter result). Consumers that need a mutable
 * copy should clone explicitly.
 *
 * `config.macros.disable` targets built-in macros only — custom
 * macros (registered through the inline plugin option) are filtered
 * separately by the caller.
 *
 * Names supplied in `disabled` that do not match any built-in macro
 * are reported on `process.stderr` so a config typo
 * (`'zindex'` instead of `'zIndex'`) does not silently no-op. Set
 * `CASSIDA_QUIET_MACRO_TYPO_WARNING=1` to silence.
 *
 * This runs at **build time inside the host bundler's Node.js process**
 * (vite-plugin / next-plugin webpack pass), never in browser or edge
 * runtime, so reaching for `process.stderr` / `process.env` here is
 * safe. Both are guarded — a missing `process.env` entry simply leaves
 * the warning enabled — but the function is not intended for, and is
 * never reached from, the client `@cassida/core` runtime.
 */
export function resolveMacros(disabled: readonly string[] = []): readonly CassPlugin[] {
  if (disabled.length === 0) return defaultMacros;
  const known = new Set(defaultMacros.map((p) => bareMacroName(p.name)));
  const skip = new Set(disabled);
  if (!process.env[CASSIDA_QUIET_MACRO_TYPO_WARNING]) {
    for (const name of disabled) {
      if (!known.has(name)) {
        process.stderr.write(
          `[cassida] macros.disable: unknown macro "${name}". ` +
            `Known names: ${[...known].sort().join(', ')}. ` +
            `Silence with ${CASSIDA_QUIET_MACRO_TYPO_WARNING}=1.\n`,
        );
      }
    }
  }
  return Object.freeze(defaultMacros.filter((p) => !skip.has(bareMacroName(p.name))));
}
