import { describe, expect, it } from 'vitest';
import {
  EvaluatedPrimitiveSchema,
  defaultConfig,
  mergeConfig,
  parseCassConfig,
  type CassConfig,
} from '../src/config.js';

describe('defaultConfig', () => {
  it('has the documented defaults', () => {
    expect(defaultConfig.layer).toBe('cas');
    expect(defaultConfig.importSource).toBe('@cassida/core');
    expect(defaultConfig.hash.prefix).toBe('cas-');
    expect(defaultConfig.hash.length).toBe(8);
    expect(defaultConfig.media.sort).toBe('mobile-first');
    expect(defaultConfig.css.mode).toBe('rule-per-class');
    // v0.12.0: lightningcss is opt-out (default true). Cassida's
    // emit output is post-processed by lightningcss for vendor
    // prefixing + minification unless the user explicitly disables it.
    expect(defaultConfig.css.lightningcss.enabled).toBe(true);
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
    expect(r.layer).toBe('cas');
  });

  it('preserves explicit null for layer (no @layer wrap)', () => {
    const r = mergeConfig({ layer: null });
    expect(r.layer).toBeNull();
  });

  it('treats undefined as "not set" — keeps prior value', () => {
    const a: CassConfig = { layer: 'app' };
    const b: CassConfig = { layer: undefined };
    const r = mergeConfig(a, b);
    expect(r.layer).toBe('app');
  });

  it('deep-merges nested objects (hash, media, css)', () => {
    const r = mergeConfig({
      hash: { length: 12 },
      media: { sort: 'desktop-first' },
    });
    expect(r.hash.prefix).toBe('cas-');
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

describe('parseCassConfig', () => {
  it('accepts a fully-omitted config (empty object)', () => {
    expect(parseCassConfig({})).toEqual({});
  });

  it('accepts a fully-populated valid config', () => {
    const cfg = parseCassConfig({
      $schema: './schema.json',
      layer: 'app',
      importSource: '@my/css',
      hash: { prefix: 'x-', length: 12 },
      media: { sort: 'desktop-first' },
      css: { mode: 'rule-per-class', lightningcss: { enabled: true, minify: false, targets: 'defaults' } },
    });
    expect(cfg.layer).toBe('app');
    expect(cfg.hash?.length).toBe(12);
  });

  it('preserves explicit null for layer', () => {
    expect(parseCassConfig({ layer: null }).layer).toBeNull();
  });

  it('rejects unknown top-level fields with a clear error', () => {
    expect(() => parseCassConfig({ unknwonTypo: 1 })).toThrow(
      /invalid configuration[\s\S]*unknwonTypo/,
    );
  });

  it('rejects unknown nested fields too', () => {
    expect(() => parseCassConfig({ hash: { typo: 'x' } })).toThrow(
      /hash[\s\S]*typo/,
    );
  });

  it('rejects out-of-range hash.length', () => {
    expect(() => parseCassConfig({ hash: { length: 1 } })).toThrow(/length/);
    expect(() => parseCassConfig({ hash: { length: 100 } })).toThrow(/length/);
  });

  it('rejects non-integer hash.length', () => {
    expect(() => parseCassConfig({ hash: { length: 8.5 } })).toThrow(/length/);
  });

  it('rejects invalid media.sort enum value', () => {
    expect(() => parseCassConfig({ media: { sort: 'random' } })).toThrow(/sort/);
  });

  it('weaves sourcePath into the error heading', () => {
    expect(() =>
      parseCassConfig({ unknwonTypo: 1 }, '/proj/cassida.config.json'),
    ).toThrow(/in \/proj\/cassida\.config\.json/);
  });
});

describe('EvaluatedPrimitiveSchema', () => {
  it('accepts strings, numbers, booleans, and null', () => {
    expect(EvaluatedPrimitiveSchema.safeParse('red').success).toBe(true);
    expect(EvaluatedPrimitiveSchema.safeParse(10).success).toBe(true);
    expect(EvaluatedPrimitiveSchema.safeParse(true).success).toBe(true);
    expect(EvaluatedPrimitiveSchema.safeParse(null).success).toBe(true);
  });

  it('rejects objects, arrays, and undefined', () => {
    expect(EvaluatedPrimitiveSchema.safeParse({ a: 1 }).success).toBe(false);
    expect(EvaluatedPrimitiveSchema.safeParse([1, 2]).success).toBe(false);
    expect(EvaluatedPrimitiveSchema.safeParse(undefined).success).toBe(false);
  });
});
