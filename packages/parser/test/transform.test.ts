import { describe, expect, it } from 'vitest';
import { transform } from '../src/index.js';
import { defaultRegistry } from '@fss/compiler';

const opts = { registry: defaultRegistry, filename: 'App.tsx' };

describe('transform — static fss() chains in JSX spread', () => {
  it('rewrites a simple chain to a className attribute', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.code).toMatch(/className=("|')fss-[0-9a-f]{8}\1/);
    expect(r.code).not.toMatch(/fss\(\)/);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.bag).toEqual({ color: 'red' });
  });

  it('LIFO-collapses chains so output bag matches the last write', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red").color("blue")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.bag).toEqual({ color: 'blue' });
  });

  it('skips chains with non-literal arguments (runtime fallback)', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ c }: { c: string }) => <div {...fss().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
    expect(r.rules).toHaveLength(0);
    expect(r.code).toBe(src);
  });

  it('skips chains rooted at non-imported "fss" identifiers', () => {
    const src = `
      const fss = () => ({});
      export const App = () => <div {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('honors renamed imports', () => {
    const src = `
      import { fss as ff } from '@fss/core';
      export const App = () => <div {...ff().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.bag).toEqual({ color: 'red' });
  });

  it('handles negative numeric literals', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().marginTop(-10, "em")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.bag).toEqual({ 'margin-top': '-10em' });
  });

  it('handles plain template literals (no interpolation)', () => {
    const src = [
      "import { fss } from '@fss/core';",
      'export const App = () => <div {...fss().color(`red`)} />;',
    ].join('\n');
    const r = transform(src, opts);
    expect(r.rules[0]!.bag).toEqual({ color: 'red' });
  });

  it('returns the original source unchanged when no fss import is present', () => {
    const src = `export const App = () => <div className="x" />;`;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
    expect(r.code).toBe(src);
    expect(r.rules).toHaveLength(0);
  });

  it('handles multiple JSX sites in one file', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => (
        <div>
          <span {...fss().color("red")} />
          <span {...fss().color("blue")} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(new Set(r.rules.map((x) => x.className)).size).toBe(2);
  });

  it('produces identical classNames for identical bags within a file', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => (
        <div>
          <span {...fss().color("red")} />
          <span {...fss().color("red")} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.className).toBe(r.rules[1]!.className);
  });

  it('only treats unprefixed property access (not computed) as a chain method', () => {
    const src = `
      import { fss } from '@fss/core';
      const k = "color";
      export const App = () => <div {...fss()[k]("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });
});
