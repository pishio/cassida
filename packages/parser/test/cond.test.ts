import { describe, expect, it } from 'vitest';
import { transform } from '../src/index.js';
import { defaultRegistry } from '@cassida/compiler';

const opts = {
  registry: defaultRegistry,
  filename: 'App.tsx',
};

describe('chain `.cond(test, truthy, falsy?)`', () => {
  describe('basic shape', () => {
    it('expands `cas().cond(a, c=>c.X(), c=>c.Y())` into two rules + ternary className', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...cas().cond(a, c => c.color('red'), c => c.color('blue')).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      expect(r.rules[0]!.tree.bag.color).toBe('red');
      expect(r.rules[1]!.tree.bag.color).toBe('blue');
      expect(r.code).toMatch(
        /className=\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/,
      );
    });

    it('single-arg `.cond(a, c=>c.X())` materialises an empty falsy branch', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...cas().cond(a, c => c.color('red')).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      // Truthy branch carries the color; falsy is an empty bag.
      expect(r.rules).toHaveLength(2);
      const reds = r.rules.filter((rule) => rule.tree.bag.color === 'red');
      expect(reds).toHaveLength(1);
      const empties = r.rules.filter(
        (rule) => Object.keys(rule.tree.bag).length === 0,
      );
      expect(empties).toHaveLength(1);
    });

    it('threads outer chain methods through every branch', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div
            {...cas()
              .padding(8)
              .cond(a, c => c.color('red'), c => c.color('blue'))
              .marginTop(16).props}
          />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      // Both leaves share padding + marginTop; only color differs.
      for (const rule of r.rules) {
        expect(rule.tree.bag.padding).toBe('8px');
        expect(rule.tree.bag['margin-top']).toBe('16px');
      }
      expect(r.rules.map((rule) => rule.tree.bag.color).sort()).toEqual([
        'blue',
        'red',
      ]);
    });

    it('build-time leaves keep stable hashes across re-runs (bijection check)', () => {
      // Both runs must produce identical class hashes for the same
      // chain — the canonical bag → className mapping is purely a
      // function of ops, independent of build invocation. Pairs with
      // the runtime bijection test in `@cassida/core` which asserts
      // the runtime `.cond()` lands on one of these classes.
      const runOnce = () =>
        transform(
          `
          import { cas } from '@cassida/core';
          export const App = ({ a }: { a: boolean }) =>
            <div {...cas().padding(8).cond(a, c => c.color('red'), c => c.color('blue')).props} />;
        `,
          opts,
        );
      const r1 = runOnce();
      const r2 = runOnce();
      expect(r1.rules.map((rule) => rule.className).sort()).toEqual(
        r2.rules.map((rule) => rule.className).sort(),
      );
    });
  });

  describe('multiple `.cond()`s — Cartesian expansion', () => {
    it('two nested conds produce 4 leaves and a nested ternary', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, b }: { a: boolean; b: boolean }) =>
          <div
            {...cas()
              .cond(a, c => c.color('red'), c => c.color('blue'))
              .cond(b, c => c.backgroundColor('white'))
              .props}
          />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(4);
      // Babel's generator omits parens around right-associative
      // conditional sub-expressions (the AST itself is nested; the
      // output is flat but unambiguous).
      expect(r.code).toMatch(
        /className=\{a \? b \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}" : b \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/,
      );
    });

    it('caps at 32 leaves — five nested conds is the limit, six errors', () => {
      // Six .cond()s = 64 leaves > 32.
      const exec = () =>
        transform(
          `
          import { cas } from '@cassida/core';
          export const App = ({ a, b, c, d, e, f }: any) =>
            <div
              {...cas()
                .cond(a, x => x.color('red'))
                .cond(b, x => x.padding(8))
                .cond(c, x => x.marginTop(8))
                .cond(d, x => x.fontSize(16))
                .cond(e, x => x.opacity(0.5))
                .cond(f, x => x.lineHeight(1.5))
                .props}
            />;
        `,
          opts,
        );
      expect(exec).toThrow(/Cartesian expansion exceeds 32 leaves/);
    });
  });

  describe('dynamics inside `.cond()` branches', () => {
    it('truthy-only dynamic compiles with a parallel style ternary', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, fg }: { a: boolean; fg: string }) =>
          <div {...cas().cond(a, c => c.color(fg)).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      const truthyRule = r.rules.find((rule) => rule.dynamics.length > 0)!;
      expect(truthyRule.dynamics).toHaveLength(1);
      // The dynamic side carries the CSS variable; the empty side is void 0.
      expect(r.code).toMatch(
        /style=\{a \?\s*\{\s*"--cas-[a-z0-9-]+":\s*fg\s*\} : void 0\}/,
      );
    });

    it('both branches dynamic — each branch gets its own var binding', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, fg, bg }: { a: boolean; fg: string; bg: string }) =>
          <div {...cas().cond(a, c => c.color(fg), c => c.color(bg)).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      expect(r.rules.every((rule) => rule.dynamics.length === 1)).toBe(true);
      expect(r.code).toMatch(
        /style=\{a \?\s*\{\s*"--cas-[a-z0-9-]+":\s*fg\s*\} : \{\s*"--cas-[a-z0-9-]+":\s*bg\s*\}\}/,
      );
    });

    it('no style attr when neither branch carries dynamics', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...cas().cond(a, c => c.color('red'), c => c.color('blue')).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).not.toContain('style=');
    });
  });

  describe('merge with existing JSX attributes', () => {
    it('merges with an existing className', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div className="extra" {...cas().cond(a, c => c.color('red'), c => c.color('blue')).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /className=\{`extra \$\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}`\}/,
      );
    });

    it('merges dynamic style ternary with an existing host style', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, fg }: { a: boolean; fg: string }) =>
          <div
            style={{ opacity: 0.5 }}
            {...cas().cond(a, c => c.color(fg)).props}
          />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /style=\{\{\s*opacity:\s*0\.5,\s*\.\.\.\(a \?\s*\{\s*"--cas-[a-z0-9-]+":\s*fg\s*\} : void 0\)\s*\}\}/,
      );
    });

    it('respects JSX source-order precedence — `style=` AFTER the cas spread keeps user keys', () => {
      // Reverse order: the user `style={{ opacity: 0.5 }}` comes
      // AFTER the cas spread in JSX, so on key collision the user's
      // declarations win. The plugin spread must therefore come FIRST
      // inside the merged object literal.
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, fg }: { a: boolean; fg: string }) =>
          <div
            {...cas().cond(a, c => c.color(fg)).props}
            style={{ opacity: 0.5 }}
          />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /style=\{\{\s*\.\.\.\(a \?\s*\{\s*"--cas-[a-z0-9-]+":\s*fg\s*\} : void 0\),\s*opacity:\s*0\.5\s*\}\}/,
      );
    });
  });

  describe('Phase 1 limitation — `.cond()` inside modifier callbacks', () => {
    it('bails (falls through to runtime) when `.cond()` appears inside `.hover(...)`', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...cas().hover(c => c.cond(a, x => x.color('red'))).props} />;
      `,
        opts,
      );
      // The whole chain bails — no rules, no JSX rewrite.
      expect(r.transformed).toBe(false);
      expect(r.rules).toHaveLength(0);
    });
  });

  describe('Stability: same chain shape → same className', () => {
    it('each leaf class participates in the regular dedup pipeline', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        const Direct = () => <span {...cas().color('red').props} />;
        const Branched = ({ a }: { a: boolean }) =>
          <div {...cas().cond(a, c => c.color('red'), c => c.color('blue')).props} />;
      `,
        opts,
      );
      // Direct site + two branched leaves = 3 rules, but the red
      // branch's class should match Direct's class (same canonical bag).
      const redClasses = new Set(
        r.rules
          .filter((rule) => rule.tree.bag.color === 'red')
          .map((rule) => rule.className),
      );
      expect(redClasses.size).toBe(1);
    });
  });
});
