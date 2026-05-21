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

  it('does not pollute Object.prototype on `__proto__` keys in theme', () => {
    // The theme object intentionally carries a `__proto__` key that
    // would mutate the prototype chain on a normal object literal.
    // The evaluator should treat it as an ordinary own property and
    // still fold the sibling key correctly.
    writeFile(
      'theme.ts',
      `export const theme = { __proto__: 'sneaky', primary: '#3b82f6' };`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { theme } from './theme';
      export const X = () => <div {...cas().color(theme.primary)} />;
    `);
    expect(r.rules[0]!.tree.bag.color).toBe('#3b82f6');
  });

  it('parses theme files using `import ... with { type: "json" }`', () => {
    // The theme file pulls a JSON dataset via stage-4 import
    // attributes. Without the `importAttributes` Babel plugin, this
    // would silently fail to parse and the chain would bail.
    writeFile('data.json', JSON.stringify({ primary: '#3b82f6' }));
    writeFile(
      'theme.ts',
      `import data from './data.json' with { type: 'json' };\nexport const PRIMARY = data.primary;`,
    );
    const r = compile(`
      import { cas } from '@cassida/core';
      import { PRIMARY } from './theme';
      export const X = () => <div {...cas().color(PRIMARY)} />;
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

  describe('path aliases', () => {
    it('resolves `@/*`-style specifiers against the configured target', () => {
      writeFile('src/tokens.ts', `export const BRAND = '#1a73e8';`);
      const filename = writeFile(
        'src/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { BRAND } from '@/tokens';
        export const X = () => <div {...cas().color(BRAND)} />;
      `,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { BRAND } from '@/tokens';
        export const X = () => <div {...cas().color(BRAND)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          pathAliases: { '@/*': join(dir, 'src', '*') },
        },
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(1);
      expect(r.rules[0]!.tree.bag.color).toBe('#1a73e8');
      expect(r.rules[0]!.dynamics).toHaveLength(0);
    });

    it('tries multiple targets in declaration order and picks the first hit', () => {
      writeFile('lib/colors.ts', `export const ACCENT = '#10b981';`);
      const filename = writeFile(
        'src/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { ACCENT } from '~tokens/colors';
        export const X = () => <div {...cas().color(ACCENT)} />;
      `,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { ACCENT } from '~tokens/colors';
        export const X = () => <div {...cas().color(ACCENT)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          // First target won't resolve (the file isn't there); second
          // target wins. Mirrors how `paths` arrays fall through.
          pathAliases: {
            '~tokens/*': [join(dir, 'missing', '*'), join(dir, 'lib', '*')],
          },
        },
      );
      expect(r.transformed).toBe(true);
      expect(r.rules[0]!.tree.bag.color).toBe('#10b981');
    });

    it('rejects a specifier shorter than the pattern prefix + suffix', () => {
      // Pattern `a*a` requires at least 2 characters; a single-char
      // specifier `a` would have made `startsWith('a')` and
      // `endsWith('a')` both true with an empty capture under a naive
      // implementation, silently picking up the wrong target.
      const filename = writeFile(
        'src/a.ts',
        `export const X = '#deadbe';`,
      );
      writeFile(
        'src/a.ts',
        `export const X = '#deadbe';`,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { X } from 'a';
        export const App = () => <div {...cas().color(X)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          // Pattern needs at least one char between the two 'a's.
          pathAliases: { 'a*a': join(dir, 'src', '*.ts') },
        },
      );
      // The chain bails because `a` doesn't match `a*a` and there's
      // no other resolver path; the import stays as-is and the chain
      // falls through to runtime.
      expect(r.rules[0]?.dynamics.length ?? 0).toBeGreaterThan(0);
    });

    it('preserves a literal `$` in the captured wildcard segment', () => {
      // A theoretical specifier like `@/foo$bar` would corrupt the
      // substituted path if the resolver used `String.replace` (which
      // treats `$` as a back-reference). We use split/join, so the
      // capture is preserved verbatim.
      writeFile('src/foo$bar.ts', `export const C = '#9333ea';`);
      const filename = writeFile(
        'src/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { C } from '@/foo$bar';
        export const X = () => <div {...cas().color(C)} />;
      `,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { C } from '@/foo$bar';
        export const X = () => <div {...cas().color(C)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          pathAliases: { '@/*': join(dir, 'src', '*') },
        },
      );
      expect(r.transformed).toBe(true);
      expect(r.rules[0]!.tree.bag.color).toBe('#9333ea');
    });

    it('supports an exact (no-wildcard) alias', () => {
      writeFile('shared/index.ts', `export const FG = '#ff5500';`);
      const filename = writeFile(
        'app/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { FG } from 'shared';
        export const X = () => <div {...cas().color(FG)} />;
      `,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { FG } from 'shared';
        export const X = () => <div {...cas().color(FG)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          pathAliases: { shared: join(dir, 'shared') },
        },
      );
      expect(r.transformed).toBe(true);
      expect(r.rules[0]!.tree.bag.color).toBe('#ff5500');
    });

    it('falls back to dynamic when no alias matches the specifier', () => {
      writeFile('src/tokens.ts', `export const C = '#aaa';`);
      const filename = writeFile(
        'src/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { C } from '@/tokens';
        export const X = ({c}: {c: string}) => <div {...cas().color(c)} />;
      `,
      );
      // Path alias provided but the user's chain doesn't use the
      // imported binding — uses a runtime variable. The chain stays
      // dynamic; the alias change doesn't fold what wasn't foldable.
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { C } from '@/tokens';
        export const X = ({c}: {c: string}) => <div {...cas().color(c)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          pathAliases: { '@/*': join(dir, 'src', '*') },
        },
      );
      expect(r.transformed).toBe(true);
      expect(r.rules[0]!.dynamics.length).toBeGreaterThan(0);
    });

    it('aliased imports work transitively (alias → file → re-export)', () => {
      writeFile('src/raw.ts', `export const PRIMARY = '#7c3aed';`);
      writeFile(
        'src/tokens.ts',
        `export { PRIMARY } from './raw';`,
      );
      const filename = writeFile(
        'src/component.tsx',
        `
        import { cas } from '@cassida/core';
        import { PRIMARY } from '@/tokens';
        export const X = () => <div {...cas().color(PRIMARY)} />;
      `,
      );
      const r = transform(
        `
        import { cas } from '@cassida/core';
        import { PRIMARY } from '@/tokens';
        export const X = () => <div {...cas().color(PRIMARY)} />;
      `,
        {
          registry: defaultRegistry,
          filename,
          pathAliases: { '@/*': join(dir, 'src', '*') },
        },
      );
      expect(r.rules[0]!.tree.bag.color).toBe('#7c3aed');
      expect(r.rules[0]!.dynamics).toHaveLength(0);
    });
  });

  describe('loadTsconfigPaths', () => {
    it('reads compilerOptions.paths and resolves targets against baseUrl', async () => {
      writeFile(
        'tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@/*': ['src/*'], '#util': ['lib/util'] },
          },
        }),
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      expect(aliases!['@/*']).toEqual([join(dir, 'src/*')]);
      expect(aliases!['#util']).toEqual([join(dir, 'lib/util')]);
    });

    it('strips JSONC comments and trailing commas', async () => {
      writeFile(
        'tsconfig.json',
        `{
          // user-facing app config
          "compilerOptions": {
            /* monorepo root keeps baseUrl explicit */
            "baseUrl": ".",
            "paths": {
              "@/*": ["src/*"],
            },
          },
        }`,
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      expect(aliases!['@/*']).toEqual([join(dir, 'src/*')]);
    });

    it('returns null when no tsconfig is found', async () => {
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).toBeNull();
    });

    it('returns null when tsconfig has no paths', async () => {
      writeFile(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { baseUrl: '.' } }),
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).toBeNull();
    });

    it('preserves `//` and `/*` inside JSON string values when stripping comments', async () => {
      // String values that look like comment markers — a paths entry
      // with `/*` in its target would otherwise get truncated. A URL
      // string in a hypothetical field would too.
      writeFile(
        'tsconfig.json',
        `{
          "compilerOptions": {
            "baseUrl": ".",
            "paths": {
              "@/*": ["src/*"]
            }
          },
          "docsHomepage": "http://example.com",
          "buildBanner": "/* generated — do not edit */"
        }`,
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      expect(aliases!['@/*']).toEqual([join(dir, 'src/*')]);
    });

    it('preserves trailing-comma-shaped substrings inside string values', async () => {
      // A bracket-like character inside a string after a comma must
      // not trigger trailing-comma elision.
      writeFile(
        'tsconfig.json',
        `{
          "compilerOptions": {
            "baseUrl": ".",
            "paths": {
              "@/*": ["src/*"]
            }
          },
          "note": ",]"
        }`,
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      expect(aliases!['@/*']).toEqual([join(dir, 'src/*')]);
    });

    it("anchors a parent's `paths` against the parent's own baseUrl, even when the child overrides baseUrl", async () => {
      // Parent declares baseUrl + paths together. Child overrides
      // baseUrl to a different directory but doesn't restate the
      // parent's paths. TypeScript treats the parent's `paths` entries
      // as relative to the parent's own baseUrl (per its "All relative
      // paths…relative to the configuration file they originated in"
      // rule). Without per-config anchoring, the parent's '@/*' would
      // wrongly resolve under the child's baseUrl.
      writeFile(
        'shared/tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@/*': ['lib/*'] },
          },
        }),
      );
      writeFile(
        'tsconfig.json',
        JSON.stringify({
          extends: './shared/tsconfig.base.json',
          compilerOptions: {
            baseUrl: './app',
            paths: { '#util/*': ['util/*'] },
          },
        }),
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      // Parent path anchored against parent's baseUrl (= shared/):
      expect(aliases!['@/*']).toEqual([join(dir, 'shared', 'lib/*')]);
      // Child path anchored against child's baseUrl (= app/):
      expect(aliases!['#util/*']).toEqual([join(dir, 'app', 'util/*')]);
    });

    it("resolves a parent's `baseUrl` against the parent's own directory", async () => {
      writeFile(
        'sub/tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@/*': ['src/*'] },
          },
        }),
      );
      writeFile(
        'tsconfig.json',
        JSON.stringify({ extends: './sub/tsconfig.base.json' }),
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      // `baseUrl: "."` on the parent must anchor on the parent's dir
      // (`<dir>/sub`), not on the leaf config's dir (`<dir>`).
      expect(aliases!['@/*']).toEqual([join(dir, 'sub', 'src/*')]);
    });

    it('follows `extends` and lets the child paths override the parent', async () => {
      writeFile(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@/*': ['src/*'], '#legacy/*': ['old/*'] },
          },
        }),
      );
      writeFile(
        'tsconfig.json',
        JSON.stringify({
          extends: './tsconfig.base.json',
          compilerOptions: {
            paths: { '@/*': ['app/*'] },
          },
        }),
      );
      const { loadTsconfigPaths } = await import('../src/index.js');
      const aliases = loadTsconfigPaths(dir);
      expect(aliases).not.toBeNull();
      // Child wins for the colliding key; parent's '#legacy/*' is
      // visible too (extends-merge).
      expect(aliases!['@/*']).toEqual([join(dir, 'app/*')]);
      expect(aliases!['#legacy/*']).toEqual([join(dir, 'old/*')]);
    });
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
