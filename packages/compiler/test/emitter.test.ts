import { describe, expect, it } from 'vitest';
import { CssEmitter } from '../src/emitter.js';
import { compileOps } from '../src/compile.js';
import { defaultRegistry } from '../src/registry.js';
import { DYNAMIC_TAG, type Op, type CompiledRule } from '../src/types.js';

const compile = (ops: Op[]) => compileOps(ops, { registry: defaultRegistry });
const dyn = (id: string) => ({ [DYNAMIC_TAG]: true as const, id });

describe('CssEmitter', () => {
  it('emits empty string before any rules are added', () => {
    expect(new CssEmitter().emit()).toBe('');
  });

  it('wraps rules in @layer fss by default', () => {
    const e = new CssEmitter();
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.emit()).toMatch(/^@layer fss\{\.cas-[0-9a-f]{8}\{color:blue;?\}\}$/);
  });

  it('uses a custom layer name', () => {
    const e = new CssEmitter({ layer: 'app' });
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.emit().startsWith('@layer app{')).toBe(true);
  });

  it('skips the @layer wrap when layer is null', () => {
    const e = new CssEmitter({ layer: null });
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.emit()).toMatch(/^\.cas-[0-9a-f]{8}\{color:blue;?\}$/);
  });

  it('deduplicates identical rules across calls', () => {
    const e = new CssEmitter();
    const a = e.add(compile([{ method: 'color', args: ['red'] }]));
    const b = e.add(compile([{ method: 'color', args: ['red'] }]));
    expect(a).toBe(b);
    expect(e.size()).toBe(1);
  });

  it('keeps multiple distinct rules', () => {
    const e = new CssEmitter();
    e.add(compile([{ method: 'color', args: ['red'] }]));
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.size()).toBe(2);
    expect(e.classNames()).toHaveLength(2);
  });

  it('throws on a hash collision (different canonical, same className)', () => {
    const e = new CssEmitter();
    const real = compile([{ method: 'color', args: ['red'] }]);
    e.add(real);
    const forged: CompiledRule = {
      className: real.className,
      tree: {
        scope: null,
        bag: { color: 'green' },
        slots: {},
        children: [],
      },
      canonical: '[["color","green"]]',
      dynamics: [],
    };
    expect(() => e.add(forged)).toThrow(/hash collision/);
  });

  it('sorts declarations alphabetically by property within a rule', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { method: 'color', args: ['blue'] },
        { method: 'mt', args: [10, 'em'] },
        { method: 'bg', args: ['white'] },
      ]),
    );
    expect(e.emit()).toMatch(/\{background-color:white;color:blue;margin-top:10em;?\}/);
  });
});

describe('CssEmitter — dynamic values & @property', () => {
  it('emits @property for animatable dynamic slots, outside @layer', () => {
    const e = new CssEmitter();
    const rule = compile([{ method: 'color', args: [dyn('s0')] }]);
    e.add(rule);
    const out = e.emit();
    expect(out).toMatch(/^@property --cas-[0-9a-f]{8}-color\{[^}]+\}@layer fss\{/);
    expect(out).toContain('syntax:"<color>"');
    expect(out).toContain('inherits:false');
    expect(out).toContain('initial-value:transparent');
  });

  it('uses var() in the class rule for dynamic properties', () => {
    const e = new CssEmitter({ layer: null });
    const rule = compile([{ method: 'color', args: [dyn('s0')] }]);
    e.add(rule);
    const out = e.emit();
    expect(out).toMatch(/\.cas-[0-9a-f]{8}\{color:var\(--cas-[0-9a-f]{8}-color\);?\}/);
  });

  it('skips @property emission for non-animatable dynamic slots', () => {
    const e = new CssEmitter();
    e.add(compile([{ method: 'display', args: [dyn('s0')] }]));
    const out = e.emit();
    expect(out).not.toContain('@property');
    expect(e.propertyCount()).toBe(0);
  });

  it('deduplicates @property by var name across multiple adds', () => {
    const e = new CssEmitter();
    e.add(compile([{ method: 'color', args: [dyn('a')] }]));
    e.add(compile([{ method: 'color', args: [dyn('b')] }]));
    expect(e.propertyCount()).toBe(1);
  });

  it('emits a flat :hover rule for a scoped chain (via stylis)', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { method: 'color', args: ['blue'] },
        { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['red'] }] },
      ]),
    );
    const out = e.emit();
    expect(out).toMatch(/\.cas-[0-9a-f]{8}\{color:blue;?\}/);
    expect(out).toMatch(/\.cas-[0-9a-f]{8}:hover\{color:red;?\}/);
  });

  it('hoists @media blocks to top level when a class has them', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { method: 'fontSize', args: [14] },
        { scope: { kind: 'media', query: '(min-width: 768px)' }, ops: [{ method: 'fontSize', args: [20] }] },
      ]),
    );
    const out = e.emit();
    expect(out).toMatch(/\.cas-[0-9a-f]{8}\{font-size:14px;?\}/);
    expect(out).toMatch(/@media\s*\(min-width:\s*768px\)\{\.cas-[0-9a-f]{8}\{font-size:20px;?\}\}/);
  });

  it('sorts min-width media queries mobile-first by default (numeric ascending)', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { scope: { kind: 'media', query: '(min-width: 1024px)' }, ops: [{ method: 'fontSize', args: [24] }] },
        { scope: { kind: 'media', query: '(min-width: 480px)' }, ops: [{ method: 'fontSize', args: [16] }] },
        { scope: { kind: 'media', query: '(min-width: 768px)' }, ops: [{ method: 'fontSize', args: [20] }] },
      ]),
    );
    const out = e.emit();
    const i480 = out.indexOf('480px');
    const i768 = out.indexOf('768px');
    const i1024 = out.indexOf('1024px');
    expect(i480).toBeGreaterThanOrEqual(0);
    expect(i480).toBeLessThan(i768);
    expect(i768).toBeLessThan(i1024);
  });

  it('sorts max-width media queries mobile-first (numeric descending so smaller overrides)', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { scope: { kind: 'media', query: '(max-width: 480px)' }, ops: [{ method: 'fontSize', args: [12] }] },
        { scope: { kind: 'media', query: '(max-width: 1024px)' }, ops: [{ method: 'fontSize', args: [18] }] },
        { scope: { kind: 'media', query: '(max-width: 768px)' }, ops: [{ method: 'fontSize', args: [14] }] },
      ]),
    );
    const out = e.emit();
    const i480 = out.indexOf('480px');
    const i768 = out.indexOf('768px');
    const i1024 = out.indexOf('1024px');
    expect(i1024).toBeLessThan(i768);
    expect(i768).toBeLessThan(i480);
  });

  it('reverses min-width order under desktop-first', () => {
    const e = new CssEmitter({ layer: null, mediaSort: 'desktop-first' });
    e.add(
      compile([
        { scope: { kind: 'media', query: '(min-width: 480px)' }, ops: [{ method: 'fontSize', args: [16] }] },
        { scope: { kind: 'media', query: '(min-width: 1024px)' }, ops: [{ method: 'fontSize', args: [24] }] },
      ]),
    );
    const out = e.emit();
    expect(out.indexOf('1024px')).toBeLessThan(out.indexOf('480px'));
  });

  it('normalizes em / rem against px when sorting', () => {
    // 30em == 480px, 48em == 768px (at 16px base)
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { scope: { kind: 'media', query: '(min-width: 48em)' }, ops: [{ method: 'fontSize', args: [20] }] },
        { scope: { kind: 'media', query: '(min-width: 600px)' }, ops: [{ method: 'fontSize', args: [18] }] },
        { scope: { kind: 'media', query: '(min-width: 30em)' }, ops: [{ method: 'fontSize', args: [16] }] },
      ]),
    );
    const out = e.emit();
    // expected order: 30em (480), 600px, 48em (768)
    expect(out.indexOf('30em')).toBeLessThan(out.indexOf('600px'));
    expect(out.indexOf('600px')).toBeLessThan(out.indexOf('48em'));
  });

  it('places non-width media queries after width-based ones', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { scope: { kind: 'media', query: 'print' }, ops: [{ method: 'color', args: ['black'] }] },
        { scope: { kind: 'media', query: '(min-width: 768px)' }, ops: [{ method: 'fontSize', args: [20] }] },
      ]),
    );
    const out = e.emit();
    expect(out.indexOf('768px')).toBeLessThan(out.indexOf('print'));
  });

  it('flattens nested :hover inside @media', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        {
          scope: { kind: 'media', query: '(min-width: 768px)' },
          ops: [
            { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['red'] }] },
          ],
        },
      ]),
    );
    const out = e.emit();
    expect(out).toMatch(/@media\s*\(min-width:\s*768px\)\{\.cas-[0-9a-f]{8}:hover\{color:red;?\}\}/);
  });

  it('mixes static and dynamic declarations in the same rule', () => {
    const e = new CssEmitter({ layer: null });
    e.add(
      compile([
        { method: 'color', args: ['red'] },
        { method: 'marginTop', args: [dyn('s0')] },
      ]),
    );
    const out = e.emit();
    expect(out).toMatch(/color:red/);
    expect(out).toMatch(/margin-top:var\(--cas-[0-9a-f]{8}-margin-top\)/);
  });
});
