import { describe, expect, it } from 'vitest';
import { hash, DEFAULT_PREFIX, DEFAULT_LENGTH } from '../src/hasher.js';

describe('hash', () => {
  it('is deterministic', () => {
    expect(hash('foo')).toBe(hash('foo'));
  });

  it('uses the default prefix and length', () => {
    const h = hash('foo');
    expect(h.startsWith(DEFAULT_PREFIX)).toBe(true);
    expect(h.length).toBe(DEFAULT_PREFIX.length + DEFAULT_LENGTH);
  });

  it('respects a custom prefix', () => {
    expect(hash('foo', { prefix: 'x-' }).startsWith('x-')).toBe(true);
  });

  it('respects a custom length', () => {
    expect(hash('foo', { length: 12 })).toHaveLength(DEFAULT_PREFIX.length + 12);
  });

  it('produces different hashes for different inputs', () => {
    expect(hash('foo')).not.toBe(hash('bar'));
  });

  it('produces hex-only suffixes', () => {
    const h = hash('hello world');
    const suffix = h.slice(DEFAULT_PREFIX.length);
    expect(suffix).toMatch(/^[0-9a-f]+$/);
  });

  it('extends past 32-bit width with chained seeds (length > 8)', () => {
    const h = hash('foo', { length: 24 });
    const suffix = h.slice(DEFAULT_PREFIX.length);
    expect(suffix).toMatch(/^[0-9a-f]{24}$/);
    // First 8 chars must equal the default-length result so the prefix
    // is stable when length is later widened — a property the previous
    // sha1+slice implementation also had.
    const short = hash('foo');
    expect(suffix.slice(0, 8)).toBe(short.slice(DEFAULT_PREFIX.length));
  });

  it('collision-rate smoke check across canonical-shaped inputs', () => {
    // Build a few thousand "canonical-bag-shaped" strings — the kind
    // of input the canonicalizer actually feeds the hasher — and
    // assert no collision in the truncated 32-bit space. With
    // random-uniform output, expected collisions for 5k inputs in
    // 2^32 slots is ~3e-3, so any collision here likely indicates a
    // distribution bug.
    const seen = new Set<string>();
    const COUNT = 5000;
    for (let i = 0; i < COUNT; i++) {
      const canonical = `color:#${i.toString(16).padStart(6, '0')};margin-top:${i}px;`;
      const h = hash(canonical);
      expect(seen.has(h)).toBe(false);
      seen.add(h);
    }
    expect(seen.size).toBe(COUNT);
  });
});
