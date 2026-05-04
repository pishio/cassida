import { describe, expect, it } from 'vitest';
import { transform } from '../src/index.js';
import { defaultRegistry } from '@cassida/compiler';

const opts = { registry: defaultRegistry, filename: 'App.tsx' };

describe('transform — static cas() chains in JSX spread', () => {
  it('rewrites a simple chain to a className attribute', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.code).toMatch(/className=("|')cas-[0-9a-f]{8}\1/);
    expect(r.code).not.toMatch(/fss\(\)/);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('LIFO-collapses chains so output bag matches the last write', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().color("red").color("blue")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'blue' });
  });

  it('honors renamed imports', () => {
    const src = `
      import { cas as ff } from '@cassida/core';
      export const App = () => <div {...ff().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
  });

  it('handles negative numeric literals', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().marginTop(-10, "em")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ 'margin-top': '-10em' });
  });

  it('handles plain template literals (no interpolation)', () => {
    const src = [
      "import { cas } from '@cassida/core';",
      'export const App = () => <div {...cas().color(`red`)} />;',
    ].join('\n');
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
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
      import { cas } from '@cassida/core';
      export const App = () => (
        <div>
          <span {...cas().color("red")} />
          <span {...cas().color("blue")} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(new Set(r.rules.map((x) => x.className)).size).toBe(2);
  });

  it('produces identical classNames for identical bags within a file', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => (
        <div>
          <span {...cas().color("red")} />
          <span {...cas().color("red")} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.className).toBe(r.rules[1]!.className);
  });

  it('only treats unprefixed property access as a chain method', () => {
    const src = `
      import { cas } from '@cassida/core';
      const k = "color";
      export const App = () => <div {...cas()[k]("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('skips chains rooted at non-imported "fss" identifiers', () => {
    const src = `
      const fss = () => ({});
      export const App = () => <div {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });
});

describe('transform — dynamic chains', () => {
  it('promotes a dynamic arg to a CSS variable + inline style entry', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ c }: { c: string }) => <div {...cas().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.dynamics).toHaveLength(1);
    expect(r.rules[0]!.dynamics[0]!.property).toBe('color');
    // Output should contain a className= and a style with the var
    expect(r.code).toMatch(/className=("|')cas-[0-9a-f]{8}\1/);
    expect(r.code).toMatch(/"--cas-[0-9a-f]{8}-color":\s*c/);
    expect(r.code).not.toMatch(/fss\(\)\.color/);
  });

  it('shares the className across structurally identical dynamic chains', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ a, b }: { a: string; b: string }) => (
        <div>
          <span {...cas().color(a)} />
          <span {...cas().color(b)} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.className).toBe(r.rules[1]!.className);
  });

  it('produces a different className when static and dynamic mix differently', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ c }: { c: string }) => (
        <div>
          <span {...cas().color("red")} />
          <span {...cas().color(c)} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.className).not.toBe(r.rules[1]!.className);
  });

  it('bails on mixed literal+dynamic args within one op', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ n }: { n: number }) => <div {...cas().marginTop(n, "em")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
    expect(r.code).toBe(src);
  });

  it('throws on multiple {...cas()} spreads on the same element', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().color("red")} {...cas().marginTop(10)} />;
    `;
    expect(() => transform(src, opts)).toThrow(/Multiple \{\.\.\.cas\(\)\} spreads/);
  });
});

describe('transform — modifiers (hover/focus/media/on)', () => {
  it('compiles a hover modifier into a scoped child', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <button {...cas().color('blue').hover(c => c.color('red'))} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(1);
    const rule = r.rules[0]!;
    expect(rule.tree.bag).toEqual({ color: 'blue' });
    expect(rule.tree.children).toHaveLength(1);
    const hover = rule.tree.children[0]!;
    expect(hover.scope).toEqual({ kind: 'pseudo', selector: ':hover' });
    expect(hover.bag).toEqual({ color: 'red' });
  });

  it('compiles a media modifier with explicit query argument', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <p {...cas().fontSize(14).media('(min-width: 768px)', c => c.fontSize(20))} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    const rule = r.rules[0]!;
    expect(rule.tree.children).toHaveLength(1);
    expect(rule.tree.children[0]!.scope).toEqual({
      kind: 'media',
      query: '(min-width: 768px)',
    });
    expect(rule.tree.children[0]!.bag).toEqual({ 'font-size': '20px' });
  });

  it('compiles nested modifiers (media inside hover)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () =>
        <button {...cas().hover(c => c.media('(min-width: 768px)', c2 => c2.color('red')))} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    const rule = r.rules[0]!;
    const hover = rule.tree.children[0]!;
    expect(hover.scope).toEqual({ kind: 'pseudo', selector: ':hover' });
    expect(hover.children).toHaveLength(1);
    const media = hover.children[0]!;
    expect(media.scope).toEqual({ kind: 'media', query: '(min-width: 768px)' });
    expect(media.bag).toEqual({ color: 'red' });
  });

  it('on() with a raw attribute selector becomes a raw scope', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () =>
        <div {...cas().on('[data-state="open"]', c => c.color('red'))} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.children[0]!.scope).toEqual({
      kind: 'raw',
      selector: '[data-state="open"]',
    });
  });

  it('on() with a pseudo-class selector becomes a pseudo scope', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <a {...cas().on(':visited', c => c.color('purple'))} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.children[0]!.scope).toEqual({
      kind: 'pseudo',
      selector: ':visited',
    });
  });

  it('shares className for two structurally identical hover chains regardless of value', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ a, b }: { a: string; b: string }) => (
        <div>
          <button {...cas().hover(c => c.color(a))} />
          <button {...cas().hover(c => c.color(b))} />
        </div>
      );
    `;
    const r = transform(src, opts);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.className).toBe(r.rules[1]!.className);
    expect(r.rules[0]!.dynamics).toHaveLength(1);
    expect(r.rules[0]!.dynamics[0]!.scopePath).toEqual([
      { kind: 'pseudo', selector: ':hover' },
    ]);
  });
});

describe('transform — path.evaluate() static evaluation', () => {
  it('evaluates simple constant arithmetic at build time', () => {
    const src = `
      import { cas } from '@cassida/core';
      const BASE = 8;
      export const App = () => <div {...cas().marginTop(BASE * 2, "px")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ 'margin-top': '16px' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('evaluates string concatenation at build time', () => {
    const src = `
      import { cas } from '@cassida/core';
      const PRIMARY = '#ff';
      export const App = () => <div {...cas().color(PRIMARY + '0000')} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ color: '#ff0000' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('falls back to dynamic when evaluation is not confident', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ c }: { c: string }) => <div {...cas().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.dynamics).toHaveLength(1);
  });

  it('refuses to evaluate side-effecting expressions (Math.random) and falls back to dynamic with a stable hash', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().opacity(Math.random())} />;
    `;
    const r1 = transform(src, opts);
    const r2 = transform(src, opts);
    expect(r1.transformed).toBe(true);
    expect(r1.rules[0]!.dynamics).toHaveLength(1);
    // The hash must be stable across builds — never derived from the
    // dynamic value itself, only from the chain's structure.
    expect(r1.rules[0]!.className).toBe(r2.rules[0]!.className);
  });

  it('Date.now() also stays dynamic and produces a deterministic class', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().marginTop(\`\${Date.now()}px\`)} />;
    `;
    const r1 = transform(src, opts);
    const r2 = transform(src, opts);
    expect(r1.rules[0]!.dynamics).toHaveLength(1);
    expect(r1.rules[0]!.className).toBe(r2.rules[0]!.className);
  });
});

describe('transform — cas(preset) safe injection', () => {
  it('expands a literal preset object into MethodOps before later chain ops', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas({ padding: 16, color: 'red' }).marginTop(10)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({
      padding: '16px',
      color: 'red',
      'margin-top': '10px',
    });
  });

  it('LIFO collapses preset values when the chain overrides them', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas({ padding: 10 }).padding(20)} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '20px' });
  });

  it('resolves a const-bound preset via path.evaluate', () => {
    const src = `
      import { cas } from '@cassida/core';
      const card = { padding: 12, borderRadius: 8 };
      export const App = () => <div {...cas(card).backgroundColor('#fff')} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      padding: '12px',
      'border-radius': '8px',
      'background-color': '#fff',
    });
  });

  it('bails (runtime fallback) when preset is non-confident', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ p }: { p: object }) => <div {...cas(p).color('red')} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('throws when preset contains a blacklisted shorthand (registry rejects)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas({ background: 'red' })} />;
    `;
    expect(() => transform(src, opts)).toThrow(/unknown method "background"/);
  });
});

describe('transform — cas.unsafe(preset) bypass', () => {
  it('expands an unsafe preset into RawOps that bypass the registry', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas.unsafe({ background: 'red' }).marginTop(10)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({
      background: 'red',
      'margin-top': '10px',
    });
  });

  it('camelCase keys are converted to kebab-case', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas.unsafe({ webkitTextFillColor: 'transparent' })} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      'webkit-text-fill-color': 'transparent',
    });
  });

  it('kebab-case keys (and vendor-prefixed) are passed through unchanged', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas.unsafe({ '-webkit-tap-highlight-color': 'transparent' })} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      '-webkit-tap-highlight-color': 'transparent',
    });
  });

  it('shorthand-policy does not apply to unsafe RawOps (deliberate by design)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas.unsafe({ padding: '5px 10px', paddingTop: '20px' })} />;
    `;
    // Unsafe writes go straight to the bag without registry/family
    // checks. The user opted out of the safety net.
    expect(() => transform(src, opts)).not.toThrow();
  });
});

describe('transform — .set(key, value) escape hatch', () => {
  it('emits a RawOp with kebab-case key and stringified value', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().set('paddingTop', '10px')} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ 'padding-top': '10px' });
  });

  it('produces the same className as the canonical method when value matches', () => {
    const a = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().paddingTop(10)} />;`,
      opts,
    );
    const b = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().set('padding-top', '10px')} />;`,
      opts,
    );
    expect(a.rules[0]!.className).toBe(b.rules[0]!.className);
  });

  it('camelCase and kebab-case keys both kebabize to the same bag key', () => {
    const camel = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().set('paddingTop', '10px')} />;`,
      opts,
    );
    const kebab = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().set('padding-top', '10px')} />;`,
      opts,
    );
    expect(camel.rules[0]!.className).toBe(kebab.rules[0]!.className);
  });

  it('numbers are passed through without unit conversion (raw contract)', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().set('--scale', 1.5)} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ '--scale': '1.5' });
  });

  it('vendor-prefixed and custom-property keys pass through', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().set('-webkit-tap-highlight-color', 'transparent').set('--brand', '#f0f')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({
      '-webkit-tap-highlight-color': 'transparent',
      '--brand': '#f0f',
    });
  });

  it('bails to runtime when key or value is non-confident', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = ({ k, v }: { k: string; v: string }) => <div {...cas().set(k, v)} />;`,
      opts,
    );
    expect(r.transformed).toBe(false);
  });
});

describe('transform — opaque shorthands (animation / transition / transform)', () => {
  it('transform accepts a full transform-list string', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().transform('rotate(2deg) scale(1.05)')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ transform: 'rotate(2deg) scale(1.05)' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('transition accepts a full shorthand string', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().transition('opacity .2s ease-out')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ transition: 'opacity .2s ease-out' });
  });

  it('transform is animatable (dynamic value emits @property)', () => {
    const r = transform(
      `import { cas } from '@cassida/core';
       export const A = ({ rot }: { rot: string }) => <div {...cas().transform(rot)} />;`,
      opts,
    );
    expect(r.rules[0]!.dynamics).toHaveLength(1);
    expect(r.rules[0]!.dynamics[0]!.property).toBe('transform');
    expect(r.rules[0]!.dynamics[0]!.animatable).toBe(true);
    expect(r.rules[0]!.dynamics[0]!.syntax).toBe('<transform-list>');
  });
});

describe('transform — function composition (Approach A, same-file)', () => {
  it('expands a 1-param arrow function applied to cas()', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withCard = (c) => c.padding(16).borderRadius(8);
      export const App = () => <div {...withCard(cas())} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '16px', 'border-radius': '8px' });
  });

  it('appends function ops after the chain feeds in (LIFO between input and mixin)', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withRed = (c) => c.color('red');
      export const App = () => <div {...withRed(cas().color('blue'))} />;
    `;
    const r = transform(src, opts);
    // input chain has color: blue, mixin overwrites to red. mixin is later → wins.
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
  });

  it('chains additional methods after the composition', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withCard = (c) => c.padding(16);
      export const App = () => <div {...withCard(cas()).marginTop(10)} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '16px', 'margin-top': '10px' });
  });

  it('supports nested compositions: withRed(withCard(cas()))', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withCard = (c) => c.padding(16).borderRadius(8);
      const withRed = (c) => c.color('red');
      export const App = () => <div {...withRed(withCard(cas()))} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      padding: '16px',
      'border-radius': '8px',
      color: 'red',
    });
  });

  it('supports block-body arrow function', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withCard = (c) => { return c.padding(16); };
      export const App = () => <div {...withCard(cas())} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '16px' });
  });

  it('supports FunctionDeclaration form', () => {
    const src = `
      import { cas } from '@cassida/core';
      function withCard(c) { return c.padding(16); }
      export const App = () => <div {...withCard(cas())} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '16px' });
  });

  it('mixins inside modifier callbacks compose correctly', () => {
    const src = `
      import { cas } from '@cassida/core';
      const withRed = (c) => c.color('red');
      export const App = () => <div {...cas().hover(c => withRed(c))} />;
    `;
    const r = transform(src, opts);
    const hover = r.rules[0]!.tree.children[0]!;
    expect(hover.scope).toEqual({ kind: 'pseudo', selector: ':hover' });
    expect(hover.bag).toEqual({ color: 'red' });
  });

  it('produces the same className regardless of inline vs composed authoring', () => {
    const inline = transform(
      `import { cas } from '@cassida/core';
       export const A = () => <div {...cas().padding(16).color('red')} />;`,
      opts,
    );
    const composed = transform(
      `import { cas } from '@cassida/core';
       const withRed = (c) => c.color('red');
       export const A = () => <div {...withRed(cas().padding(16))} />;`,
      opts,
    );
    expect(inline.rules[0]!.className).toBe(composed.rules[0]!.className);
  });

  it('bails on multi-param compositions', () => {
    const src = `
      import { cas } from '@cassida/core';
      const sized = (c, size) => c.fontSize(size);
      export const App = () => <div {...sized(cas(), 14)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('bails when the mixin body uses unsupported control flow', () => {
    const src = `
      import { cas } from '@cassida/core';
      const cond = (c) => { if (true) c.color('red'); return c; };
      export const App = () => <div {...cond(cas())} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('bails when the mixin is imported from another module (Phase 7)', () => {
    const src = `
      import { cas } from '@cassida/core';
      import { withCard } from './styles';
      export const App = () => <div {...withCard(cas())} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });
});

describe('transform — JSX surgery (style merge / className concat)', () => {
  it('concats existing string className with FSS hash', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div className="my-btn" {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/className=("|')my-btn cas-[0-9a-f]{8}\1/);
  });

  it('concats dynamic className expressions via template literal', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ x }: { x: string }) => <div className={x} {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    // Generated code uses a template literal: \`${x} fss-XXX\`
    expect(r.code).toMatch(/className=\{`\$\{x\} cas-[0-9a-f]{8}`\}/);
  });

  it('keeps existing user style when there are no dynamics and FSS does not conflict', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div style={{opacity:0.5}} {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/style=\{\{\s*opacity:\s*0\.5\s*\}\}/);
  });

  it('drops user static style key when FSS wins (spread is later)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div style={{color:"green"}} {...cas().color("red")} />;
    `;
    const r = transform(src, opts);
    // user's color: "green" should be dropped from the merged style;
    // since FSS color is static (not dynamic), no style attribute is needed at all
    expect(r.code).not.toMatch(/color:\s*"green"/);
    // but the className must carry the fss class
    expect(r.code).toMatch(/className=("|')cas-[0-9a-f]{8}\1/);
  });

  it('preserves user style when user wins (spread is earlier)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().color("red")} style={{color:"green"}} />;
    `;
    const r = transform(src, opts);
    // user's color: "green" survives because their style attr is later
    expect(r.code).toMatch(/style=\{\{\s*color:\s*"green"\s*\}\}/);
  });

  it('merges static user style with FSS dynamic vars', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ c }: { c: string }) => <div style={{opacity:0.5}} {...cas().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.code).toMatch(/opacity:\s*0\.5/);
    expect(r.code).toMatch(/"--cas-[0-9a-f]{8}-color":\s*c/);
  });
});
