import { describe, expect, it } from 'vitest';
import { transform } from '@cassida/parser';
import { defaultRegistry } from '@cassida/compiler';
import { conditionalSpread } from '../src/index.js';

const opts = {
  registry: defaultRegistry,
  filename: 'App.tsx',
  parserPlugins: [conditionalSpread()],
};

describe('@cassida/plugin-conditional', () => {
  describe('ConditionalExpression', () => {
    it('rewrites `cond ? cas().X() : cas().Y()` to a ternary className', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...(a ? cas().color("red") : cas().color("blue"))} />;
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

    it('handles `.props` on the outer ConditionalExpression', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...(a ? cas().color("red") : cas().color("blue")).props} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      expect(r.code).toMatch(
        /className=\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/,
      );
    });

    it('handles `.props` on each branch independently', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...(a ? cas().color("red").props : cas().color("blue").props)} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
    });

    it('produces stable hashes — both branches dedup against the static class table', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        const A = () => <div {...(true ? cas().color("red") : cas().color("blue"))} />;
        const B = () => <span {...cas().color("red")} />;
      `,
        opts,
      );
      // Three sites total but only two distinct rules (consequent matches B's chain).
      expect(r.rules).toHaveLength(3);
      const reds = r.rules.filter((rule) => rule.tree.bag.color === 'red');
      const redClasses = new Set(reds.map((rule) => rule.className));
      expect(redClasses.size).toBe(1);
    });

    it('handles modifier scopes inside branches (e.g. `.hover(...)`)', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <button
            {...(a
              ? cas().color("red").hover(c => c.color("crimson"))
              : cas().color("blue").hover(c => c.color("navy")))}
          />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      expect(r.rules[0]!.tree.children).toHaveLength(1);
      expect(r.rules[1]!.tree.children).toHaveLength(1);
    });

    it('merges with existing className via the helper', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div className="extra" {...(a ? cas().color("red") : cas().color("blue"))} />;
      `,
        opts,
      );
      expect(r.code).toMatch(
        /className=\{`extra \$\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}`\}/,
      );
    });
  });

  describe('LogicalExpression `&&` short-circuit', () => {
    it('rewrites `cond && cas().X()` to `cond ? "cas-X" : undefined`', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active }: { active: boolean }) =>
          <div {...(active && cas().color("red"))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(1);
      expect(r.code).toMatch(
        /className=\{active \? "cas-[0-9a-f]{8}" : undefined\}/,
      );
    });

    it('handles `.props` on the gated chain', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active }: { active: boolean }) =>
          <div {...(active && cas().color("red").props)} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /className=\{active \? "cas-[0-9a-f]{8}" : undefined\}/,
      );
    });

    it('can be disabled via `shortCircuit: false`', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active }: { active: boolean }) =>
          <div {...(active && cas().color("red"))} />;
      `,
        { ...opts, parserPlugins: [conditionalSpread({ shortCircuit: false })] },
      );
      // Plugin defers, default path also doesn't recognize, so the
      // JSX is left as-is and `transformed` stays false.
      expect(r.transformed).toBe(false);
    });

    it('does not recognize `||` or `??` operators', () => {
      const orForm = transform(
        `
        import { cas } from '@cassida/core';
        const fallback = null;
        export const App = () =>
          <div {...(fallback || cas().color("red"))} />;
      `,
        opts,
      );
      expect(orForm.transformed).toBe(false);
    });
  });

  describe('bail conditions', () => {
    it('falls through when a branch contains a dynamic slot', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, dyn }: { a: boolean; dyn: string }) =>
          <div {...(a ? cas().color(dyn) : cas().color("blue"))} />;
      `,
        opts,
      );
      // The conditional plugin bails on dynamic branches — the JSX
      // stays unchanged and the chain falls through to runtime.
      expect(r.transformed).toBe(false);
    });

    it('falls through when one branch is not a Cassida chain', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        const otherProps = { id: 'x' };
        export const App = ({ a }: { a: boolean }) =>
          <div {...(a ? cas().color("red") : otherProps)} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(false);
    });
  });
});
