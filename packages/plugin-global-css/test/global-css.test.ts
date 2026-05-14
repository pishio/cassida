import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { cassidaGlobalCss } from '../src/index.js';

/**
 * The plugin's `resolveId` and `load` hooks are typed as Vite's
 * `ObjectHook<...>`, which is either a function or `{ handler, ... }`.
 * We always assign functions in the implementation, so a thin helper
 * keeps the tests free of cast boilerplate.
 */
function callResolveId(plugin: Plugin, id: string): string | null {
  const hook = plugin.resolveId;
  if (typeof hook !== 'function') {
    throw new Error('resolveId must be a function in tests');
  }
  // The Rollup ctx is irrelevant for this plugin — pass an empty stub.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (hook as any).call({}, id, undefined, {});
  return typeof result === 'string' ? result : null;
}

function callLoad(plugin: Plugin, id: string): string | null {
  const hook = plugin.load;
  if (typeof hook !== 'function') {
    throw new Error('load must be a function in tests');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (hook as any).call({}, id);
  return typeof result === 'string' ? result : null;
}

describe('cassidaGlobalCss', () => {
  const css = ':root { --x: 1px; }\nbody { margin: 0; }';

  it('resolves the default virtual id to its `\\0`-prefixed form', () => {
    const plugin = cassidaGlobalCss({ css });
    expect(callResolveId(plugin, 'virtual:cassida-global.css')).toBe(
      '\0virtual:cassida-global.css',
    );
  });

  it('returns null for unrelated ids', () => {
    const plugin = cassidaGlobalCss({ css });
    expect(callResolveId(plugin, 'some-other-id')).toBeNull();
    expect(callLoad(plugin, 'some-other-id')).toBeNull();
  });

  it('wraps css in `@layer base` by default', () => {
    const plugin = cassidaGlobalCss({ css });
    const loaded = callLoad(plugin, '\0virtual:cassida-global.css');
    expect(loaded).toBe(`@layer base {\n${css}\n}`);
  });

  it('honors a custom layer name', () => {
    const plugin = cassidaGlobalCss({ css, layer: 'reset' });
    const loaded = callLoad(plugin, '\0virtual:cassida-global.css');
    expect(loaded).toBe(`@layer reset {\n${css}\n}`);
  });

  it('skips the @layer wrap when layer is explicitly null', () => {
    const plugin = cassidaGlobalCss({ css, layer: null });
    const loaded = callLoad(plugin, '\0virtual:cassida-global.css');
    expect(loaded).toBe(css);
  });

  it('supports overriding the virtual id', () => {
    const plugin = cassidaGlobalCss({
      css,
      virtualId: 'virtual:my-preflight.css',
    });
    expect(callResolveId(plugin, 'virtual:my-preflight.css')).toBe(
      '\0virtual:my-preflight.css',
    );
    // The default id must no longer resolve.
    expect(callResolveId(plugin, 'virtual:cassida-global.css')).toBeNull();
    const loaded = callLoad(plugin, '\0virtual:my-preflight.css');
    expect(loaded).toBe(`@layer base {\n${css}\n}`);
  });

  it('exposes a stable plugin name for ordering / debugging', () => {
    const plugin = cassidaGlobalCss({ css });
    expect(plugin.name).toBe('cassida-global-css');
  });

  describe('query-suffixed module ids', () => {
    // Vite synthesizes ids like `virtual:foo?inline`, `virtual:foo?url`,
    // and HMR timestamps such as `virtual:foo?t=1700000000000`. The
    // hooks must accept these so downstream behaviour (?inline / ?url)
    // works against the virtual module.
    it('resolves `virtualId?inline` to its `\\0`-prefixed form', () => {
      const plugin = cassidaGlobalCss({ css });
      expect(
        callResolveId(plugin, 'virtual:cassida-global.css?inline'),
      ).toBe('\0virtual:cassida-global.css?inline');
    });

    it('loads `\\0virtualId?inline` to the same payload as the bare id', () => {
      const plugin = cassidaGlobalCss({ css });
      const loaded = callLoad(
        plugin,
        '\0virtual:cassida-global.css?inline',
      );
      expect(loaded).toBe(`@layer base {\n${css}\n}`);
    });

    it('resolves HMR-timestamped ids', () => {
      const plugin = cassidaGlobalCss({ css });
      expect(
        callResolveId(plugin, 'virtual:cassida-global.css?t=1700000000000'),
      ).toBe('\0virtual:cassida-global.css?t=1700000000000');
    });

    it('does NOT match a different id that merely starts with the virtual id', () => {
      // `virtual:cassida-global.cssX` shares no `?` boundary, so it
      // must remain unclaimed.
      const plugin = cassidaGlobalCss({ css });
      expect(
        callResolveId(plugin, 'virtual:cassida-global.cssX'),
      ).toBeNull();
    });
  });

  describe('layer name validation', () => {
    it('accepts a dot-separated layer name', () => {
      expect(() =>
        cassidaGlobalCss({ css, layer: 'framework.preflight' }),
      ).not.toThrow();
    });

    it('rejects a comma-separated layer list (declaration form, not block)', () => {
      expect(() => cassidaGlobalCss({ css, layer: 'base, extra' })).toThrow(
        /invalid `layer` option/,
      );
    });

    it('rejects whitespace inside the layer name', () => {
      expect(() => cassidaGlobalCss({ css, layer: 'base extra' })).toThrow(
        /invalid `layer` option/,
      );
    });

    it('rejects the empty string', () => {
      expect(() => cassidaGlobalCss({ css, layer: '' })).toThrow(
        /invalid `layer` option/,
      );
    });

    it('rejects an opening brace', () => {
      expect(() => cassidaGlobalCss({ css, layer: 'oops {' })).toThrow(
        /invalid `layer` option/,
      );
    });

    it('still accepts `null` as opt-out', () => {
      expect(() =>
        cassidaGlobalCss({ css, layer: null }),
      ).not.toThrow();
    });
  });
});
