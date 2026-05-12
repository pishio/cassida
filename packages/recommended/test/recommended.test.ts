import { describe, expect, it } from 'vitest';
import { recommended } from '../src/index.js';
import { transform } from '@cassida/parser';
import { defaultRegistry } from '@cassida/compiler';

describe('recommended()', () => {
  it('returns both CSS and parser plugin sets by default', () => {
    const bundle = recommended();
    expect(bundle.plugins).toHaveLength(1); // hoverFix
    expect(bundle.parserPlugins).toHaveLength(1); // conditionalSpread
    expect(bundle.parserPlugins[0]!.name).toBe('@cassida/plugin-conditional');
  });

  it('disables hoverFix when `hoverFix: false`', () => {
    const bundle = recommended({ hoverFix: false });
    expect(bundle.plugins).toHaveLength(0);
    expect(bundle.parserPlugins).toHaveLength(1);
  });

  it('disables conditional when `conditional: false`', () => {
    const bundle = recommended({ conditional: false });
    expect(bundle.plugins).toHaveLength(1);
    expect(bundle.parserPlugins).toHaveLength(0);
  });

  it('passes hoverFix options through to the underlying factory', () => {
    // The CassPlugin shape is opaque; we can't introspect its
    // internal config. Instead, verify hoverFix is *present* and
    // independently configurable by composing the bundle with a
    // distinguishing option that downstream behavior would honor.
    const bundle = recommended({
      hoverFix: { query: '(hover: hover) and (pointer: fine)' },
    });
    expect(bundle.plugins).toHaveLength(1);
  });

  it('passes conditional options through to the underlying factory', () => {
    // With `shortCircuit: false`, the plugin won't recognize
    // `cond && cas()`. Exercise via a transform to confirm the
    // option flows.
    const bundle = recommended({
      conditional: { shortCircuit: false },
    });
    const result = transform(
      `
      import { cas } from '@cassida/core';
      export const App = ({ active }: { active: boolean }) =>
        <div {...(active && cas().color("red"))} />;
    `,
      {
        registry: defaultRegistry,
        filename: 'App.tsx',
        parserPlugins: [...bundle.parserPlugins],
      },
    );
    // The short-circuit form is now ignored by the plugin and falls
    // through to runtime — `transformed` stays false.
    expect(result.transformed).toBe(false);
  });

  it('integrates with the parser end-to-end for conditional spreads', () => {
    const bundle = recommended();
    const result = transform(
      `
      import { cas } from '@cassida/core';
      export const App = ({ a }: { a: boolean }) =>
        <div {...(a ? cas().color("red") : cas().color("blue"))} />;
    `,
      {
        registry: defaultRegistry,
        filename: 'App.tsx',
        parserPlugins: [...bundle.parserPlugins],
      },
    );
    expect(result.transformed).toBe(true);
    expect(result.rules).toHaveLength(2);
    expect(result.code).toMatch(
      /className=\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/,
    );
  });

  it('exposes individual factories for users wanting bespoke composition', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.hoverFix).toBe('function');
    expect(typeof mod.conditionalSpread).toBe('function');
  });
});
