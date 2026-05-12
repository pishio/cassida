import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import type {
  CassParserPlugin,
  ParserPluginHelpers,
  SpreadPlan,
} from '@cassida/parser';

export interface ConditionalSpreadOptions {
  /**
   * Whether to accept `LogicalExpression` spread arguments like
   * `{...isActive && cas().bg('blue').props}`. The rewrite emits
   * `className={cond ? "cas-X" : undefined}` — when `cond` is falsy
   * the className collapses to nothing, matching how the runtime
   * spread of `false` / `null` / `undefined` would have behaved.
   *
   * Defaults to `true`. Disable if you want to keep the JSX-level
   * branching explicit and surface authoring mistakes as bail-outs.
   */
  readonly shortCircuit?: boolean;
}

/**
 * Cassida parser plugin that lifts conditional-shaped JSX spreads
 * out of runtime fallback and into the build-time class table.
 *
 * Recognized shapes (each branch must compile to a pure-static
 * Cassida chain — no dynamic slots):
 *
 *   `{...(cond ? cas().X() : cas().Y())}`
 *   `{...(cond ? cas().X() : cas().Y()).props}`
 *   `{...(cond ? cas().X().props : cas().Y().props)}`
 *   `{...(cond && cas().X())}`           (opt-in via `shortCircuit`)
 *   `{...(cond && cas().X().props)}`     (opt-in via `shortCircuit`)
 *
 * Each branch becomes its own `cas-XXXXXXXX` class; the JSX spread
 * is rewritten to a ternary `className` expression. The CSS for both
 * (or all) branches is registered with the emitter so the runtime
 * lookup is just a string switch.
 *
 * Bail conditions (plugin returns `null`, parser leaves the JSX
 * untouched and the chain falls through to runtime):
 *
 *   - Either branch isn't a Cassida chain
 *   - Either branch contains a dynamic slot (CSS variable). v1
 *     keeps the rewrite pure-static; dynamic branches stay on the
 *     runtime path
 *   - Logical operator is `||` or `??` (only `&&` is supported)
 */
export function conditionalSpread(
  options: ConditionalSpreadOptions = {},
): CassParserPlugin {
  const shortCircuit = options.shortCircuit !== false;
  return {
    name: '@cassida/plugin-conditional',
    trySpread(argPath, helpers): SpreadPlan | null {
      if (argPath.isConditionalExpression()) {
        return planConditional(argPath, helpers);
      }
      if (
        shortCircuit &&
        argPath.isLogicalExpression() &&
        argPath.node.operator === '&&'
      ) {
        return planShortCircuit(argPath, helpers);
      }
      return null;
    },
  };
}

function planConditional(
  argPath: NodePath<t.ConditionalExpression>,
  helpers: ParserPluginHelpers,
): SpreadPlan | null {
  const testExpr = argPath.node.test;
  const consequent = helpers.peelPropsAccess(argPath.get('consequent'));
  const alternate = helpers.peelPropsAccess(argPath.get('alternate'));

  const cOps = helpers.walkChain(consequent);
  const aOps = helpers.walkChain(alternate);
  if (!cOps || !aOps) return null;

  const cRule = helpers.compileOps(cOps);
  const aRule = helpers.compileOps(aOps);
  // v1: dynamic slots in either branch fall back to runtime.
  // The rewrite would need branch-specific style attrs which adds
  // significant scope; track separately as a follow-up.
  if (cRule.dynamics.length > 0 || aRule.dynamics.length > 0) return null;

  return {
    rules: [cRule, aRule],
    buildAttrs(existing) {
      const ternary = t.conditionalExpression(
        testExpr,
        t.stringLiteral(cRule.className),
        t.stringLiteral(aRule.className),
      );
      return [helpers.makeClassNameAttr(existing.className, ternary)];
    },
  };
}

function planShortCircuit(
  argPath: NodePath<t.LogicalExpression>,
  helpers: ParserPluginHelpers,
): SpreadPlan | null {
  const left = argPath.node.left;
  const right = helpers.peelPropsAccess(argPath.get('right'));
  const ops = helpers.walkChain(right);
  if (!ops) return null;
  const rule = helpers.compileOps(ops);
  if (rule.dynamics.length > 0) return null;

  return {
    rules: [rule],
    buildAttrs(existing) {
      // `cond ? "cas-X" : undefined` — when the chain is gated by a
      // truthy check, the className collapses to absent (effectively
      // empty in React) on falsy. Matches how `{...(false)}` would
      // have produced no attributes at runtime.
      const ternary = t.conditionalExpression(
        left,
        t.stringLiteral(rule.className),
        t.identifier('undefined'),
      );
      return [helpers.makeClassNameAttr(existing.className, ternary)];
    },
  };
}
