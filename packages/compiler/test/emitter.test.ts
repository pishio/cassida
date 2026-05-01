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
    expect(e.emit()).toMatch(/^@layer fss\{\.fss-[0-9a-f]{8}\{color:blue\}\}$/);
  });

  it('uses a custom layer name', () => {
    const e = new CssEmitter({ layer: 'app' });
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.emit().startsWith('@layer app{')).toBe(true);
  });

  it('skips the @layer wrap when layer is null', () => {
    const e = new CssEmitter({ layer: null });
    e.add(compile([{ method: 'color', args: ['blue'] }]));
    expect(e.emit()).toMatch(/^\.fss-[0-9a-f]{8}\{color:blue\}$/);
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
      bag: { color: 'green' },
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
    expect(e.emit()).toMatch(/\{background-color:white;color:blue;margin-top:10em\}/);
  });
});

describe('CssEmitter — dynamic values & @property', () => {
  it('emits @property for animatable dynamic slots, outside @layer', () => {
    const e = new CssEmitter();
    const rule = compile([{ method: 'color', args: [dyn('s0')] }]);
    e.add(rule);
    const out = e.emit();
    expect(out).toMatch(/^@property --fss-[0-9a-f]{8}-color\{[^}]+\}@layer fss\{/);
    expect(out).toContain('syntax:"<color>"');
    expect(out).toContain('inherits:false');
    expect(out).toContain('initial-value:transparent');
  });

  it('uses var() in the class rule for dynamic properties', () => {
    const e = new CssEmitter({ layer: null });
    const rule = compile([{ method: 'color', args: [dyn('s0')] }]);
    e.add(rule);
    const out = e.emit();
    expect(out).toMatch(/\.fss-[0-9a-f]{8}\{color:var\(--fss-[0-9a-f]{8}-color\)\}/);
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
    expect(out).toMatch(/margin-top:var\(--fss-[0-9a-f]{8}-margin-top\)/);
  });
});
