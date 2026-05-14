import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import type {
  CassParserPlugin,
  ParserPluginHelpers,
  SpreadPlan,
} from '@cassida/parser';
import type { CompiledRule, DynamicSlot } from '@cassida/compiler';

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
 * Recognized shapes:
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
 * v2 (since v0.4): dynamic slots inside a branch (e.g.
 * `cas().color(theme.fg)`) compile alongside the static portion.
 * Each branch's CSS variables flow through a branch-conditional
 * `style={...}` attribute that mirrors the className ternary; the
 * literal class for each branch still participates in dedup. v1
 * bailed to runtime whenever either branch carried a dynamic; v2
 * keeps the build-time path active for the common
 * "themed-conditional-variant" case.
 *
 * Bail conditions (plugin returns `null`, parser leaves the JSX
 * untouched and the chain falls through to runtime):
 *
 *   - Either branch isn't a Cassida chain
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
  const consequent = helpers.peelPropsAccess(argPath.get('consequent'));
  const alternate = helpers.peelPropsAccess(argPath.get('alternate'));

  const cOps = helpers.walkChain(consequent);
  const aOps = helpers.walkChain(alternate);
  if (!cOps || !aOps) return null;

  const cRule = helpers.compileOps(cOps);
  const aRule = helpers.compileOps(aOps);

  return {
    rules: [cRule, aRule],
    buildAttrs(existing) {
      // Clone the test expression once per consumer site. Both the
      // className ternary and (if dynamic branches exist) the style
      // ternary need their own reference — sharing the original would
      // leave Babel with a node that has two parents in the rewritten
      // tree, which corrupts subsequent traversals.
      const attrs: t.JSXAttribute[] = [];
      const classNameTernary = t.conditionalExpression(
        t.cloneNode(argPath.node.test),
        t.stringLiteral(cRule.className),
        t.stringLiteral(aRule.className),
      );
      attrs.push(helpers.makeClassNameAttr(existing.className, classNameTernary));

      const styleAttr = buildBranchedStyleAttr(
        helpers,
        existing.style,
        t.cloneNode(argPath.node.test),
        cRule,
        aRule,
        existing.casWins,
      );
      if (styleAttr) attrs.push(styleAttr);
      return attrs;
    },
  };
}

function planShortCircuit(
  argPath: NodePath<t.LogicalExpression>,
  helpers: ParserPluginHelpers,
): SpreadPlan | null {
  const right = helpers.peelPropsAccess(argPath.get('right'));
  const ops = helpers.walkChain(right);
  if (!ops) return null;
  const rule = helpers.compileOps(ops);

  return {
    rules: [rule],
    buildAttrs(existing) {
      const attrs: t.JSXAttribute[] = [];

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
      // alone as the attribute value — `void 0` (canonical, never-
      // shadowed `undefined`) is the right shape there because React
      // skips rendering `className={undefined}` entirely instead of
      // emitting `class=""`. Using `t.identifier('undefined')` would
      // be subject to local-scope shadowing in pathological cases;
      // `void 0` is immutable.
      const falsyClassBranch: t.Expression = existing.className
        ? t.stringLiteral('')
        : voidZero();
      const classNameTernary = t.conditionalExpression(
        t.cloneNode(argPath.node.left),
        t.stringLiteral(rule.className),
        falsyClassBranch,
      );
      attrs.push(helpers.makeClassNameAttr(existing.className, classNameTernary));

      if (rule.dynamics.length > 0) {
        // `cond && cas()` carries its dynamic slots only on the truthy
        // branch. Mirror the className ternary's shape: truthy →
        // object of var bindings, falsy → `void 0`. Spreading
        // `undefined` into a parent style object is a runtime no-op,
        // so this composes cleanly with any existing host style.
        const styleTernary = t.conditionalExpression(
          t.cloneNode(argPath.node.left),
          buildBranchStyleObject(helpers, rule.dynamics),
          voidZero(),
        );
        attrs.push(
          helpers.mergeStyleExpression(
            existing.style,
            styleTernary,
            existing.casWins,
          ),
        );
      }
      return attrs;
    },
  };
}

/**
 * Builds the `style=` attribute that carries per-branch CSS-variable
 * bindings for a `ConditionalExpression`-shaped spread. Returns
 * `null` when neither branch has dynamic slots — caller skips
 * emitting `style` entirely in that case (matching the static-only
 * v1 path).
 *
 * Shape:
 *   - both static          → null
 *   - both dynamic         → style={cond ? {vars-c} : {vars-a}}
 *   - one static, one dyn  → style={cond ? {vars-c} : void 0}  (etc.)
 *
 * `void 0` for the empty side means React skips style application
 * when that branch is taken; spreading `undefined` into an existing
 * host `style` object is also a no-op, so the merge composes cleanly.
 */
function buildBranchedStyleAttr(
  helpers: ParserPluginHelpers,
  existingStyle: t.JSXAttribute | null,
  testExpr: t.Expression,
  cRule: CompiledRule,
  aRule: CompiledRule,
  casWins: boolean,
): t.JSXAttribute | null {
  if (cRule.dynamics.length === 0 && aRule.dynamics.length === 0) {
    return null;
  }
  const cBranch =
    cRule.dynamics.length > 0
      ? buildBranchStyleObject(helpers, cRule.dynamics)
      : voidZero();
  const aBranch =
    aRule.dynamics.length > 0
      ? buildBranchStyleObject(helpers, aRule.dynamics)
      : voidZero();
  const ternary = t.conditionalExpression(testExpr, cBranch, aBranch);
  return helpers.mergeStyleExpression(existingStyle, ternary, casWins);
}

function buildBranchStyleObject(
  helpers: ParserPluginHelpers,
  dynamics: readonly DynamicSlot[],
): t.ObjectExpression {
  // Each compiled dynamic slot becomes one CSS-variable binding in
  // the inline style. The slot's `sourceId` is the lookup key the
  // parser uses internally; `getDynamicSource` returns the AST node
  // the user originally passed (e.g. the `theme.fg` member expr).
  // The variable name (`--cas-XXXXX-color`) is unique per (className,
  // scope, property) triple — different branches don't collide.
  return t.objectExpression(
    dynamics.map((slot) =>
      t.objectProperty(
        t.stringLiteral(slot.varName),
        helpers.getDynamicSource(slot.sourceId),
      ),
    ),
  );
}

/**
 * `void 0` — canonical, lexical-scope-proof `undefined`. Prefer this
 * over `t.identifier('undefined')` since `undefined` is a regular
 * identifier in JS, technically rebindable, and minifiers / linters
 * vary in how they treat it.
 */
function voidZero(): t.UnaryExpression {
  return t.unaryExpression('void', t.numericLiteral(0));
}
