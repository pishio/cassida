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
  // Clone before re-parenting: the original spread argument is
  // being removed from the tree by the rewrite, and Babel's
  // internal node tracking gets confused if a node ends up with
  // multiple parents. `cloneNode` (deep clone) is the defensive
  // move regardless of the actual reachability after replacement.
  const testExpr = t.cloneNode(argPath.node.test);
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
  // See `planConditional` — clone for the same parent-pointer
  // hygiene reasons.
  const left = t.cloneNode(argPath.node.left);
  const right = helpers.peelPropsAccess(argPath.get('right'));
  const ops = helpers.walkChain(right);
  if (!ops) return null;
  const rule = helpers.compileOps(ops);
  if (rule.dynamics.length > 0) return null;

  return {
    rules: [rule],
    buildAttrs(existing) {
      // Falsy branch depends on whether the host element already
      // carries a `className`. If it does, `makeClassNameAttr` builds
      // a template literal that interpolates the ternary into the
      // existing class string — and `undefined` inside a template
      // literal stringifies to the literal text "undefined", which
      // would leak into the DOM as `class="extra undefined"`. Using
      // an empty string keeps the existing class clean (at the cost
      // of a trailing space, which browsers ignore).
      //
      // When no existing className is present, the ternary stands
      // alone as the attribute value — `undefined` is the right
      // shape there because React skips rendering `className={undefined}`
      // entirely instead of emitting `class=""`.
      const falsyBranch: t.Expression = existing.className
        ? t.stringLiteral('')
        : t.identifier('undefined');
      const ternary = t.conditionalExpression(
        left,
        t.stringLiteral(rule.className),
        falsyBranch,
      );
      return [helpers.makeClassNameAttr(existing.className, ternary)];
    },
  };
}
