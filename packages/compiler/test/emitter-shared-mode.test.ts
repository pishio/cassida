import { describe, expect, it } from 'vitest';
import { CssEmitter } from '../src/emitter.js';
import { compileOps } from '../src/compile.js';
import { defaultRegistry } from '../src/registry.js';
import type { Op } from '../src/types.js';

const compile = (ops: Op[]) => compileOps(ops, { registry: defaultRegistry });
const compileLenient = (ops: Op[]) =>
  compileOps(ops, { registry: defaultRegistry, shorthandPolicy: 'lenient' });

// Tests emit with `layer: null` so assertions match the bare flattened
// rules without the `@layer cas{...}` wrapper.
function shared(): CssEmitter {
  return new CssEmitter({ mode: 'shared-by-declaration', layer: null });
}

function groupedSelector(...classes: string[]): string {
  return [...classes].sort().map((c) => `.${c}`).join(',');
}

describe('shared-by-declaration: root declaration grouping', () => {
  it('folds a declaration shared by 3 classes into one grouped selector', () => {
    const e = shared();
    // three distinct classes (distinguished by width) that all carry
    // color:red in their root bag.
    const a = e.add(compile([{ method: 'color', args: ['red'] }, { method: 'width', args: ['1px'] }]));
    const b = e.add(compile([{ method: 'color', args: ['red'] }, { method: 'width', args: ['2px'] }]));
    const c = e.add(compile([{ method: 'color', args: ['red'] }, { method: 'width', args: ['3px'] }]));
    const css = e.emit();

    // stylis terminates declarations with `;`, so assert on the
    // selector + declaration prefix rather than the exact closing brace.
    expect(css).toContain(`${groupedSelector(a, b, c)}{color:red`);
    // the distinguishing widths stay per-class (singleton groups)
    expect(css).toContain(`.${a}{width:1px`);
    expect(css).toContain(`.${b}{width:2px`);
    expect(css).toContain(`.${c}{width:3px`);
  });

  it('emits a singleton declaration as a single-class rule', () => {
    const e = shared();
    const a = e.add(compile([{ method: 'color', args: ['red'] }]));
    expect(e.emit()).toMatch(new RegExp(`^\\.${a}\\{color:red;?\\}$`));
  });

  it('emits shorthand before longhand so the longhand still wins', () => {
    // Regression: sorting the raw "prop:val" keys would place
    // `padding-top` before `padding` ('-' < ':'), letting the shorthand
    // override the longhand. The grouped output must keep the same
    // property order as rule-per-class.
    const e = shared();
    e.add(compileLenient([
      { method: 'padding', args: ['8px'] },
      { method: 'paddingTop', args: ['4px'] },
    ]));
    const css = e.emit();
    expect(css.indexOf('padding:8px')).toBeLessThan(css.indexOf('padding-top:4px'));
  });

  it('is independent of class insertion order', () => {
    const mk = () => [
      compile([{ method: 'color', args: ['red'] }, { method: 'width', args: ['1px'] }]),
      compile([{ method: 'color', args: ['red'] }, { method: 'width', args: ['2px'] }]),
    ];
    const e1 = shared();
    const [r1a, r1b] = mk();
    e1.add(r1a!);
    e1.add(r1b!);
    const e2 = shared();
    const [r2a, r2b] = mk();
    e2.add(r2b!);
    e2.add(r2a!);
    expect(e1.emit()).toBe(e2.emit());
  });
});

describe('shared-by-declaration: modifier scopes stay per-class', () => {
  it('groups the root but keeps :hover on its own class', () => {
    const e = shared();
    const a = e.add(
      compile([
        { method: 'color', args: ['red'] },
        { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['blue'] }] },
      ]),
    );
    const b = e.add(compile([{ method: 'color', args: ['red'] }]));
    const css = e.emit();

    // root color:red is grouped across both classes
    expect(css).toContain(`${groupedSelector(a, b)}{color:red`);
    // the hover is per-class, and lands after the grouped base rule
    expect(css).toContain(`.${a}:hover{color:blue`);
    expect(css.indexOf(`{color:red`)).toBeLessThan(css.indexOf(`.${a}:hover`));
    // b has no hover
    expect(css).not.toContain(`.${b}:hover`);
  });

  it('keeps @media per-class while grouping the root', () => {
    const e = shared();
    const a = e.add(
      compile([
        { method: 'color', args: ['red'] },
        {
          scope: { kind: 'media', query: '(min-width:768px)' },
          ops: [{ method: 'color', args: ['green'] }],
        },
      ]),
    );
    const b = e.add(compile([{ method: 'color', args: ['red'] }]));
    const css = e.emit();

    expect(css).toContain(`${groupedSelector(a, b)}{color:red`);
    expect(css).toContain('@media (min-width:768px)');
    expect(css).toContain(`.${a}{color:green`);
  });
});

describe('shared-by-declaration: empty / property-only', () => {
  it('returns empty string with no rules', () => {
    expect(shared().emit()).toBe('');
  });
});
