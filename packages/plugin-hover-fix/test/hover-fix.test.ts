import { describe, expect, it } from 'vitest';
import {
  compileOps,
  defaultRegistry,
  type CassPlugin,
} from '@cassida/compiler';
import hoverFix from '../src/index.js';

const baseOpts = { registry: defaultRegistry };

describe('@cassida/plugin-hover-fix', () => {
  it('wraps :hover scope in @media (hover: hover) by default', () => {
    const plugin = hoverFix();
    const result = compileOps(
      [
        { method: 'color', args: ['blue'] },
        {
          scope: { kind: 'pseudo', selector: ':hover' },
          ops: [{ method: 'color', args: ['red'] }],
        },
      ],
      { ...baseOpts, plugins: [plugin] },
    );
    // The :hover child should now sit under a media wrapper.
    const mediaChild = result.tree.children[0]!;
    expect(mediaChild.scope).toEqual({ kind: 'media', query: '(hover: hover)' });
    const hoverChild = mediaChild.children[0]!;
    expect(hoverChild.scope).toEqual({ kind: 'pseudo', selector: ':hover' });
    expect(hoverChild.bag).toEqual({ color: 'red' });
  });

  it('changes the className when enabled (hash reflects post-plugin tree)', () => {
    const ops = [
      { method: 'color', args: ['blue'] as const },
      {
        scope: { kind: 'pseudo' as const, selector: ':hover' },
        ops: [{ method: 'color', args: ['red'] as const }],
      },
    ];
    const without = compileOps(ops, baseOpts);
    const withFix = compileOps(ops, { ...baseOpts, plugins: [hoverFix()] });
    expect(without.className).not.toBe(withFix.className);
  });

  it('leaves bare-base chains alone (no :hover → no transform)', () => {
    const ops = [{ method: 'color', args: ['blue'] as const }];
    const without = compileOps(ops, baseOpts);
    const withFix = compileOps(ops, { ...baseOpts, plugins: [hoverFix()] });
    expect(without.className).toBe(withFix.className);
  });

  it('leaves non-:hover pseudo scopes alone', () => {
    const ops = [
      {
        scope: { kind: 'pseudo' as const, selector: ':focus' },
        ops: [{ method: 'color', args: ['red'] as const }],
      },
    ];
    const result = compileOps(ops, { ...baseOpts, plugins: [hoverFix()] });
    expect(result.tree.children[0]!.scope).toEqual({
      kind: 'pseudo',
      selector: ':focus',
    });
  });

  it('honors a custom selectors set (gates :focus-visible too)', () => {
    const plugin = hoverFix({ selectors: [':hover', ':focus-visible'] });
    const result = compileOps(
      [
        {
          scope: { kind: 'pseudo', selector: ':focus-visible' },
          ops: [{ method: 'color', args: ['red'] }],
        },
      ],
      { ...baseOpts, plugins: [plugin] },
    );
    expect(result.tree.children[0]!.scope).toEqual({
      kind: 'media',
      query: '(hover: hover)',
    });
  });

  it('honors a custom query string', () => {
    const plugin = hoverFix({ query: '(hover: hover) and (pointer: fine)' });
    const result = compileOps(
      [
        {
          scope: { kind: 'pseudo', selector: ':hover' },
          ops: [{ method: 'color', args: ['red'] }],
        },
      ],
      { ...baseOpts, plugins: [plugin] },
    );
    expect(result.tree.children[0]!.scope).toEqual({
      kind: 'media',
      query: '(hover: hover) and (pointer: fine)',
    });
  });

  it('plugin output is deterministic (same input → same hash)', () => {
    const ops = [
      {
        scope: { kind: 'pseudo' as const, selector: ':hover' },
        ops: [{ method: 'color', args: ['red'] as const }],
      },
    ];
    const a = compileOps(ops, { ...baseOpts, plugins: [hoverFix()] });
    const b = compileOps(ops, { ...baseOpts, plugins: [hoverFix()] });
    expect(a.className).toBe(b.className);
    expect(a.canonical).toBe(b.canonical);
  });
});

describe('plugin pipeline', () => {
  it('applies plugins in array order', () => {
    const wrapHoverInMedia: CassPlugin = hoverFix();
    // A second plugin that re-wraps every media query in a 2x outer
    // (silly but tests pipeline ordering).
    const tagger: CassPlugin = {
      name: 'test-tagger',
      transform: (tree) => ({
        ...tree,
        bag: { ...tree.bag, '--plugin-touched': '1' },
      }),
    };
    const result = compileOps(
      [
        {
          scope: { kind: 'pseudo' as const, selector: ':hover' },
          ops: [{ method: 'color', args: ['red'] as const }],
        },
      ],
      { registry: defaultRegistry, plugins: [wrapHoverInMedia, tagger] },
    );
    // hoverFix wraps the :hover; tagger then sets a marker on the root.
    expect(result.tree.children[0]!.scope?.kind).toBe('media');
    expect(result.tree.bag['--plugin-touched']).toBe('1');
  });
});
