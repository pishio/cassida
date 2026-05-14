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
    it('rewrites `cond && cas().X()` to `cond ? "cas-X" : void 0`', () => {
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
        /className=\{active \? "cas-[0-9a-f]{8}" : void 0\}/,
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
        /className=\{active \? "cas-[0-9a-f]{8}" : void 0\}/,
      );
    });

    it('falsy branch is "" (not undefined) when existing className is present', () => {
      // If the falsy branch were `undefined`, the template-literal
      // merge in `makeClassNameAttr` would stringify it to the
      // literal text "undefined" and the DOM would carry
      // `class="extra undefined"`. Empty string keeps the existing
      // class clean — trailing space is harmless.
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active }: { active: boolean }) =>
          <div className="extra" {...(active && cas().color("red"))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /className=\{`extra \$\{active \? "cas-[0-9a-f]{8}" : ""\}`\}/,
      );
      expect(r.code).not.toContain('undefined');
    });

    it('falsy branch stays `void 0` when no existing className', () => {
      // Without an existing class to interpolate into, the ternary
      // stands alone; React skips `className={void 0}` (i.e.
      // `undefined`) cleanly instead of emitting an empty `class=""`
      // attribute. `void 0` is the canonical, shadow-proof form.
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active }: { active: boolean }) =>
          <div {...(active && cas().color("red"))} />;
      `,
        opts,
      );
      expect(r.code).toMatch(
        /className=\{active \? "cas-[0-9a-f]{8}" : void 0\}/,
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

  describe('dynamic-slot branches (v0.4+)', () => {
    it('transforms `cond ? cas().X(dyn) : cas().Y(static)` with a branch-conditional style', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, dyn }: { a: boolean; dyn: string }) =>
          <div {...(a ? cas().color(dyn) : cas().color("blue"))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      // Consequent rule carries one dynamic slot; alternate is pure.
      expect(r.rules[0]!.dynamics).toHaveLength(1);
      expect(r.rules[1]!.dynamics).toHaveLength(0);
      // className stays a literal ternary.
      expect(r.code).toMatch(
        /className=\{a \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/,
      );
      // style is a parallel ternary: dynamic branch → object of var
      // bindings, static branch → void 0 (React skips the attr).
      expect(r.code).toMatch(
        /style=\{a \? \{\s*"--cas-[a-z0-9-]+":\s*dyn\s*\} : void 0\}/,
      );
    });

    it('transforms when *both* branches carry dynamics', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, fg, bg }: { a: boolean; fg: string; bg: string }) =>
          <div {...(a ? cas().color(fg) : cas().color(bg))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(2);
      expect(r.rules[0]!.dynamics).toHaveLength(1);
      expect(r.rules[1]!.dynamics).toHaveLength(1);
      // Both branches share the same className shape but different
      // CSS-variable names; the ternary picks the right binding.
      expect(r.code).toMatch(
        /style=\{a \? \{\s*"--cas-[a-z0-9-]+":\s*fg\s*\} : \{\s*"--cas-[a-z0-9-]+":\s*bg\s*\}\}/,
      );
    });

    it('merges with an existing host `style` attribute', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a, dyn }: { a: boolean; dyn: string }) =>
          <div style={{ opacity: 0.5 }} {...(a ? cas().color(dyn) : cas().color("blue"))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      // Spread of the branch-conditional after the host's properties.
      // Cas wins on key collision (the spread is later), matching the
      // default `casWins: true` behaviour.
      expect(r.code).toMatch(
        /style=\{\{\s*opacity:\s*0\.5,\s*\.\.\.\(a \?\s*\{\s*"--cas-[a-z0-9-]+":\s*dyn\s*\} : void 0\)\s*\}\}/,
      );
    });

    it('short-circuit `cond && cas().X(dyn)` emits a conditional style', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active, dyn }: { active: boolean; dyn: string }) =>
          <div {...(active && cas().color(dyn))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.rules).toHaveLength(1);
      expect(r.rules[0]!.dynamics).toHaveLength(1);
      expect(r.code).toMatch(
        /className=\{active \? "cas-[0-9a-f]{8}" : void 0\}/,
      );
      expect(r.code).toMatch(
        /style=\{active \?\s*\{\s*"--cas-[a-z0-9-]+":\s*dyn\s*\} : void 0\}/,
      );
    });

    it('short-circuit dynamic branch merges with existing style', () => {
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ active, dyn }: { active: boolean; dyn: string }) =>
          <div style={{ opacity: 0.5 }} {...(active && cas().color(dyn))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).toMatch(
        /style=\{\{\s*opacity:\s*0\.5,\s*\.\.\.\(active \?\s*\{\s*"--cas-[a-z0-9-]+":\s*dyn\s*\} : void 0\)\s*\}\}/,
      );
    });

    it('no `style=` attribute is emitted when both branches are pure-static', () => {
      // v1 behaviour preserved — when neither branch has a dynamic,
      // we don't bloat the JSX with `style={cond ? {} : {}}`.
      const r = transform(
        `
        import { cas } from '@cassida/core';
        export const App = ({ a }: { a: boolean }) =>
          <div {...(a ? cas().color("red") : cas().color("blue"))} />;
      `,
        opts,
      );
      expect(r.transformed).toBe(true);
      expect(r.code).not.toContain('style=');
    });
  });

  describe('bail conditions', () => {
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
