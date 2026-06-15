import { describe, expect, it } from 'vitest';
import { CssEmitter } from '../src/emitter.js';
import { compileOps } from '../src/compile.js';
import { defaultRegistry } from '../src/registry.js';
import type { Op } from '../src/types.js';

const compile = (ops: Op[]) => compileOps(ops, { registry: defaultRegistry });

/**
 * Decompose flattened CSS (emitted with `layer: null`) into a set of
 * `"<context-selector>|<prop:val>"` atoms — one per (single class,
 * single declaration) pairing. Grouped selectors are expanded and
 * declaration blocks split, so two outputs that assign the same
 * declarations to the same classes (regardless of how they group)
 * produce identical atom sets. Handles a single level of `@media`
 * nesting, which is all the emitter ever produces.
 */
function extractAtoms(css: string): Set<string> {
  const atoms = new Set<string>();
  const mediaSource = '@media\\s+([^{]+?)\\s*\\{((?:[^{}]+\\{[^{}]*\\})+)\\}';

  for (const m of css.matchAll(new RegExp(mediaSource, 'g'))) {
    addRules(atoms, m[2]!, `@media ${m[1]!.trim()} `);
  }
  const topLevel = css.replace(new RegExp(mediaSource, 'g'), '');
  addRules(atoms, topLevel, '');
  return atoms;
}

function addRules(atoms: Set<string>, block: string, prefix: string): void {
  for (const m of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    const decls = m[2]!.split(';').map((d) => d.trim()).filter(Boolean);
    for (const sel of selectors) {
      for (const decl of decls) atoms.add(`${prefix}${sel}|${decl}`);
    }
  }
}

const fixture: Op[][] = [
  [
    { method: 'color', args: ['red'] },
    { method: 'width', args: ['1px'] },
    { scope: { kind: 'pseudo', selector: ':hover' }, ops: [{ method: 'color', args: ['blue'] }] },
  ],
  [{ method: 'color', args: ['red'] }],
  [
    { method: 'top', args: ['0'] },
    { scope: { kind: 'media', query: '(min-width:768px)' }, ops: [{ method: 'color', args: ['green'] }] },
  ],
  [{ method: 'color', args: ['red'] }, { method: 'top', args: ['0'] }],
];

describe('rule-per-class vs shared-by-declaration semantic equivalence', () => {
  function emitBoth(): { rpc: string; sbd: string } {
    const rules = fixture.map(compile);
    const rpc = new CssEmitter({ mode: 'rule-per-class', layer: null });
    const sbd = new CssEmitter({ mode: 'shared-by-declaration', layer: null });
    for (const r of rules) {
      rpc.add(r);
      sbd.add(r);
    }
    return { rpc: rpc.emit(), sbd: sbd.emit() };
  }

  it('assigns the identical declaration set to each class in both modes', () => {
    const { rpc, sbd } = emitBoth();
    expect(extractAtoms(sbd)).toEqual(extractAtoms(rpc));
  });

  it('actually changes the output shape (shared mode groups selectors)', () => {
    const { rpc, sbd } = emitBoth();
    expect(sbd).not.toBe(rpc);
    // shared mode must produce at least one grouped (comma) selector
    expect(/\.[\w-]+,\.[\w-]+\{/.test(sbd)).toBe(true);
  });

  it('produces the same className set regardless of mode', () => {
    const rules = fixture.map(compile);
    const rpc = new CssEmitter({ mode: 'rule-per-class', layer: null });
    const sbd = new CssEmitter({ mode: 'shared-by-declaration', layer: null });
    for (const r of rules) {
      rpc.add(r);
      sbd.add(r);
    }
    expect([...sbd.classNames()].sort()).toEqual([...rpc.classNames()].sort());
  });
});
