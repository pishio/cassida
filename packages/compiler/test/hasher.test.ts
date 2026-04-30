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
});
