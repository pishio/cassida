import { describe, expect, it } from 'vitest';
import { Canonicalizer } from '../src/canonicalizer.js';
import { defaultRegistry } from '../src/registry.js';
import type { Op } from '../src/types.js';

const canon = new Canonicalizer(defaultRegistry);

describe('Canonicalizer.collapse — LIFO', () => {
  it('keeps only the last write per CSS property', () => {
    const ops: Op[] = [
      { method: 'color', args: ['red'] },
      { method: 'color', args: ['blue'] },
    ];
    expect(canon.collapse(ops)).toEqual({ color: 'blue' });
  });

  it('treats aliases that target the same CSS property as conflicts', () => {
    // bg and background both write background-color → later wins
    const ops: Op[] = [
      { method: 'bg', args: ['red'] },
      { method: 'background', args: ['blue'] },
    ];
    expect(canon.collapse(ops)).toEqual({ 'background-color': 'blue' });
  });

  it('preserves independent properties', () => {
    const ops: Op[] = [
      { method: 'color', args: ['red'] },
      { method: 'mt', args: [10, 'em'] },
    ];
    expect(canon.collapse(ops)).toEqual({
      color: 'red',
      'margin-top': '10em',
    });
  });
});

describe('Canonicalizer.collapse — formatting', () => {
  it('applies default unit when only a number is given', () => {
    expect(canon.collapse([{ method: 'mt', args: [10] }])).toEqual({
      'margin-top': '10px',
    });
  });

  it('respects explicit unit', () => {
    expect(canon.collapse([{ method: 'mt', args: [10, 'em'] }])).toEqual({
      'margin-top': '10em',
    });
  });

  it('emits "0" without unit for zero lengths', () => {
    expect(canon.collapse([{ method: 'mt', args: [0] }])).toEqual({
      'margin-top': '0',
    });
  });

  it('passes string values through unchanged for length-typed methods', () => {
    expect(canon.collapse([{ method: 'width', args: ['100%'] }])).toEqual({
      width: '100%',
    });
  });

  it('throws on unknown method names', () => {
    expect(() => canon.collapse([{ method: 'nope', args: [] }])).toThrow(/unknown method/);
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
    expect(canon.canonicalKey(noisy)).toBe(canon.canonicalKey(direct));
  });
});
