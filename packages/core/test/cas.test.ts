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
});
