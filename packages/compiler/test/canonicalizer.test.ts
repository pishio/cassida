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
    expect(result.slots).toEqual({ color: 's0' });
  });

  it('produces the same canonical key for two structurally identical dynamic chains', () => {
    const a = canon.collapse([{ method: 'color', args: [dyn('A')] }]);
    const b = canon.collapse([{ method: 'color', args: [dyn('Z')] }]);
    expect(canon.canonicalKey(a)).toBe(canon.canonicalKey(b));
  });

  it('clears a dynamic slot when a later static op overwrites the same property', () => {
    const result = canon.collapse([
      { method: 'color', args: [dyn('first')] },
      { method: 'color', args: ['red'] },
    ]);
    expect(result.bag).toEqual({ color: 'red' });
    expect(result.slots).toEqual({});
  });

  it('replaces an earlier static value when a later dynamic op overwrites', () => {
    const result = canon.collapse([
      { method: 'color', args: ['red'] },
      { method: 'color', args: [dyn('s1')] },
    ]);
    expect(result.bag).toEqual({ color: DYNAMIC_PLACEHOLDER });
    expect(result.slots).toEqual({ color: 's1' });
  });

  it('throws on mixed literal+dynamic args within a single op', () => {
    expect(() =>
      canon.collapse([{ method: 'mt', args: [dyn('s0'), 'em'] }]),
    ).toThrow(/mixed\/multi-dynamic/);
  });
});

describe('Canonicalizer.collapse — scoped ops', () => {
  it('builds a child node for a single scoped op', () => {
    const result = canon.collapse([
      { method: 'color', args: ['blue'] },
      { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['red'] }] },
    ]);
    expect(result.bag).toEqual({ color: 'blue' });
    expect(result.children).toHaveLength(1);
    const child = result.children[0]!;
    expect(child.scope).toEqual({ kind: 'pseudo', selector: ':hover' });
    expect(child.bag).toEqual({ color: 'red' });
    expect(child.children).toHaveLength(0);
  });

  it('merges two scoped ops at the same scope (concat then re-collapse)', () => {
    const result = canon.collapse([
      { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['red'] }] },
      { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'marginTop', args: [4] }] },
    ]);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.bag).toEqual({ color: 'red', 'margin-top': '4px' });
  });

  it('LIFO collapses inside a single scope', () => {
    const result = canon.collapse([
      { scope: { kind: 'pseudo', selector: ':hover' }, ops: [
        { method: 'color', args: ['red'] },
        { method: 'color', args: ['blue'] },
      ] },
    ]);
    expect(result.children[0]!.bag).toEqual({ color: 'blue' });
  });

  it('produces nested children for nested scoped ops', () => {
    const result = canon.collapse([
      {
        scope: { kind: 'pseudo', selector: ':hover' },
        ops: [
          {
            scope: { kind: 'media', query: '(min-width: 768px)' },
            ops: [{ method: 'color', args: ['red'] }],
          },
        ],
      },
    ]);
    const hover = result.children[0]!;
    const media = hover.children[0]!;
    expect(hover.bag).toEqual({});
    expect(hover.children).toHaveLength(1);
    expect(media.scope).toEqual({ kind: 'media', query: '(min-width: 768px)' });
    expect(media.bag).toEqual({ color: 'red' });
  });
});

describe('Canonicalizer.collapse — shorthand policy', () => {
  it('strict policy (default) rejects shorthand → longhand in same scope', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        { method: 'padding', args: [10] },
        { method: 'paddingTop', args: [20] },
      ]),
    ).toThrow(/longhand "paddingTop" cannot follow shorthand "padding"/);
  });

  it('strict policy rejects longhand → shorthand in same scope (the latent-bug direction)', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        { method: 'paddingTop', args: [20] },
        { method: 'padding', args: [10] },
      ]),
    ).toThrow(/shorthand "padding" cannot follow longhand "paddingTop"/);
  });

  it('shorthand-first policy rejects shorthand → longhand but allows longhand → shorthand', () => {
    const c = new Canonicalizer(defaultRegistry, 'shorthand-first');
    expect(() =>
      c.collapse([
        { method: 'padding', args: [10] },
        { method: 'paddingTop', args: [20] },
      ]),
    ).toThrow(/longhand "paddingTop" cannot follow shorthand "padding"/);
    // Reverse direction is allowed
    expect(() =>
      c.collapse([
        { method: 'paddingTop', args: [20] },
        { method: 'padding', args: [10] },
      ]),
    ).not.toThrow();
  });

  it('lenient policy allows both directions', () => {
    const c = new Canonicalizer(defaultRegistry, 'lenient');
    expect(() =>
      c.collapse([
        { method: 'padding', args: [10] },
        { method: 'paddingTop', args: [20] },
      ]),
    ).not.toThrow();
    expect(() =>
      c.collapse([
        { method: 'paddingTop', args: [20] },
        { method: 'padding', args: [10] },
      ]),
    ).not.toThrow();
  });

  it('scope boundary resets the family-tracking sets (strict)', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        { method: 'padding', args: [10] },
        {
          scope: { kind: 'media', query: '(min-width: 768px)' },
          ops: [{ method: 'paddingTop', args: [20] }],
        },
      ]),
    ).not.toThrow();
  });

  it('strict policy applies independently inside each modifier scope', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        {
          scope: { kind: 'pseudo', selector: ':hover' },
          ops: [
            { method: 'padding', args: [10] },
            { method: 'paddingTop', args: [20] },
          ],
        },
      ]),
    ).toThrow(/longhand "paddingTop" cannot follow shorthand "padding"/);
  });

  it('different families do not interact (margin vs padding)', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        { method: 'padding', args: [10] },
        { method: 'marginTop', args: [20] },
      ]),
    ).not.toThrow();
  });

  it('inset family: top is a longhand of inset', () => {
    const c = new Canonicalizer(defaultRegistry, 'strict');
    expect(() =>
      c.collapse([
        { method: 'inset', args: [10] },
        { method: 'top', args: [0] },
      ]),
    ).toThrow(/longhand "top" cannot follow shorthand "inset"/);
  });
});

describe('Canonicalizer.canonicalKey', () => {
  it('is order-independent (same chain shape → same key)', () => {
    const a = canon.canonicalKey(
      canon.collapse([
        { method: 'color', args: ['blue'] },
        { method: 'mt', args: [10, 'em'] },
      ]),
    );
    const b = canon.canonicalKey(
      canon.collapse([
        { method: 'mt', args: [10, 'em'] },
        { method: 'color', args: ['blue'] },
      ]),
    );
    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    const a = canon.canonicalKey(canon.collapse([{ method: 'color', args: ['blue'] }]));
    const b = canon.canonicalKey(canon.collapse([{ method: 'color', args: ['red'] }]));
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
