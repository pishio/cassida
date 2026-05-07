/**
 * Cross-file static evaluator tests.
 *
 * Each case writes a small fixture to a temp directory, runs the
 * parser against the consumer file, and inspects the emitted code +
 * compiled rules to confirm whether the imported value was folded at
 * build time or fell through to runtime.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform } from '../src/index.js';
import { defaultRegistry } from '@cassida/compiler';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cassida-cf-eval-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const writeFile = (rel: string, contents: string): string => {
  const full = join(dir, rel);
  const last = full.lastIndexOf('/');
  if (last > 0) {
    mkdirSync(full.slice(0, last), { recursive: true });
  }
  writeFileSync(full, contents);
  return full;
};

const compile = (consumerSource: string, consumerName = 'component.tsx') => {
  const filename = writeFile(consumerName, consumerSource);
  return transform(consumerSource, {
    registry: defaultRegistry,
    filename,
  });
};

describe('cross-file static evaluation', () => {
  it('folds a string literal export', () => {
    writeFile('theme.ts', `export const PRIMARY = '#3b82f6';`);
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY } from './theme';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `);
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('folds nested object member access', () => {
    writeFile(
      'theme.ts',
      `export const theme = {
        brand: { primary: '#3b82f6', secondary: '#10b981' },
        spacing: { md: 16, lg: 24 },
      };`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { theme } from './theme';
      export const X = () =>
        <div {...cas().color(theme.brand.primary).padding(theme.spacing.md)} />;
    `);
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag.padding).toBe('16px');
  });

  it('folds default exports', () => {
    writeFile('tokens.ts', `export default { brand: '#3b82f6' };`);
    const r = compile(`
      import { cas } from '@cassida/core';
      import tokens from './tokens';
      export const X = () => <div {...cas().color(tokens.brand)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('folds namespace imports', () => {
    writeFile('tokens.ts', `
      export const brand = '#3b82f6';
      export const accent = '#10b981';
    `);
    const r = compile(`
      import { cas } from '@cassida/core';
      import * as tokens from './tokens';
      export const X = () => <div {...cas().color(tokens.brand)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('follows re-export chains', () => {
    writeFile('source.ts', `export const C = '#3b82f6';`);
    writeFile('barrel.ts', `export { C as PRIMARY } from './source';`);
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY } from './barrel';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('follows export-* chains', () => {
    writeFile('source.ts', `export const C = '#3b82f6';`);
    writeFile('barrel.ts', `export * from './source';`);
    const r = compile(`
      import { cas } from '@cassida/core';
      import { C } from './barrel';
      export const X = () => <div {...cas().color(C)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('resolves directory imports via index.ts', () => {
    writeFile('theme/index.ts', `export const C = '#3b82f6';`);
    const r = compile(`
      import { cas } from '@cassida/core';
      import { C } from './theme';
      export const X = () => <div {...cas().color(C)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('unwraps `as const` and `satisfies` annotations', () => {
    writeFile(
      'theme.ts',
      `export const theme = {
        brand: '#3b82f6',
      } as const;
      export const tokens = {
        s: 8,
      } satisfies Record<string, number>;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { theme, tokens } from './theme';
      export const X = () =>
        <div {...cas().color(theme.brand).padding(tokens.s)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag.padding).toBe('8px');
  });

  it('falls back to dynamic for function-call results', () => {
    writeFile(
      'tokens.ts',
      `export const brand = (() => '#3b82f6')();`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { brand } from './tokens';
      export const X = () => <div {...cas().color(brand)} />;
    `);
    // Function-call IIFE is not statically resolvable — chain becomes
    // a dynamic slot.
    expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
  });

  it('falls back when an import points outside resolvable extensions', () => {
    // No fixture file at all.
    const r = compile(`
      import { cas } from '@cassida/core';
      import { brand } from './does-not-exist';
      export const X = () => <div {...cas().color(brand)} />;
    `);
    expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
  });

  it('handles circular imports without exploding', () => {
    writeFile('a.ts', `
      import { B } from './b';
      export const A = '#3b82f6';
      export const FROM_B = B;
    `);
    writeFile('b.ts', `
      import { A } from './a';
      export const B = '#10b981';
      export const FROM_A = A;
    `);
    // Direct (non-circular) usage works.
    const r = compile(`
      import { cas } from '@cassida/core';
      import { A } from './a';
      export const X = () => <div {...cas().color(A)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('rejects bare-package specifiers (no node_modules walk)', () => {
    const r = compile(`
      import { cas } from '@cassida/core';
      import { brand } from 'some-theme-package';
      export const X = () => <div {...cas().color(brand)} />;
    `);
    expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
  });

  it('respects an explicit disable flag', () => {
    writeFile('theme.ts', `export const PRIMARY = '#3b82f6';`);
    const filename = join(dir, 'component.tsx');
    const consumer = `
      import { cas } from '@cassida/core';
      import { PRIMARY } from './theme';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `;
    writeFileSync(filename, consumer);
    const r = transform(consumer, {
      registry: defaultRegistry,
      filename,
      crossFileEvaluation: false,
    });
    // With the evaluator disabled, the import becomes a dynamic slot.
    expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
  });

  it('folds destructured object-pattern exports', () => {
    writeFile(
      'tokens.ts',
      `const colors = { primary: '#3b82f6', accent: '#10b981' };
       export const { primary, accent } = colors;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { primary, accent } from './tokens';
      export const X = () =>
        <div {...cas().color(primary).backgroundColor(accent)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag['background-color']).toBe('#10b981');
  });

  it('folds destructured object-pattern with rename', () => {
    writeFile(
      'tokens.ts',
      `const palette = { brand: '#3b82f6' };
       export const { brand: PRIMARY } = palette;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY } from './tokens';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('folds destructured array-pattern exports', () => {
    writeFile(
      'tokens.ts',
      `const palette = ['#3b82f6', '#10b981'];
       export const [PRIMARY, ACCENT] = palette;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY, ACCENT } from './tokens';
      export const X = () =>
        <div {...cas().color(PRIMARY).backgroundColor(ACCENT)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag['background-color']).toBe('#10b981');
  });

  it('folds nested destructure patterns', () => {
    writeFile(
      'tokens.ts',
      `const t = { brand: { primary: '#3b82f6' } };
       export const { brand: { primary } } = t;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { primary } from './tokens';
      export const X = () => <div {...cas().color(primary)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('namespace import tolerates unresolvable peer exports', () => {
    // The theme file mixes a literal token with a function helper.
    // Accessing the literal must still fold, even though the helper
    // can never be statically evaluated.
    writeFile(
      'theme.ts',
      `export const PRIMARY = '#3b82f6';
       export const helper = () => 'computed';`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import * as theme from './theme';
      export const X = () => <div {...cas().color(theme.PRIMARY)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.dynamics).toHaveLength(0);
  });

  it('folds JSON imports', () => {
    writeFile(
      'tokens.json',
      JSON.stringify({ brand: { primary: '#3b82f6' }, spacing: { md: 16 } }),
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import tokens from './tokens.json';
      export const X = () =>
        <div {...cas().color(tokens.brand.primary).padding(tokens.spacing.md)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag.padding).toBe('16px');
  });

  it('handles JSON keys that are not valid JS identifiers', () => {
    // Hyphens, leading digits, and spaces are legal JSON keys but
    // illegal as bare JS identifiers — `t.identifier(k)` would throw.
    writeFile(
      'tokens.json',
      JSON.stringify({
        'brand-primary': '#3b82f6',
        '2xl': '24px',
        'gap small': '8px',
      }),
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import tokens from './tokens.json';
      export const X = () =>
        <div {...cas().color(tokens["brand-primary"]).fontSize(tokens["2xl"]).gap(tokens["gap small"])} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
    expect(r.rules[0]!.tree.bag['font-size']).toBe('24px');
    expect(r.rules[0]!.tree.bag.gap).toBe('8px');
  });

  it('folds JSON imports via named import (top-level keys)', () => {
    writeFile('tokens.json', JSON.stringify({ PRIMARY: '#3b82f6' }));
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY } from './tokens.json';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('resolves destructured locals re-exported via `export { x }`', () => {
    writeFile(
      'theme.ts',
      `const palette = { primary: '#3b82f6' };
       const { primary } = palette;
       export { primary };`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { primary } from './theme';
      export const X = () => <div {...cas().color(primary)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('rejects ambiguous export-* re-exports as UNRESOLVED', () => {
    // ESM rule: a name re-exported by more than one star source is
    // ambiguous and crashes the consumer at import time. The
    // evaluator must NOT silently pick a winner — that would fold a
    // value the consumer can't actually access at runtime.
    writeFile('a.ts', `export const SHARED = 'from-a';`);
    writeFile('b.ts', `export const SHARED = 'from-b';`);
    writeFile(
      'barrel.ts',
      `export * from './a';\nexport * from './b';`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { SHARED } from './barrel';
      export const X = () => <div {...cas().color(SHARED)} />;
    `);
    expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
  });

  it('reuses a passed module cache across calls', async () => {
    writeFile('theme.ts', `export const PRIMARY = '#3b82f6';`);
    const { createModuleCache } = await import('../src/index.js');
    const cache = createModuleCache();

    const filename = join(dir, 'a.tsx');
    const consumer = `
      import { cas } from '@cassida/core';
      import { PRIMARY } from './theme';
      export const X = () => <div {...cas().color(PRIMARY)} />;
    `;
    writeFileSync(filename, consumer);
    transform(consumer, {
      registry: defaultRegistry,
      filename,
      crossFileEvaluation: { cache },
    });
    transform(consumer, {
      registry: defaultRegistry,
      filename,
      crossFileEvaluation: { cache },
    });
    expect(cache.size).toBeGreaterThan(0);
  });
});
