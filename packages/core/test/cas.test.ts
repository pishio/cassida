import { describe, expect, it } from 'vitest';
import { cas } from '../src/index.js';

describe('runtime cas()', () => {
  it('produces a spread-friendly object with only `style` enumerable', () => {
    const chain = cas().color('red');
    const spread = { ...chain };
    expect(spread).toEqual({ style: { color: 'red' } });
  });

  it('does not leak chain methods through spread', () => {
    const chain = cas().color('red');
    const spread = { ...chain };
    expect('color' in spread).toBe(false);
    expect('marginTop' in spread).toBe(false);
  });

  it('LIFO collapses identically to compileOps', () => {
    const chain = cas().color('red').color('green').color('blue');
    expect({ ...chain }).toEqual({ style: { color: 'blue' } });
  });

  it('camelCases CSS property names for React style consumption', () => {
    const chain = cas().marginTop(10, 'em').backgroundColor('white');
    expect({ ...chain }).toEqual({
      style: { marginTop: '10em', backgroundColor: 'white' },
    });
  });

  it('handles aliases identically to canonicals (runtime-only)', () => {
    // Aliases are runtime sugar; the canonical CassChain type intentionally
    // does not surface them. Access via index to bypass TS narrowing —
    // this mirrors what JS users get and what the parser allows.
    type AliasChain = Record<string, (...args: unknown[]) => unknown>;
    const aliasChain = cas() as unknown as AliasChain;
    const a = { ...(aliasChain['mt']!(10) as { style: object }) };
    const b = { ...cas().marginTop(10) };
    expect(a).toEqual(b);
  });

  it('returns the same chain object across method calls (mutation in place)', () => {
    const c = cas();
    const r1 = (c as unknown as { color: (v: string) => unknown }).color('red');
    expect(r1).toBe(c);
  });

  describe('.props terminator (v0.3+)', () => {
    it('returns { className, style } from `.props`', () => {
      const props = cas().color('red').padding(8).props;
      expect(props.className).toMatch(/^cas-[0-9a-f]{8}$/);
      expect(props.style).toEqual({ color: 'red', padding: '8px' });
    });

    it('is non-enumerable so `{...chain}` does not spread `{props: {...}}`', () => {
      const chain = cas().color('red');
      // Direct spread carries only the legacy `style` field, not a
      // nested `props` object. This keeps v0.2 user code working at
      // runtime even though the type system stops surfacing the
      // chain's spread shape from v0.3 onward.
      const spread = { ...chain };
      expect('props' in spread).toBe(false);
      expect(spread).toEqual({ style: { color: 'red' } });
    });

    it('className is stable across calls for the same chain shape', () => {
      const a = cas().color('red').padding(8).props.className;
      const b = cas().padding(8).color('red').props.className;
      // Canonical ordering means key permutations yield the same hash.
      expect(a).toBe(b);
    });

    it('returns a frozen result', () => {
      const props = cas().color('red').props;
      expect(Object.isFrozen(props)).toBe(true);
      expect(Object.isFrozen(props.style)).toBe(true);
    });
  });
});
