import { describe, expect, it } from 'vitest';
import { mergeConfig } from '@cassida/compiler';
import { resolveWebpackPluginOptions } from '../src/webpack-options.js';

describe('resolveWebpackPluginOptions', () => {
  it('propagates media.sort, css.mode, layer, and resolved', () => {
    const resolved = mergeConfig({
      media: { sort: 'desktop-first' },
      css: { mode: 'shared-by-declaration' },
    });
    const opts = resolveWebpackPluginOptions(resolved, 'cas');
    // #59 regression: media.sort must reach the emitter (parity with
    // @cassida/vite-plugin), not silently default to mobile-first.
    expect(opts.mediaSort).toBe('desktop-first');
    expect(opts.mode).toBe('shared-by-declaration');
    expect(opts.layer).toBe('cas');
    expect(opts.resolved).toBe(resolved);
  });

  it('defaults mediaSort to mobile-first and mode to rule-per-class', () => {
    const opts = resolveWebpackPluginOptions(mergeConfig({}), 'cas');
    expect(opts.mediaSort).toBe('mobile-first');
    expect(opts.mode).toBe('rule-per-class');
  });

  it('passes a null layer through unchanged', () => {
    const opts = resolveWebpackPluginOptions(mergeConfig({}), null);
    expect(opts.layer).toBeNull();
  });
});
