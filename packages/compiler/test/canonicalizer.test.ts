import { describe, expect, it } from 'vitest';
import { Canonicalizer } from '../src/canonicalizer.js';
import { defaultRegistry } from '../src/registry.js';
import { DYNAMIC_TAG, DYNAMIC_PLACEHOLDER, type Op } from '../src/types.js';

const canon = new Canonicalizer(defaultRegistry);
const dyn = (id: string) => ({ [DYNAMIC_TAG]: true as const, id });

describe('Canonicalizer.collapse — LIFO', () => {
  it('keeps only the last write per CSS property', () => {
    const ops: Op[] = [
      { method: 'color', args: ['red'] },
      { method: 'color', args: ['blue'] },
    ];
    expect(canon.collapse(ops).bag).toEqual({ color: 'blue' });
  });

  it('treats aliases that target the same CSS property as conflicts', () => {
    const ops: Op[] = [
      { method: 'bg', args: ['red'] },
      { method: 'background', args: ['blue'] },
    ];
    expect(canon.collapse(ops).bag).toEqual({ 'background-color': 'blue' });
  });

  it('preserves independent properties', () => {
    const ops: Op[] = [
      { method: 'color', args: ['red'] },
      { method: 'mt', args: [10, 'em'] },
    ];
    expect(canon.collapse(ops).bag).toEqual({
      color: 'red',
      'margin-top': '10em',
    });
  });
});

describe('Canonicalizer.collapse — formatting', () => {
  it('applies default unit when only a number is given', () => {
    expect(canon.collapse([{ method: 'mt', args: [10] }]).bag).toEqual({
      'margin-top': '10px',
    });
  });

  it('respects explicit unit', () => {
    expect(canon.collapse([{ method: 'mt', args: [10, 'em'] }]).bag).toEqual({
      'margin-top': '10em',
    });
  });

  it('emits "0" without unit for zero lengths', () => {
    expect(canon.collapse([{ method: 'mt', args: [0] }]).bag).toEqual({
      'margin-top': '0',
    });
  });

  it('passes string values through unchanged for length-typed methods', () => {
    expect(canon.collapse([{ method: 'width', args: ['100%'] }]).bag).toEqual({
      width: '100%',
    });
  });

  it('throws on unknown method names', () => {
    expect(() => canon.collapse([{ method: 'nope', args: [] }])).toThrow(/unknown method/);
  });
});

describe('Canonicalizer.collapse — dynamic args', () => {
  it('substitutes the dynamic placeholder for a single dynamic arg', () => {
    const result = canon.collapse([{ method: 'color', args: [dyn('s0')] }]);
    expect(result.bag).toEqual({ color: DYNAMIC_PLACEHOLDER });
    expect(result.slotByProperty).toEqual({ color: 's0' });
  });

  it('produces the same canonical key for two structurally identical dynamic chains', () => {
    const a = canon.collapse([{ method: 'color', args: [dyn('A')] }]);
    const b = canon.collapse([{ method: 'color', args: [dyn('Z')] }]);
    expect(canon.canonicalKey(a.bag)).toBe(canon.canonicalKey(b.bag));
  });

  it('clears a dynamic slot when a later static op overwrites the same property', () => {
    const result = canon.collapse([
      { method: 'color', args: [dyn('first')] },
      { method: 'color', args: ['red'] },
    ]);
    expect(result.bag).toEqual({ color: 'red' });
    expect(result.slotByProperty).toEqual({});
  });

  it('replaces an earlier static value when a later dynamic op overwrites', () => {
    const result = canon.collapse([
      { method: 'color', args: ['red'] },
      { method: 'color', args: [dyn('s1')] },
    ]);
    expect(result.bag).toEqual({ color: DYNAMIC_PLACEHOLDER });
    expect(result.slotByProperty).toEqual({ color: 's1' });
  });

  it('throws on mixed literal+dynamic args within a single op', () => {
    expect(() =>
      canon.collapse([{ method: 'mt', args: [dyn('s0'), 'em'] }]),
    ).toThrow(/mixed\/multi-dynamic/);
  });
});

describe('Canonicalizer.canonicalKey', () => {
  it('is order-independent (same bag → same key)', () => {
    const a = canon.canonicalKey({ color: 'blue', 'margin-top': '10em' });
    const b = canon.canonicalKey({ 'margin-top': '10em', color: 'blue' });
    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    const a = canon.canonicalKey({ color: 'blue' });
    const b = canon.canonicalKey({ color: 'red' });
    expect(a).not.toBe(b);
  });

  it('produces the same key regardless of which earlier ops were overwritten', () => {
    const noisy = canon.collapse([
      { method: 'color', args: ['red'] },
      { method: 'color', args: ['green'] },
      { method: 'color', args: ['blue'] },
    ]);
    const direct = canon.collapse([{ method: 'color', args: ['blue'] }]);
    expect(canon.canonicalKey(noisy.bag)).toBe(canon.canonicalKey(direct.bag));
  });
});
