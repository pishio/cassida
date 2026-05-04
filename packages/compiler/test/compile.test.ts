import { describe, expect, it } from 'vitest';
import { compileOps } from '../src/compile.js';
import { defaultRegistry } from '../src/registry.js';
import { DYNAMIC_TAG, type Op } from '../src/types.js';

const opts = { registry: defaultRegistry };
const dyn = (id: string) => ({ [DYNAMIC_TAG]: true as const, id });

describe('compileOps — static chains', () => {
  it('returns className, bag, canonical, and dynamics for a simple chain', () => {
    const ops: Op[] = [
      { method: 'mt', args: [10, 'em'] },
      { method: 'color', args: ['blue'] },
    ];
    const result = compileOps(ops, opts);
    expect(result.tree.bag).toEqual({ 'margin-top': '10em', color: 'blue' });
    expect(result.className).toMatch(/^cas-[0-9a-f]{8}$/);
    expect(result.canonical).toContain('color');
    expect(result.canonical).toContain('margin-top');
    expect(result.dynamics).toEqual([]);
  });

  it('produces the same className when intermediate writes are overwritten', () => {
    const noisy = compileOps(
      [
        { method: 'color', args: ['red'] },
        { method: 'color', args: ['green'] },
        { method: 'color', args: ['blue'] },
      ],
      opts,
    );
    const direct = compileOps([{ method: 'color', args: ['blue'] }], opts);
    expect(noisy.className).toBe(direct.className);
    expect(noisy.canonical).toBe(direct.canonical);
  });

  it('produces different classNames for different bags', () => {
    const a = compileOps([{ method: 'color', args: ['red'] }], opts);
    const b = compileOps([{ method: 'color', args: ['blue'] }], opts);
    expect(a.className).not.toBe(b.className);
  });

  it('respects custom prefix and length', () => {
    const r = compileOps([{ method: 'color', args: ['red'] }], {
      registry: defaultRegistry,
      prefix: 'x-',
      length: 12,
    });
    expect(r.className).toMatch(/^x-[0-9a-f]{12}$/);
  });
});

describe('compileOps — dynamic chains', () => {
  it('substitutes var(--<class>-<prop>) for dynamic slots in the bag', () => {
    const result = compileOps([{ method: 'color', args: [dyn('s0')] }], opts);
    expect(result.tree.bag.color).toMatch(/^var\(--cas-[0-9a-f]{8}-color\)$/);
    expect(result.dynamics).toHaveLength(1);
    expect(result.dynamics[0]!.property).toBe('color');
    expect(result.dynamics[0]!.varName).toBe(`--${result.className}-color`);
    expect(result.dynamics[0]!.sourceId).toBe('s0');
    expect(result.dynamics[0]!.animatable).toBe(true);
    expect(result.dynamics[0]!.syntax).toBe('<color>');
    expect(result.dynamics[0]!.initialValue).toBe('transparent');
  });

  it('shares the className across structurally identical dynamic chains', () => {
    const a = compileOps([{ method: 'color', args: [dyn('aaa')] }], opts);
    const b = compileOps([{ method: 'color', args: [dyn('zzz')] }], opts);
    expect(a.className).toBe(b.className);
  });

  it('produces a different className when static and dynamic mix differently', () => {
    const a = compileOps([{ method: 'color', args: ['red'] }], opts);
    const b = compileOps([{ method: 'color', args: [dyn('s0')] }], opts);
    expect(a.className).not.toBe(b.className);
  });

  it('marks non-animatable properties accordingly in the slot', () => {
    const result = compileOps([{ method: 'display', args: [dyn('s0')] }], opts);
    expect(result.dynamics[0]!.animatable).toBe(false);
  });

  it('preserves source ids when multiple dynamic slots are present', () => {
    const result = compileOps(
      [
        { method: 'color', args: [dyn('a')] },
        { method: 'marginTop', args: [dyn('b')] },
      ],
      opts,
    );
    expect(result.dynamics).toHaveLength(2);
    const slotByProp = Object.fromEntries(result.dynamics.map((d) => [d.property, d.sourceId]));
    expect(slotByProp).toEqual({ color: 'a', 'margin-top': 'b' });
  });
});
