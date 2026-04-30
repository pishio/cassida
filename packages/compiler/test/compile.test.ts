import { describe, expect, it } from 'vitest';
import { compileOps } from '../src/compile.js';
import { defaultRegistry } from '../src/registry.js';
import type { Op } from '../src/types.js';

const opts = { registry: defaultRegistry };

describe('compileOps', () => {
  it('returns className, bag, and canonical for a simple chain', () => {
    const ops: Op[] = [
      { method: 'mt', args: [10, 'em'] },
      { method: 'color', args: ['blue'] },
    ];
    const result = compileOps(ops, opts);
    expect(result.bag).toEqual({ 'margin-top': '10em', color: 'blue' });
    expect(result.className).toMatch(/^fss-[0-9a-f]{8}$/);
    expect(result.canonical).toContain('color');
    expect(result.canonical).toContain('margin-top');
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
