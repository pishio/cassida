import type { CassPlugin } from '../plugin.js';
import { defaultMacros, zIndexMacro, transformMacro, positionStickyMacro } from './builtins.js';
import { defineMacro } from './define-macro.js';
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
 * Resolve the macros that should run for this compile. Built-in
 * macros listed in `disabled` are removed; the remainder is returned
 * in `defaultMacros` order. The result is safe to spread directly
 * into the compile-time plugin pipeline.
 */
export function resolveMacros(disabled: readonly string[] = []): readonly CassPlugin[] {
  if (disabled.length === 0) return defaultMacros;
  const skip = new Set(disabled);
  // A macro's CassPlugin `name` is prefixed with `macro:`; the user
  // supplies just the macro name (e.g. `zIndex`), so compare against
  // the suffix to keep the surface symmetric.
  return defaultMacros.filter((p) => !skip.has(p.name.replace(/^macro:/, '')));
}
