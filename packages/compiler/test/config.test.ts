import { describe, expect, it } from 'vitest';
import { defaultConfig, mergeConfig, type FssConfig } from '../src/config.js';

describe('defaultConfig', () => {
  it('has the documented defaults', () => {
    expect(defaultConfig.layer).toBe('fss');
    expect(defaultConfig.importSource).toBe('@fss/core');
    expect(defaultConfig.hash.prefix).toBe('fss-');
    expect(defaultConfig.hash.length).toBe(8);
    expect(defaultConfig.media.sort).toBe('mobile-first');
    expect(defaultConfig.css.mode).toBe('rule-per-class');
    expect(defaultConfig.css.lightningcss.enabled).toBe(false);
  });
});

describe('mergeConfig', () => {
  it('returns defaults when no layers are provided', () => {
    expect(mergeConfig()).toEqual(defaultConfig);
  });

  it('returns defaults when only undefined layers are provided', () => {
    expect(mergeConfig(undefined, undefined)).toEqual(defaultConfig);
  });

  it('overrides flat fields', () => {
    const r = mergeConfig({ importSource: '@my/css' });
    expect(r.importSource).toBe('@my/css');
    expect(r.layer).toBe('fss');
  });

  it('preserves explicit null for layer (no @layer wrap)', () => {
    const r = mergeConfig({ layer: null });
    expect(r.layer).toBeNull();
  });

  it('treats undefined as "not set" — keeps prior value', () => {
    const a: FssConfig = { layer: 'app' };
    const b: FssConfig = { layer: undefined };
    const r = mergeConfig(a, b);
    expect(r.layer).toBe('app');
  });

  it('deep-merges nested objects (hash, media, css)', () => {
    const r = mergeConfig({
      hash: { length: 12 },
      media: { sort: 'desktop-first' },
    });
    expect(r.hash.prefix).toBe('fss-');
    expect(r.hash.length).toBe(12);
    expect(r.media.sort).toBe('desktop-first');
  });

  it('layers later wins on field conflicts', () => {
    const r = mergeConfig(
      { hash: { length: 10 } },
      { hash: { length: 12 } },
    );
    expect(r.hash.length).toBe(12);
  });

  it('merges lightningcss subtree without dropping defaults', () => {
    const r = mergeConfig({
      css: { lightningcss: { enabled: true } },
    });
    expect(r.css.lightningcss.enabled).toBe(true);
    expect(r.css.lightningcss.minify).toBe(true);
    expect(r.css.lightningcss.targets).toBe('defaults');
  });
});
