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
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('LIFO-collapses chains so output bag matches the last write', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red").color("blue")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.bag).toEqual({ color: 'blue' });
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

  it('only treats unprefixed property access as a chain method', () => {
    const src = `
      import { fss } from '@fss/core';
      const k = "color";
      export const App = () => <div {...fss()[k]("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('skips chains rooted at non-imported "fss" identifiers', () => {
    const src = `
      const fss = () => ({});
      export const App = () => <div {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });
});

describe('transform — dynamic chains', () => {
  it('promotes a dynamic arg to a CSS variable + inline style entry', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ c }: { c: string }) => <div {...fss().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.dynamics).toHaveLength(1);
    expect(r.rules[0]!.dynamics[0]!.property).toBe('color');
    // Output should contain a className= and a style with the var
    expect(r.code).toMatch(/className=("|')fss-[0-9a-f]{8}\1/);
    expect(r.code).toMatch(/"--fss-[0-9a-f]{8}-color":\s*c/);
    expect(r.code).not.toMatch(/fss\(\)\.color/);
  });

  it('shares the className across structurally identical dynamic chains', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ a, b }: { a: string; b: string }) => (
        <div>
          <span {...fss().color(a)} />
          <span {...fss().color(b)} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.className).toBe(r.rules[1]!.className);
  });

  it('produces a different className when static and dynamic mix differently', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ c }: { c: string }) => (
        <div>
          <span {...fss().color("red")} />
          <span {...fss().color(c)} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.className).not.toBe(r.rules[1]!.className);
  });

  it('bails on mixed literal+dynamic args within one op', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ n }: { n: number }) => <div {...fss().marginTop(n, "em")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
    expect(r.code).toBe(src);
  });

  it('throws on multiple {...fss()} spreads on the same element', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red")} {...fss().marginTop(10)} />;
    `;
    expect(() => transform(src, opts)).toThrow(/Multiple \{\.\.\.fss\(\)\} spreads/);
  });
});

describe('transform — JSX surgery (style merge / className concat)', () => {
  it('concats existing string className with FSS hash', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div className="my-btn" {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/className=("|')my-btn fss-[0-9a-f]{8}\1/);
  });

  it('concats dynamic className expressions via template literal', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ x }: { x: string }) => <div className={x} {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    // Generated code uses a template literal: \`${x} fss-XXX\`
    expect(r.code).toMatch(/className=\{`\$\{x\} fss-[0-9a-f]{8}`\}/);
  });

  it('keeps existing user style when there are no dynamics and FSS does not conflict', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div style={{opacity:0.5}} {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/style=\{\{\s*opacity:\s*0\.5\s*\}\}/);
  });

  it('drops user static style key when FSS wins (spread is later)', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div style={{color:"green"}} {...fss().color("red")} />;
    `;
    const r = transform(src, opts);
    // user's color: "green" should be dropped from the merged style;
    // since FSS color is static (not dynamic), no style attribute is needed at all
    expect(r.code).not.toMatch(/color:\s*"green"/);
    // but the className must carry the fss class
    expect(r.code).toMatch(/className=("|')fss-[0-9a-f]{8}\1/);
  });

  it('preserves user style when user wins (spread is earlier)', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red")} style={{color:"green"}} />;
    `;
    const r = transform(src, opts);
    // user's color: "green" survives because their style attr is later
    expect(r.code).toMatch(/style=\{\{\s*color:\s*"green"\s*\}\}/);
  });

  it('merges static user style with FSS dynamic vars', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ c }: { c: string }) => <div style={{opacity:0.5}} {...fss().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/opacity:\s*0\.5/);
    expect(r.code).toMatch(/"--fss-[0-9a-f]{8}-color":\s*c/);
  });
});
