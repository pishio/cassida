/**
 * Parser plugin extension point tests.
 *
 * Exercises the `trySpread` hook by registering a tiny dummy plugin
 * that recognizes a known AST shape, takes ownership of the rewrite,
 * and verifies the parser threading is correct.
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import {
  transform,
  type CassParserPlugin,
  type SpreadPlan,
  type ParserPluginHelpers,
} from '../src/index.js';
import { defaultRegistry } from '@cassida/compiler';

const opts = { registry: defaultRegistry, filename: 'App.tsx' };

describe('parser plugin: trySpread', () => {
  /**
   * A plugin that recognizes `{...(cond ? cas().X() : cas().Y())}` —
   * the smallest interesting shape that the default walker can't
   * handle. Both branches must compile to pure-static chains; the
   * rewrite emits a ternary className.
   */
  const conditionalPlugin: CassParserPlugin = {
    name: 'test/conditional',
    trySpread(argPath, helpers: ParserPluginHelpers): SpreadPlan | null {
      if (!argPath.isConditionalExpression()) return null;
      const consequent = argPath.get('consequent');
      const alternate = argPath.get('alternate');
      const cOps = helpers.walkChain(helpers.peelPropsAccess(consequent));
      const aOps = helpers.walkChain(helpers.peelPropsAccess(alternate));
      if (!cOps || !aOps) return null;
      const cRule = helpers.compileOps(cOps);
      const aRule = helpers.compileOps(aOps);
      // v1: bail on dynamics.
      if (cRule.dynamics.length > 0 || aRule.dynamics.length > 0) return null;
      const testExpr = argPath.node.test;
      return {
        rules: [cRule, aRule],
        buildAttrs() {
          return [
            t.jsxAttribute(
              t.jsxIdentifier('className'),
              t.jsxExpressionContainer(
                t.conditionalExpression(
                  testExpr,
                  t.stringLiteral(cRule.className),
                  t.stringLiteral(aRule.className),
                ),
              ),
            ),
          ];
        },
      };
    },
  };

  it('does nothing when no plugins are registered (bare-chain only)', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ active }: { active: boolean }) =>
        <div {...(active ? cas().color("red") : cas().color("blue"))} />;
    `;
    const r = transform(src, opts);
    // Default parser bails on ConditionalExpression — JSX untouched.
    expect(r.transformed).toBe(false);
  });

  it('lets a registered plugin take ownership of a conditional spread', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ active }: { active: boolean }) =>
        <div {...(active ? cas().color("red") : cas().color("blue"))} />;
    `;
    const r = transform(src, {
      ...opts,
      parserPlugins: [conditionalPlugin],
    });
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(2);
    expect(r.rules[0]!.tree.bag.color).toBe('red');
    expect(r.rules[1]!.tree.bag.color).toBe('blue');
    expect(r.code).toMatch(/className=\{active \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/);
  });

  it('plugin receives the peeled `.props` argPath when applicable', () => {
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ active }: { active: boolean }) =>
        <div {...(active ? cas().color("red").props : cas().color("blue").props)} />;
    `;
    const r = transform(src, {
      ...opts,
      parserPlugins: [conditionalPlugin],
    });
    expect(r.transformed).toBe(true);
    expect(r.rules).toHaveLength(2);
    expect(r.code).toMatch(/className=\{active \? "cas-[0-9a-f]{8}" : "cas-[0-9a-f]{8}"\}/);
  });

  it('first-match wins — earlier plugin gets priority', () => {
    const seen: string[] = [];
    const observer: CassParserPlugin = {
      name: 'observer',
      trySpread() {
        seen.push('observer');
        return null;
      },
    };
    const handler: CassParserPlugin = {
      name: 'handler',
      trySpread: conditionalPlugin.trySpread,
    };
    const lateObserver: CassParserPlugin = {
      name: 'lateObserver',
      trySpread() {
        seen.push('lateObserver');
        return null;
      },
    };
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ a }: { a: boolean }) =>
        <div {...(a ? cas().color("red") : cas().color("blue"))} />;
    `;
    transform(src, {
      ...opts,
      parserPlugins: [observer, handler, lateObserver],
    });
    expect(seen).toEqual(['observer']);
    // `handler` took ownership; `lateObserver` never ran.
  });

  it('plugins do not run for bare-chain spreads (those go the default path)', () => {
    const seen: string[] = [];
    const observer: CassParserPlugin = {
      name: 'observer',
      trySpread() {
        seen.push('observer');
        return null;
      },
    };
    const src = `
      import { cas } from '@cassida/core';
      export const App = () => <div {...cas().color("red")} />;
    `;
    const r = transform(src, { ...opts, parserPlugins: [observer] });
    expect(r.transformed).toBe(true);
    expect(seen).toEqual([]);
  });

  it('throws a useful error when a plugin itself throws', () => {
    const broken: CassParserPlugin = {
      name: 'broken',
      trySpread() {
        throw new Error('boom');
      },
    };
    const src = `
      import { cas } from '@cassida/core';
      export const App = ({ a }: { a: boolean }) =>
        <div {...(a ? cas().color("red") : cas().color("blue"))} />;
    `;
    expect(() =>
      transform(src, { ...opts, parserPlugins: [broken] }),
    ).toThrow(/broken.*boom/);
  });
});
