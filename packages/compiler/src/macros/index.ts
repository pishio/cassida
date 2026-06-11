import type { CassPlugin } from '../plugin.js';
import { defaultMacros, zIndexMacro, transformMacro, positionStickyMacro } from './builtins.js';
import { defineMacro, MACRO_NAME_PREFIX } from './define-macro.js';
import type { MacroDefinition } from './macro-types.js';

export type { MacroDefinition };
export {
  defineMacro,
  defaultMacros,
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
 * Resolve the macros that should run for this compile. Built-in
 * macros listed in `disabled` are removed; the remainder is returned
 * in `defaultMacros` order. The result is safe to spread directly
 * into the compile-time plugin pipeline.
 *
 * Names supplied in `disabled` that do not match any built-in macro
 * are reported via `console.warn` once per call so a config typo
 * (`'zindex'` instead of `'zIndex'`) does not silently no-op.
 */
export function resolveMacros(disabled: readonly string[] = []): readonly CassPlugin[] {
  if (disabled.length === 0) return defaultMacros;
  const known = new Set(defaultMacros.map((p) => bareMacroName(p.name)));
  const skip = new Set(disabled);
  for (const name of disabled) {
    if (!known.has(name)) {
      console.warn(
        `[cassida] macros.disable: unknown macro "${name}". Known names: ${[...known].sort().join(', ')}.`,
      );
    }
  }
  return defaultMacros.filter((p) => !skip.has(bareMacroName(p.name)));
}
