import type { CassPlugin, PluginContext } from '../plugin.js';
import type { ScopeBag } from '../types.js';
import type { MacroDefinition } from './macro-types.js';

/**
 * Prefix the runtime stamps on every macro-produced `CassPlugin`'s
 * `name` field. `resolveMacros` reads it back out when matching
 * `config.macros.disable` entries, so the two sides MUST agree.
 * Exporting the constant means there is only one source of truth.
 */
export const MACRO_NAME_PREFIX = 'macro:' as const;

/**
 * Turn a `MacroDefinition` into a `CassPlugin` that fires only on the
 * root scope. The resulting plugin is sync, pure, and immutable —
 * matching the `CassPlugin` contract.
 *
 * Plugin order at compile time: `[...macros, ...userPlugins]`. Macros
 * write defaults into the root bag; user plugins then see the macro-
 * filled tree and can wrap, transform, or add scopes on top of it.
 * The class hash includes the macro-fill outputs, so two chains that
 * end up with the same final tree share a class regardless of
 * whether one wrote the fills explicitly and the other relied on
 * macros.
 */
export function defineMacro(def: MacroDefinition): CassPlugin {
  if (def.name.startsWith(MACRO_NAME_PREFIX)) {
    throw new Error(
      `[cassida] defineMacro: name must not include the "${MACRO_NAME_PREFIX}" prefix; ` +
        `got "${def.name}". The prefix is added automatically.`,
    );
  }
  return {
    name: `${MACRO_NAME_PREFIX}${def.name}`,
    // `ctx` is intentionally unused for built-in macros; resolved
    // config is encoded entirely in `MacroDefinition` itself.
    transform: (tree: ScopeBag, _ctx: PluginContext): ScopeBag => applyMacroToRoot(tree, def),
  };
}

function applyMacroToRoot(tree: ScopeBag, def: MacroDefinition): ScopeBag {
  // Macros only fire on the root scope. Modifier scopes (`:hover`,
  // `@media`, ...) are intentionally not visited; see `MacroDefinition`
  // docstring for rationale. This is the modifier-scope opt-out point
  // — extending the runtime to walk children would happen here.
  if (tree.scope !== null) return tree;

  const bag = tree.bag;
  const triggerValue = bag[def.trigger.property];
  if (triggerValue === undefined) return tree;
  if (def.trigger.value !== undefined && triggerValue !== def.trigger.value) {
    return tree;
  }

  // Value-level anti-trigger: skip when the trigger property's value
  // is a CSS-wide keyword like `auto` / `none` / `unset` that has no
  // effect anyway.
  if (def.skipIfTriggerValueIn) {
    for (const skipValue of def.skipIfTriggerValueIn) {
      if (triggerValue === skipValue) return tree;
    }
  }

  // Property-level anti-trigger: if any of `skipIfAnyPresent` is
  // already set, the macro is suppressed entirely.
  if (def.skipIfAnyPresent) {
    for (const prop of def.skipIfAnyPresent) {
      if (bag[prop] !== undefined) return tree;
    }
  }

  // Decide each fill independently. A fill whose property is already
  // present is skipped (explicit-wins); any absent fill is added.
  //
  // Resulting bag keys are sorted to keep the post-macro bag insertion
  // order independent of `def.fills` order. This makes the bijection
  // hold: `cas.zIndex(10)` (macro fills position) and
  // `cas.position('relative').zIndex(10)` (user wrote both) yield the
  // same bag shape and therefore the same canonicalKey.
  const additions: Record<string, string> = {};
  for (const fill of def.fills) {
    if (bag[fill.property] === undefined) {
      additions[fill.property] = fill.value;
    }
  }

  if (Object.keys(additions).length === 0) return tree;

  const sorted: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...bag, ...additions }).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    sorted[k] = v;
  }

  return {
    ...tree,
    bag: Object.freeze(sorted),
  };
}
