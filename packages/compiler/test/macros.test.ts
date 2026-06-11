import { describe, expect, it } from 'vitest';
import {
  Canonicalizer,
  compileOps,
  defaultRegistry,
  defaultMacros,
  defineMacro,
  positionStickyMacro,
  resolveMacros,
  transformMacro,
  zIndexMacro,
  applyPlugins,
} from '../src/index.js';
import type { Op, ScopeBag } from '../src/index.js';

function collapseAndApply(ops: readonly Op[], macros: readonly typeof zIndexMacro[]): ScopeBag {
  const c = new Canonicalizer(defaultRegistry, 'lenient');
  const tree = c.collapse(ops);
  return applyPlugins(tree, macros, {
    config: { layer: 'cas', importSource: '@cassida/core' },
  });
}

function methodOp(method: string, value: string): Op {
  return { method, args: [value] };
}

describe('zIndexMacro', () => {
  it('fills position: relative when z-index is set without explicit position', () => {
    const tree = collapseAndApply([methodOp('zIndex', '10')], [zIndexMacro]);
    expect(tree.bag['z-index']).toBe('10');
    expect(tree.bag['position']).toBe('relative');
  });

  it('does not override an explicit position', () => {
    const tree = collapseAndApply(
      [methodOp('zIndex', '10'), methodOp('position', 'absolute')],
      [zIndexMacro],
    );
    expect(tree.bag['position']).toBe('absolute');
  });

  it('does not fire when only position is set without z-index', () => {
    const tree = collapseAndApply([methodOp('position', 'static')], [zIndexMacro]);
    // position: static stays explicit, z-index never appeared
    expect(tree.bag['position']).toBe('static');
    expect(tree.bag['z-index']).toBeUndefined();
  });
});

describe('transformMacro', () => {
  it('fills will-change: transform when transform is set without will-change', () => {
    const tree = collapseAndApply(
      [methodOp('transform', 'rotate(45deg)')],
      [transformMacro],
    );
    expect(tree.bag['transform']).toBe('rotate(45deg)');
    expect(tree.bag['will-change']).toBe('transform');
  });

  it('does not override an explicit will-change', () => {
    const tree = collapseAndApply(
      [methodOp('transform', 'rotate(45deg)'), methodOp('willChange', 'auto')],
      [transformMacro],
    );
    expect(tree.bag['will-change']).toBe('auto');
  });
});

describe('positionStickyMacro', () => {
  it('fills top: 0 when position is sticky and no top/right/bottom/left set', () => {
    const tree = collapseAndApply(
      [methodOp('position', 'sticky')],
      [positionStickyMacro],
    );
    expect(tree.bag['position']).toBe('sticky');
    expect(tree.bag['top']).toBe('0');
  });

  it('skips when any of top/right/bottom/left is already set', () => {
    const tree = collapseAndApply(
      [methodOp('position', 'sticky'), methodOp('bottom', '10px')],
      [positionStickyMacro],
    );
    expect(tree.bag['position']).toBe('sticky');
    expect(tree.bag['top']).toBeUndefined();
    expect(tree.bag['bottom']).toBe('10px');
  });

  it('does not fire on non-sticky position values', () => {
    const tree = collapseAndApply(
      [methodOp('position', 'absolute')],
      [positionStickyMacro],
    );
    expect(tree.bag['position']).toBe('absolute');
    expect(tree.bag['top']).toBeUndefined();
  });
});

describe('defaultMacros + resolveMacros', () => {
  it('exposes all three built-ins in order', () => {
    expect(defaultMacros.map((m) => m.name)).toEqual([
      'macro:zIndex',
      'macro:transform',
      'macro:positionSticky',
    ]);
  });

  it('resolveMacros() with no disable returns defaultMacros', () => {
    expect(resolveMacros()).toBe(defaultMacros);
  });

  it('resolveMacros disables specific macros by name', () => {
    const resolved = resolveMacros(['zIndex']);
    expect(resolved.map((m) => m.name)).toEqual([
      'macro:transform',
      'macro:positionSticky',
    ]);
  });

  it('resolveMacros disables every macro when all names supplied', () => {
    const resolved = resolveMacros(['zIndex', 'transform', 'positionSticky']);
    expect(resolved).toEqual([]);
  });
});

describe('modifier scope is not touched by macros', () => {
  it('z-index inside :hover does NOT fill position on the modifier scope', () => {
    const tree = collapseAndApply(
      [
        {
          scope: { kind: 'pseudo', selector: ':hover' },
          ops: [methodOp('zIndex', '10')],
        },
      ],
      [zIndexMacro],
    );
    expect(tree.scope).toBeNull();
    expect(tree.bag['z-index']).toBeUndefined();
    expect(tree.bag['position']).toBeUndefined();
    // Modifier child still has its own z-index but not position
    expect(tree.children.length).toBe(1);
    const hover = tree.children[0]!;
    expect(hover.bag['z-index']).toBe('10');
    expect(hover.bag['position']).toBeUndefined();
  });
});

describe('defineMacro factory', () => {
  it('produces a CassPlugin with macro: prefix', () => {
    const plugin = defineMacro({
      name: 'custom',
      trigger: { property: 'opacity' },
      fills: [{ property: 'transition', value: 'opacity 200ms' }],
    });
    expect(plugin.name).toBe('macro:custom');

    const tree = collapseAndApply([methodOp('opacity', '0.5')], [plugin]);
    expect(tree.bag['opacity']).toBe('0.5');
    expect(tree.bag['transition']).toBe('opacity 200ms');
  });

  it('respects triggerValue (only fires on matching value)', () => {
    const plugin = defineMacro({
      name: 'transitionSpecific',
      trigger: { property: 'display', value: 'flex' },
      fills: [{ property: 'gap', value: '8px' }],
    });
    const flexTree = collapseAndApply([methodOp('display', 'flex')], [plugin]);
    expect(flexTree.bag['gap']).toBe('8px');

    const gridTree = collapseAndApply([methodOp('display', 'grid')], [plugin]);
    expect(gridTree.bag['gap']).toBeUndefined();
  });

  it('throws when the supplied name already starts with the macro: prefix', () => {
    expect(() =>
      defineMacro({
        name: 'macro:custom',
        trigger: { property: 'opacity' },
        fills: [{ property: 'transition', value: 'opacity 200ms' }],
      }),
    ).toThrow(/must not include the "macro:" prefix/);
  });
});

describe('skipIfTriggerValueIn', () => {
  it('zIndexMacro skips on z-index: auto', () => {
    const tree = collapseAndApply([methodOp('zIndex', 'auto')], [zIndexMacro]);
    expect(tree.bag['z-index']).toBe('auto');
    expect(tree.bag['position']).toBeUndefined();
  });

  it('transformMacro skips on transform: none', () => {
    const tree = collapseAndApply([methodOp('transform', 'none')], [transformMacro]);
    expect(tree.bag['transform']).toBe('none');
    expect(tree.bag['will-change']).toBeUndefined();
  });

  it('all CSS-wide keywords suppress zIndexMacro', () => {
    for (const v of ['unset', 'initial', 'inherit', 'revert', 'revert-layer']) {
      const tree = collapseAndApply([methodOp('zIndex', v)], [zIndexMacro]);
      expect(tree.bag['position']).toBeUndefined();
    }
  });
});

describe('canonicalKey order independence under macro fills', () => {
  it('macro-filled bag has the same canonicalKey as explicit-write bag', () => {
    // cas.zIndex(10) — macro fills position: relative behind the scenes.
    const macroResult = compileOps(
      [methodOp('zIndex', '10')],
      { registry: defaultRegistry, shorthandPolicy: 'lenient', macros: [zIndexMacro] },
    );
    // cas.position('relative').zIndex(10) — user wrote both explicitly.
    const explicitResult = compileOps(
      [methodOp('position', 'relative'), methodOp('zIndex', '10')],
      { registry: defaultRegistry, shorthandPolicy: 'lenient' },
    );
    expect(macroResult.canonical).toBe(explicitResult.canonical);
    expect(macroResult.className).toBe(explicitResult.className);
  });

  it('insertion order of explicit writes does not change the canonical key', () => {
    const a = compileOps(
      [methodOp('position', 'relative'), methodOp('zIndex', '10')],
      { registry: defaultRegistry, shorthandPolicy: 'lenient' },
    );
    const b = compileOps(
      [methodOp('zIndex', '10'), methodOp('position', 'relative')],
      { registry: defaultRegistry, shorthandPolicy: 'lenient' },
    );
    expect(a.canonical).toBe(b.canonical);
  });
});

describe('resolveMacros result freezing', () => {
  it('returns the frozen defaultMacros when disabled is empty', () => {
    const r = resolveMacros();
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('returns a frozen array when disabled has entries', () => {
    const r = resolveMacros(['zIndex']);
    expect(Object.isFrozen(r)).toBe(true);
  });
});
