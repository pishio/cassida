import { describe, expect, it } from 'vitest';
import { fss } from '../src/index.js';

describe('runtime fss()', () => {
  it('produces a spread-friendly object with only `style` enumerable', () => {
    const chain = fss().color('red');
    const spread = { ...chain };
    expect(spread).toEqual({ style: { color: 'red' } });
  });

  it('does not leak chain methods through spread', () => {
    const chain = fss().color('red');
    const spread = { ...chain };
    expect('color' in spread).toBe(false);
    expect('marginTop' in spread).toBe(false);
  });

  it('LIFO collapses identically to compileOps', () => {
    const chain = fss().color('red').color('green').color('blue');
    expect({ ...chain }).toEqual({ style: { color: 'blue' } });
  });

  it('camelCases CSS property names for React style consumption', () => {
    const chain = fss().marginTop(10, 'em').backgroundColor('white');
    expect({ ...chain }).toEqual({
      style: { marginTop: '10em', backgroundColor: 'white' },
    });
  });

  it('handles aliases identically to canonicals', () => {
    const a = { ...fss().mt(10) };
    const b = { ...fss().marginTop(10) };
    expect(a).toEqual(b);
  });

  it('returns the same chain object across method calls (mutation in place)', () => {
    const c = fss();
    const r1 = (c as unknown as { color: (v: string) => unknown }).color('red');
    expect(r1).toBe(c);
  });
});
