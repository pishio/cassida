import type { CassPlugin } from '../plugin.js';
import type { ScopeBag } from '../types.js';
import type { MacroDefinition } from './macro-types.js';

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
  return {
    name: `macro:${def.name}`,
    transform: (tree: ScopeBag): ScopeBag => applyMacroToRoot(tree, def),
  };
}

function applyMacroToRoot(tree: ScopeBag, def: MacroDefinition): ScopeBag {
  // Macros only fire on the root scope in the initial release.
  // Modifier scope handling (`scope: 'all'`) is reserved.
  if (tree.scope !== null) return tree;

  const bag = tree.bag;
  const triggerValue = bag[def.trigger.property];
  if (triggerValue === undefined) return tree;
  if (def.trigger.value !== undefined && triggerValue !== def.trigger.value) {
    return tree;
  }

  // Anti-trigger: if any of `skipIfAnyPresent` is already set, the
  // macro is suppressed entirely.
  if (def.skipIfAnyPresent) {
    for (const prop of def.skipIfAnyPresent) {
      if (bag[prop] !== undefined) return tree;
    }
  }

  // Decide each fill independently. A fill whose property is already
  // present is skipped (explicit-wins); any absent fill is added.
  const additions: Record<string, string> = {};
  for (const fill of def.fills) {
    if (bag[fill.property] === undefined) {
      additions[fill.property] = fill.value;
    }
  }

  if (Object.keys(additions).length === 0) return tree;

  return {
    ...tree,
    bag: Object.freeze({ ...bag, ...additions }),
  };
}
