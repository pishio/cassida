import { describe, it, expect, beforeEach } from 'vitest';

import { rewriteIrComments } from '../src/ir-loader.js';
import {
  __resetForTests,
  allRules,
  setRulesForFile,
  testCompilationKey,
  trackedFiles,
} from '../src/store.js';
import { buildVirtualCss } from '../src/virtual-css.js';

beforeEach(() => {
  __resetForTests();
});

describe('rewriteIrComments', () => {
  it('compiles a single IR comment + placeholder into a class name', () => {
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const src = `const x = <div className={/* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__"} />;`;

    const { code, rules } = rewriteIrComments(src);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.tree.bag.color).toBe('red');
    // The placeholder is replaced with the resulting class name (as a
    // JSON-string literal so the source stays valid JS).
    expect(code).toContain(`"${rules[0]!.className}"`);
    expect(code).not.toContain('__CAS_PLACEHOLDER_0__');
    // The IR comment itself is consumed in the replacement.
    expect(code).not.toContain('@cassida-ir:');
  });

  it('rewrites multiple placeholders independently', () => {
    const irA = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const irB = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const src = [
      `<span className={/* @cassida-ir:${irA}*/ "__CAS_PLACEHOLDER_0__"} />`,
      `<span className={/* @cassida-ir:${irB}*/ "__CAS_PLACEHOLDER_1__"} />`,
    ].join('\n');

    const { code, rules } = rewriteIrComments(src);

    expect(rules).toHaveLength(2);
    const reds = rules.filter((r) => r.tree.bag.color === 'red');
    const blues = rules.filter((r) => r.tree.bag.color === 'blue');
    expect(reds).toHaveLength(1);
    expect(blues).toHaveLength(1);
    // Each placeholder lands on its own className.
    expect(code).toContain(`"${reds[0]!.className}"`);
    expect(code).toContain(`"${blues[0]!.className}"`);
  });

  it('handles a scoped op (modifier scope) IR payload', () => {
    const ir = JSON.stringify([
      {
        scope: { kind: 'pseudo', selector: ':hover' },
        ops: [{ method: 'color', args: ['red'] }],
      },
    ]);
    const src = `<div className={/* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__"} />`;

    const { rules } = rewriteIrComments(src);

    expect(rules).toHaveLength(1);
    // The hover child carries the color declaration.
    const hover = rules[0]!.tree.children.find(
      (c) => c.scope?.kind === 'pseudo' && c.scope.selector === ':hover',
    );
    expect(hover?.bag.color).toBe('red');
  });

  it('passes the source through unchanged when no IR comment is present', () => {
    const src = `const x = 1; const y = "__CAS_PLACEHOLDER_0__";`;
    const { code, rules } = rewriteIrComments(src);
    expect(code).toBe(src);
    expect(rules).toHaveLength(0);
  });

  it('raises a descriptive error when the IR JSON is malformed', () => {
    const src = `<div className={/* @cassida-ir:not-valid-json*/ "__CAS_PLACEHOLDER_0__"} />`;
    expect(() => rewriteIrComments(src)).toThrow(/parse IR JSON/i);
  });

  it('matches IR comments that span multiple lines', () => {
    // A formatter could legitimately re-wrap the comment onto two
    // lines; `.` doesn't match `\n` by default in JS regex, so the
    // pattern uses `[\s\S]` to stay matched.
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }], null, 2);
    const src = `<div className={/*\n@cassida-ir:${ir}\n*/ "__CAS_PLACEHOLDER_0__"} />`;
    const { rules } = rewriteIrComments(src);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.tree.bag.color).toBe('red');
  });

  it('matches placeholders wrapped in single quotes or backticks too', () => {
    // Downstream minifiers (esbuild / terser / swc-minify) sometimes
    // normalise string-literal quote style; the loader has to find
    // the placeholder regardless of which one the host picked.
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    for (const quote of ['"', "'", '`']) {
      const src = `const x = /* @cassida-ir:${ir}*/ ${quote}__CAS_PLACEHOLDER_0__${quote};`;
      const { rules } = rewriteIrComments(src);
      expect(rules).toHaveLength(1);
    }
  });
});

describe('store + virtual-css integration', () => {
  it('aggregates rules from multiple files into a single CSS bundle', () => {
    const compilation = testCompilationKey();

    const irA = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesA } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irA}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(compilation, '/abs/a.tsx', rulesA);

    const irB = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const { rules: rulesB } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irB}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(compilation, '/abs/b.tsx', rulesB);

    expect(trackedFiles(compilation)).toHaveLength(2);
    const allAccumulated = Array.from(allRules(compilation));
    expect(allAccumulated).toHaveLength(2);

    const css = buildVirtualCss(compilation, { layer: 'cas' });
    expect(css).toContain('@layer cas');
    expect(css).toContain('color:red');
    expect(css).toContain('color:blue');
  });

  it('replaces a file\'s rules on a re-transform', () => {
    const compilation = testCompilationKey();

    const irRed = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rRed } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irRed}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(compilation, '/abs/a.tsx', rRed);

    // The same file is now re-transformed with a different chain.
    const irGreen = JSON.stringify([{ method: 'color', args: ['green'] }]);
    const { rules: rGreen } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irGreen}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(compilation, '/abs/a.tsx', rGreen);

    const css = buildVirtualCss(compilation, { layer: 'cas' });
    expect(css).toContain('color:green');
    expect(css).not.toContain('color:red');
  });

  it('removes a file\'s contribution when its rule set drops to empty', () => {
    const compilation = testCompilationKey();
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules } = rewriteIrComments(
      `<div className={/* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(compilation, '/abs/a.tsx', rules);

    expect(trackedFiles(compilation)).toContain('/abs/a.tsx');
    setRulesForFile(compilation, '/abs/a.tsx', []);
    expect(trackedFiles(compilation)).not.toContain('/abs/a.tsx');
  });

  it('keeps Server- and Client-compilation bags isolated', () => {
    // The whole point of the per-compilation refactor: two
    // synthetic "compilations" don't see each other's rules.
    const serverCompilation: object = { __label: 'server' };
    const clientCompilation: object = { __label: 'client' };

    const irServer = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesServer } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irServer}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(serverCompilation, '/abs/server-only.tsx', rulesServer);

    const irClient = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const { rules: rulesClient } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irClient}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile(clientCompilation, '/abs/page.tsx', rulesClient);

    expect(trackedFiles(serverCompilation)).toEqual(['/abs/server-only.tsx']);
    expect(trackedFiles(clientCompilation)).toEqual(['/abs/page.tsx']);
    expect(Array.from(allRules(serverCompilation))).toHaveLength(1);
    expect(Array.from(allRules(clientCompilation))).toHaveLength(1);

    const cssServer = buildVirtualCss(serverCompilation, { layer: 'cas' });
    expect(cssServer).toContain('color:red');
    expect(cssServer).not.toContain('color:blue');

    const cssClient = buildVirtualCss(clientCompilation, { layer: 'cas' });
    expect(cssClient).toContain('color:blue');
    expect(cssClient).not.toContain('color:red');
  });
});
