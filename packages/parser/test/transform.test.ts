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
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('LIFO-collapses chains so output bag matches the last write', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().color("red").color("blue")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'blue' });
  });

  it('honors renamed imports', () => {
    const src = `
      import { fss as ff } from '@fss/core';
      export const App = () => <div {...ff().color("red")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ color: 'red' });
  });

  it('handles negative numeric literals', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().marginTop(-10, "em")} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ 'margin-top': '-10em' });
  });

  it('handles plain template literals (no interpolation)', () => {
    const src = [
      "import { fss } from '@fss/core';",
      'export const App = () => <div {...fss().color(`red`)} />;',
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

describe('transform — modifiers (hover/focus/media/on)', () => {
  it('compiles a hover modifier into a scoped child', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <button {...fss().color('blue').hover(c => c.color('red'))} />;
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
      import { fss } from '@fss/core';
      export const App = () => <p {...fss().fontSize(14).media('(min-width: 768px)', c => c.fontSize(20))} />;
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
      import { fss } from '@fss/core';
      export const App = () =>
        <button {...fss().hover(c => c.media('(min-width: 768px)', c2 => c2.color('red')))} />;
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
      import { fss } from '@fss/core';
      export const App = () =>
        <div {...fss().on('[data-state="open"]', c => c.color('red'))} />;
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
      import { fss } from '@fss/core';
      export const App = () => <a {...fss().on(':visited', c => c.color('purple'))} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.children[0]!.scope).toEqual({
      kind: 'pseudo',
      selector: ':visited',
    });
  });

  it('shares className for two structurally identical hover chains regardless of value', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ a, b }: { a: string; b: string }) => (
        <div>
          <button {...fss().hover(c => c.color(a))} />
          <button {...fss().hover(c => c.color(b))} />
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
      import { fss } from '@fss/core';
      const BASE = 8;
      export const App = () => <div {...fss().marginTop(BASE * 2, "px")} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ 'margin-top': '16px' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('evaluates string concatenation at build time', () => {
    const src = `
      import { fss } from '@fss/core';
      const PRIMARY = '#ff';
      export const App = () => <div {...fss().color(PRIMARY + '0000')} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ color: '#ff0000' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('falls back to dynamic when evaluation is not confident', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = ({ c }: { c: string }) => <div {...fss().color(c)} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.dynamics).toHaveLength(1);
  });

  it('refuses to evaluate side-effecting expressions (Math.random) and falls back to dynamic with a stable hash', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().opacity(Math.random())} />;
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
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().marginTop(\`\${Date.now()}px\`)} />;
    `;
    const r1 = transform(src, opts);
    const r2 = transform(src, opts);
    expect(r1.rules[0]!.dynamics).toHaveLength(1);
    expect(r1.rules[0]!.className).toBe(r2.rules[0]!.className);
  });
});

describe('transform — fss(preset) safe injection', () => {
  it('expands a literal preset object into MethodOps before later chain ops', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss({ padding: 16, color: 'red' }).marginTop(10)} />;
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
      import { fss } from '@fss/core';
      export const App = () => <div {...fss({ padding: 10 }).padding(20)} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({ padding: '20px' });
  });

  it('resolves a const-bound preset via path.evaluate', () => {
    const src = `
      import { fss } from '@fss/core';
      const card = { padding: 12, borderRadius: 8 };
      export const App = () => <div {...fss(card).backgroundColor('#fff')} />;
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
      import { fss } from '@fss/core';
      export const App = ({ p }: { p: object }) => <div {...fss(p).color('red')} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(false);
  });

  it('throws when preset contains a blacklisted shorthand (registry rejects)', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss({ background: 'red' })} />;
    `;
    expect(() => transform(src, opts)).toThrow(/unknown method "background"/);
  });
});

describe('transform — fss.unsafe(preset) bypass', () => {
  it('expands an unsafe preset into RawOps that bypass the registry', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss.unsafe({ background: 'red' }).marginTop(10)} />;
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
      import { fss } from '@fss/core';
      export const App = () => <div {...fss.unsafe({ webkitTextFillColor: 'transparent' })} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      'webkit-text-fill-color': 'transparent',
    });
  });

  it('kebab-case keys (and vendor-prefixed) are passed through unchanged', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss.unsafe({ '-webkit-tap-highlight-color': 'transparent' })} />;
    `;
    const r = transform(src, opts);
    expect(r.rules[0]!.tree.bag).toEqual({
      '-webkit-tap-highlight-color': 'transparent',
    });
  });

  it('shorthand-policy does not apply to unsafe RawOps (deliberate by design)', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss.unsafe({ padding: '5px 10px', paddingTop: '20px' })} />;
    `;
    // Unsafe writes go straight to the bag without registry/family
    // checks. The user opted out of the safety net.
    expect(() => transform(src, opts)).not.toThrow();
  });
});

describe('transform — .set(key, value) escape hatch', () => {
  it('emits a RawOp with kebab-case key and stringified value', () => {
    const src = `
      import { fss } from '@fss/core';
      export const App = () => <div {...fss().set('paddingTop', '10px')} />;
    `;
    const r = transform(src, opts);
    expect(r.transformed).toBe(true);
    expect(r.rules[0]!.tree.bag).toEqual({ 'padding-top': '10px' });
  });

  it('produces the same className as the canonical method when value matches', () => {
    const a = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().paddingTop(10)} />;`,
      opts,
    );
    const b = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().set('padding-top', '10px')} />;`,
      opts,
    );
    expect(a.rules[0]!.className).toBe(b.rules[0]!.className);
  });

  it('camelCase and kebab-case keys both kebabize to the same bag key', () => {
    const camel = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().set('paddingTop', '10px')} />;`,
      opts,
    );
    const kebab = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().set('padding-top', '10px')} />;`,
      opts,
    );
    expect(camel.rules[0]!.className).toBe(kebab.rules[0]!.className);
  });

  it('numbers are passed through without unit conversion (raw contract)', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().set('--scale', 1.5)} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ '--scale': '1.5' });
  });

  it('vendor-prefixed and custom-property keys pass through', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().set('-webkit-tap-highlight-color', 'transparent').set('--brand', '#f0f')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({
      '-webkit-tap-highlight-color': 'transparent',
      '--brand': '#f0f',
    });
  });

  it('bails to runtime when key or value is non-confident', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = ({ k, v }: { k: string; v: string }) => <div {...fss().set(k, v)} />;`,
      opts,
    );
    expect(r.transformed).toBe(false);
  });
});

describe('transform — opaque shorthands (animation / transition / transform)', () => {
  it('transform accepts a full transform-list string', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().transform('rotate(2deg) scale(1.05)')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ transform: 'rotate(2deg) scale(1.05)' });
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('transition accepts a full shorthand string', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = () => <div {...fss().transition('opacity .2s ease-out')} />;`,
      opts,
    );
    expect(r.rules[0]!.tree.bag).toEqual({ transition: 'opacity .2s ease-out' });
  });

  it('transform is animatable (dynamic value emits @property)', () => {
    const r = transform(
      `import { fss } from '@fss/core';
       export const A = ({ rot }: { rot: string }) => <div {...fss().transform(rot)} />;`,
      opts,
    );
    expect(r.rules[0]!.dynamics).toHaveLength(1);
    expect(r.rules[0]!.dynamics[0]!.property).toBe('transform');
    expect(r.rules[0]!.dynamics[0]!.animatable).toBe(true);
    expect(r.rules[0]!.dynamics[0]!.syntax).toBe('<transform-list>');
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
