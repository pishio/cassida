import { describe, it, expect, beforeEach } from 'vitest';

import { rewriteIrComments } from '../src/ir-loader.js';
import {
  __resetForTests,
  allRules,
  setRulesForFile,
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
});

describe('store + virtual-css integration', () => {
  it('aggregates rules from multiple files into a single CSS bundle', () => {
    const irA = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesA } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irA}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile('/abs/a.tsx', rulesA);

    const irB = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const { rules: rulesB } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irB}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile('/abs/b.tsx', rulesB);

    expect(trackedFiles()).toHaveLength(2);
    const allAccumulated = Array.from(allRules());
    expect(allAccumulated).toHaveLength(2);

    const css = buildVirtualCss({ layer: 'cas' });
    expect(css).toContain('@layer cas');
    expect(css).toContain('color:red');
    expect(css).toContain('color:blue');
  });

  it('replaces a file\'s rules on a re-transform', () => {
    const irRed = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rRed } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irRed}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile('/abs/a.tsx', rRed);

    // The same file is now re-transformed with a different chain.
    const irGreen = JSON.stringify([{ method: 'color', args: ['green'] }]);
    const { rules: rGreen } = rewriteIrComments(
      `<div className={/* @cassida-ir:${irGreen}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile('/abs/a.tsx', rGreen);

    const css = buildVirtualCss({ layer: 'cas' });
    expect(css).toContain('color:green');
    expect(css).not.toContain('color:red');
  });

  it('removes a file\'s contribution when its rule set drops to empty', () => {
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules } = rewriteIrComments(
      `<div className={/* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__"} />`,
    );
    setRulesForFile('/abs/a.tsx', rules);

    expect(trackedFiles()).toContain('/abs/a.tsx');
    setRulesForFile('/abs/a.tsx', []);
    expect(trackedFiles()).not.toContain('/abs/a.tsx');
  });
});
