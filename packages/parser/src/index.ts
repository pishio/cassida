import { parse, type ParserPlugin } from '@babel/parser';
import generateModule from '@babel/generator';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  argModifiers,
  canonicalModifiers,
  compileOps,
  cssToCamel,
  DYNAMIC_TAG,
  EvaluatedPrimitiveSchema,
  isDynamic,
  type CompiledRule,
  type DynamicSlot,
  type CassPlugin,
  type MethodOp,
  type Op,
  type RawOp,
  type Registry,
  type Scope,
  type ShorthandPolicy,
} from '@cassida/compiler';
import { pathAs } from './path-guard.js';
import {
  createModuleCache,
  evaluateNode,
  UNRESOLVED,
  type ModuleCache,
} from './static-eval.js';

export { createModuleCache } from './static-eval.js';
export type { ModuleCache } from './static-eval.js';

// Babel's ESM packaging exposes the function under `.default` when imported
// from a Node ESM consumer. Tolerate either shape.
const traverse = (
  (traverseModule as { default?: typeof traverseModule }).default ?? traverseModule
) as typeof traverseModule;
const generate = (
  (generateModule as { default?: typeof generateModule }).default ?? generateModule
) as typeof generateModule;

export interface TransformOptions {
  readonly registry: Registry;
  readonly filename?: string;
  /**
   * The module specifier to recognize as the source of the `fss` import.
   * Defaults to `@cassida/core`. Renamed imports (`{ fss as ff }`) are honored.
   */
  readonly importSource?: string;
  /**
   * Policy for shorthand ↔ longhand co-occurrence within a single scope.
   * Forwarded to `compileOps`. Defaults to `'strict'`.
   */
  readonly shorthandPolicy?: ShorthandPolicy;
  /**
   * Build-time plugins forwarded to `compileOps`. Each plugin
   * receives the post-collapse `ScopeBag` tree and returns a new
   * one; the className is derived from the post-plugin form.
   */
  readonly plugins?: readonly CassPlugin[];
  /**
   * Cross-file static evaluator controls. When the parser hits an
   * argument that Babel's local `path.evaluate()` can't resolve, it
   * walks `import` declarations from the file at `filename` and tries
   * to fold the value at build time — design tokens defined in
   * separate modules become static class names rather than dynamic
   * slots.
   *
   *   - `false`         disables cross-file evaluation entirely
   *   - omitted / true  enabled when `filename` is provided
   *   - object          enabled with explicit options (e.g. a shared
   *                     `cache` for warm reads across many files)
   *
   * Without `filename` the evaluator can't anchor relative resolution,
   * so it stays dormant regardless of this flag.
   */
  readonly crossFileEvaluation?:
    | boolean
    | {
        readonly cache?: ModuleCache;
      };
  /**
   * AST-level plugins that get a chance to handle `{...<expr>}` JSX
   * spreads the default bare-chain walk does not recognize. Each
   * plugin's `trySpread` is invoked in registration order; the first
   * plugin to return a non-null `SpreadPlan` wins. Plugins should be
   * conservative — return `null` quickly for anything they don't
   * own — so others downstream still get a turn.
   *
   * Distinct from the existing CSS-level `plugins` field, which
   * operates on the post-canonicalize `ScopeBag` tree. Parser
   * plugins fire earlier, on raw Babel paths.
   */
  readonly parserPlugins?: readonly CassParserPlugin[];
}

/**
 * AST-level plugin for the parser. Plugins can intercept JSX
 * spreads that the default chain walk doesn't recognize and emit
 * their own rules + rewritten attributes. The interface is open
 * for additional hooks in future minor versions; today only
 * `trySpread` exists.
 */
export interface CassParserPlugin {
  readonly name: string;
  /**
   * Called when the default bare-chain walk over the spread
   * argument returned `null`. Plugins inspect the AST and either
   * return a `SpreadPlan` (taking ownership of the rewrite) or
   * `null` (deferring to the next plugin / runtime fallback).
   */
  readonly trySpread?: (
    argPath: NodePath,
    helpers: ParserPluginHelpers,
  ) => SpreadPlan | null;
}

/**
 * Helpers exposed to parser plugins. Plugins compose these to walk
 * sub-chains, compile ops, and peel `.props` terminators — sharing
 * the parser's internal logic without re-implementing it.
 */
export interface ParserPluginHelpers {
  /**
   * Walk a NodePath as a chain root. Returns `null` if the path
   * isn't a chain rooted at a known cas-binding. Plugins typically
   * call this on sub-expressions (each branch of a conditional,
   * each item of an array, etc.).
   */
  readonly walkChain: (path: NodePath) => Op[] | null;
  /**
   * Compile a chain's ops into a `CompiledRule`. Plugins call this
   * once per logical class they want to register.
   */
  readonly compileOps: (ops: Op[]) => CompiledRule;
  /**
   * Strip a trailing `.props` member access from a path. Lets
   * plugins accept both `chain.props` and bare-chain shapes
   * uniformly without duplicating the peel logic.
   */
  readonly peelPropsAccess: (path: NodePath) => NodePath;
  /**
   * Allocate a fresh dynamic-slot id and remember the source AST
   * node for later inline-style emission. Plugins that emit their
   * own dynamic rules (rare) can use this to keep the slot
   * namespace coherent.
   */
  readonly registerDynamicSource: (node: t.Expression) => string;
  /**
   * Build a `className=` JSX attribute that merges the supplied
   * value (either a literal hash string or an arbitrary Expression
   * such as a ternary) with the host element's existing
   * `className`. Plugins use this to avoid re-implementing the
   * four-way merge logic (no-existing / string + string /
   * string + expression / expression + expression).
   */
  readonly makeClassNameAttr: (
    existing: t.JSXAttribute | null,
    value: string | t.Expression,
  ) => t.JSXAttribute;
  /**
   * Build a `style=` JSX attribute that merges the supplied object
   * expression with the host element's existing `style`. Use this
   * when a plugin emits inline-style additions (e.g. CSS variable
   * bindings for dynamic slots). Returns `null` when both the
   * plugin contribution and the existing attr are empty.
   *
   * `casWins` controls precedence on key collision: `true` means
   * the plugin's keys override the user's; `false` means the user's
   * keys override. Mirrors the existing `decideStyleAttr` ordering
   * (cas wins when the spread comes later in source order).
   */
  readonly makeStyleAttr: (
    existing: t.JSXAttribute | null,
    additions: t.ObjectExpression,
    casWins: boolean,
  ) => t.JSXAttribute | null;
  /**
   * Look up the AST expression that backs a dynamic-slot `sourceId`
   * (the value carried inside the user's chain, e.g. `theme.fg` in
   * `cas().color(theme.fg)`). Plugins that compile their own branches
   * via `compileOps` use this to wire each compiled `DynamicSlot` back
   * to its source for `style={...}` emission.
   *
   * Returns the *same* AST reference the parser holds. Don't mutate or
   * re-parent the result if you intend to leave the original chain
   * sub-tree in place. Plugins that fully replace the spread (the
   * common case) can move the reference into the new style attribute
   * without cloning — the original sub-tree is being removed anyway.
   */
  readonly getDynamicSource: (sourceId: string) => t.Expression;
  /**
   * Build a `style=` JSX attribute whose plugin contribution is an
   * arbitrary expression (e.g. a `ConditionalExpression` whose
   * branches carry per-branch CSS-variable bindings). Mirrors
   * `makeStyleAttr` but accepts any expression instead of being
   * limited to an `ObjectExpression` of property literals.
   *
   * When `existing` is null, the result is `style={pluginExpr}`. When
   * an existing style is present, the result spreads both: cas-side
   * vs user-side ordering is picked by `casWins` (true → cas keys
   * win on collision, matching the spread-comes-later default).
   */
  readonly mergeStyleExpression: (
    existing: t.JSXAttribute | null,
    pluginExpr: t.Expression,
    casWins: boolean,
  ) => t.JSXAttribute;
}

/**
 * The product of a `trySpread` decision: a list of compiled rules
 * to register with the CSS emitter, and a function that builds the
 * JSX attributes that replace the original spread.
 */
export interface SpreadPlan {
  /** Rules the CSS emitter should emit. Order is preserved. */
  readonly rules: readonly CompiledRule[];
  /**
   * Produce the JSX attributes that replace the original
   * `{...<expr>}`. The plugin receives the host element's existing
   * `className` / `style` attributes so it can merge with them
   * (the parser handles the actual attribute insertion / removal).
   */
  readonly buildAttrs: (
    existing: ExistingHostAttrs,
  ) => readonly t.JSXAttribute[];
}

/**
 * The host JSX element's `className` and `style` attributes at the
 * moment the spread is being rewritten. `null` for either field
 * means the host doesn't carry that attribute today.
 *
 * `casWins` reflects the JSX source-order precedence between the
 * Cassida spread and any pre-existing `style=` / `className=`
 * attribute. JSX evaluates spread props left-to-right and a later
 * write overrides an earlier one — so:
 *   `<div style={x} {...cas(...)} />`  →  casWins: true
 *   `<div {...cas(...)} style={x} />`  →  casWins: false
 * Plugins that emit a merged `style=` must thread this through to
 * `helpers.mergeStyleExpression` (or otherwise pick the right order)
 * so user-written declarations override or are overridden by
 * Cassida's based on the same rule the bare-chain path uses.
 */
export interface ExistingHostAttrs {
  readonly className: t.JSXAttribute | null;
  readonly style: t.JSXAttribute | null;
  readonly casWins: boolean;
}

export interface TransformResult {
  readonly code: string;
  readonly rules: readonly CompiledRule[];
  readonly map: object | null;
  readonly transformed: boolean;
}

const NON_LITERAL: unique symbol = Symbol('fss.non-literal');
type NonLiteral = typeof NON_LITERAL;

interface WalkContext {
  readonly dynamicSources: Map<string, t.Expression>;
  readonly counter: { n: number };
  /**
   * Cross-file evaluator config. `null` means "skip the import-graph
   * walk entirely" — used when the user opted out or when no filename
   * was provided to anchor resolution.
   */
  readonly crossFile: CrossFileConfig | null;
}

interface CrossFileConfig {
  readonly filename: string;
  readonly cache?: ModuleCache;
}

/**
 * Internal-only sentinel emitted by `walkChain` when it encounters a
 * `.cond(test, cbT, cbF?)` call. Carries the test expression and each
 * branch's flat ops. The top-level handler in `JSXSpreadAttribute`
 * uses `expandBranches` to multiply the surrounding chain's ops with
 * the truthy / falsy alternatives into a Cartesian set of `ChainLeaf`s.
 *
 * Not exported and not a runtime `Op`: this only lives inside the
 * parser between walk-time and Cartesian expansion.
 */
interface BranchPlaceholder {
  readonly __branch: {
    readonly test: t.Expression;
    readonly truthyOps: readonly ExtendedOp[];
    readonly falsyOps: readonly ExtendedOp[];
  };
}

/**
 * Parser-internal mirror of `ScopedOp` whose inner ops may carry
 * `BranchPlaceholder`s. `expandBranches` peels the placeholders out
 * and emits regular `ScopedOp`s (with `Op[]` inner ops) in each leaf.
 */
interface ExtendedScopedOp {
  readonly scope: Scope;
  readonly ops: readonly ExtendedOp[];
}

type ExtendedOp = MethodOp | RawOp | ExtendedScopedOp | BranchPlaceholder;

function isBranchPlaceholder(op: ExtendedOp): op is BranchPlaceholder {
  return typeof op === 'object' && op !== null && '__branch' in op;
}

function isExtendedScopedOp(op: ExtendedOp): op is ExtendedScopedOp {
  return typeof op === 'object' && op !== null && 'scope' in op && 'ops' in op;
}

/**
 * DFS check: does any node in this ExtendedOp tree carry a
 * `BranchPlaceholder`? Used by code paths that don't (yet) support
 * cond-expanded chains — parser plugins, function composition — so
 * they can bail on chains whose branches live anywhere in the tree,
 * not just at the top level.
 */
function hasAnyBranchPlaceholder(ops: readonly ExtendedOp[]): boolean {
  for (const op of ops) {
    if (isBranchPlaceholder(op)) return true;
    if (isExtendedScopedOp(op) && hasAnyBranchPlaceholder(op.ops)) return true;
  }
  return false;
}

/**
 * One decision (`test`, branch taken) recorded for a `ChainLeaf`. The
 * sequence of decisions in order encodes the path through the
 * Cartesian product of `.cond()` calls that produced this leaf.
 */
interface BranchDecision {
  readonly test: t.Expression;
  readonly isTruthy: boolean;
}

/**
 * One leaf of a chain after `.cond()` expansion: the flat op sequence
 * for this Cartesian branch, plus the decisions that selected it.
 * `conditions.length === 0` denotes a chain with no `.cond()` calls
 * (and `BranchedChain.length === 1` in that case).
 */
interface ChainLeaf {
  readonly ops: Op[];
  readonly conditions: readonly BranchDecision[];
}

type BranchedChain = readonly ChainLeaf[];

/**
 * Safety cap on Cartesian explosion. Five nested `.cond()`s = 32
 * compiled classes. Beyond this the build cost grows fast and the
 * JSX-output ternary depth becomes unreadable — users should refactor
 * to a higher-level switch.
 */
const MAX_BRANCH_LEAVES = 32;

/**
 * Build a nested ternary that picks the right per-leaf value
 * out of a set of compiled leaves. The recursion splits on each
 * decision in order, producing
 *
 *     test_0 ? (test_1 ? leaf_tt : leaf_tf) : (test_1 ? leaf_ft : leaf_ff)
 *
 * for two `.cond()`s. The shape matches the order the `.cond()` calls
 * appeared in source. `leafExpr` materializes whatever the caller
 * wants at each leaf (a className `StringLiteral` or a style
 * `ObjectExpression`).
 *
 * Leaves can have variable `conditions.length` when a `.cond()` lives
 * inside one branch of an outer `.cond()` (or inside a modifier scope
 * inside such a branch). A leaf whose path didn't pass through a
 * particular `.cond()` has a shorter `conditions` array. By the
 * expansion invariant, at any recursion level every leaf either has
 * empty conditions (then the level emits a single leaf) or shares
 * `conditions[0].test` (then the level splits and recurses).
 */
function buildBranchedExpr(
  leaves: readonly { readonly leaf: ChainLeaf; readonly rule: CompiledRule }[],
  leafExpr: (rule: CompiledRule) => t.Expression,
): t.Expression {
  if (leaves.length === 0) {
    throw new Error('[cassida] internal: empty leaf group in buildBranchedExpr');
  }
  if (leaves.every((l) => l.leaf.conditions.length === 0)) {
    if (leaves.length !== 1) {
      throw new Error(
        `[cassida] internal: ${leaves.length} leaves landed at the empty-conditions base case`,
      );
    }
    return leafExpr(leaves[0]!.rule);
  }
  // All sibling leaves share the same `conditions[0].test` AST node —
  // they all came from the same `.cond()` call. Clone for each emission
  // so Babel's parent-pointer bookkeeping stays consistent.
  const head = leaves.find((l) => l.leaf.conditions.length > 0)!;
  const test = head.leaf.conditions[0]!.test;
  const truthy: (typeof leaves)[number][] = [];
  const falsy: (typeof leaves)[number][] = [];
  for (const l of leaves) {
    const next = {
      leaf: { ...l.leaf, conditions: l.leaf.conditions.slice(1) },
      rule: l.rule,
    };
    if (l.leaf.conditions[0]!.isTruthy) {
      truthy.push(next);
    } else {
      falsy.push(next);
    }
  }
  return t.conditionalExpression(
    t.cloneNode(test),
    buildBranchedExpr(truthy, leafExpr),
    buildBranchedExpr(falsy, leafExpr),
  );
}

function mustGetDynamicSource(
  slot: DynamicSlot,
  dynamicSources: ReadonlyMap<string, t.Expression>,
): t.Expression {
  const node = dynamicSources.get(slot.sourceId);
  if (!node) {
    throw new Error(`[cassida] internal: missing source AST for slot ${slot.sourceId}`);
  }
  return node;
}

/**
 * Expand an `ExtendedOp[]` (walker output, possibly with branch
 * placeholders, including ones nested inside modifier scopes) into the
 * Cartesian set of leaves. Each placeholder doubles the leaf count:
 * every existing leaf becomes two, one with the placeholder's truthy
 * ops appended + decision (test, true), one with the falsy ops + decision
 * (test, false). Scopes whose inner ops carry placeholders recurse: the
 * scope is materialized once per inner-leaf, multiplying outer leaves
 * accordingly.
 *
 * Invariant: every leaf returned has `ops: Op[]` (no placeholders, no
 * extended scopes) — the recursion strips them out.
 */
function expandBranches(ops: readonly ExtendedOp[]): BranchedChain {
  type Leaf = { ops: Op[]; conditions: BranchDecision[] };
  let leaves: Leaf[] = [{ ops: [], conditions: [] }];
  const checkCap = (): void => {
    if (leaves.length > MAX_BRANCH_LEAVES) {
      throw new Error(
        `[cassida] .cond() Cartesian expansion exceeds ${MAX_BRANCH_LEAVES} leaves. ` +
          `Each nested .cond() doubles the class count; refactor to a higher-level switch ` +
          `(JSX ternary spread, or a lookup table) when the matrix gets this dense.`,
      );
    }
  };
  for (const op of ops) {
    if (isBranchPlaceholder(op)) {
      const { test, truthyOps, falsyOps } = op.__branch;
      const truthyLeaves = expandBranches(truthyOps);
      const falsyLeaves = expandBranches(falsyOps);
      const next: Leaf[] = [];
      for (const leaf of leaves) {
        for (const t of truthyLeaves) {
          next.push({
            ops: [...leaf.ops, ...t.ops],
            conditions: [
              ...leaf.conditions,
              { test, isTruthy: true },
              ...t.conditions,
            ],
          });
        }
        for (const f of falsyLeaves) {
          next.push({
            ops: [...leaf.ops, ...f.ops],
            conditions: [
              ...leaf.conditions,
              { test, isTruthy: false },
              ...f.conditions,
            ],
          });
        }
      }
      leaves = next;
      checkCap();
    } else if (isExtendedScopedOp(op)) {
      const innerLeaves = expandBranches(op.ops);
      // Fast path: no branches inside the scope. The inner expansion
      // returns exactly one leaf with empty conditions; append the
      // materialised ScopedOp to every outer leaf in place.
      if (innerLeaves.length === 1 && innerLeaves[0]!.conditions.length === 0) {
        const inner = innerLeaves[0]!;
        const scopedOp: Op = { scope: op.scope, ops: inner.ops };
        for (const leaf of leaves) leaf.ops.push(scopedOp);
        continue;
      }
      const next: Leaf[] = [];
      for (const leaf of leaves) {
        for (const inner of innerLeaves) {
          next.push({
            ops: [...leaf.ops, { scope: op.scope, ops: inner.ops }],
            conditions: [...leaf.conditions, ...inner.conditions],
          });
        }
      }
      leaves = next;
      checkCap();
    } else {
      for (const leaf of leaves) leaf.ops.push(op);
    }
  }
  return leaves;
}

export function transform(source: string, options: TransformOptions): TransformResult {
  const importSource = options.importSource ?? '@cassida/core';

  const plugins: ParserPlugin[] = ['jsx'];
  if (/\.tsx?$/.test(options.filename ?? '')) plugins.push('typescript');

  const parseOpts: Parameters<typeof parse>[1] = {
    sourceType: 'module',
    plugins,
  };
  if (options.filename !== undefined) parseOpts.sourceFilename = options.filename;
  const ast = parse(source, parseOpts);

  // First pass: collect every local name bound to a Cassida chain
  // entry point (`cas`, `css`, or `cassida` — all aliases for the same
  // function in @cassida/core). Default-export imports are also
  // accepted (`import cas from '@cassida/core'`).
  const chainEntryNames = new Set(['cas', 'css', 'cassida']);
  const casBindings = new Set<string>();
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== importSource) return;
      for (const spec of path.node.specifiers) {
        if (t.isImportDefaultSpecifier(spec)) {
          casBindings.add(spec.local.name);
          continue;
        }
        if (
          t.isImportSpecifier(spec) &&
          t.isIdentifier(spec.imported) &&
          chainEntryNames.has(spec.imported.name)
        ) {
          casBindings.add(spec.local.name);
        }
      }
    },
  });

  // Fast-path: no Cassida chain bindings AND no parser plugins → no
  // spread the parser could possibly transform. Plugins, however,
  // may recognize spread shapes that don't reference `cas` at all
  // (custom DSLs, marker identifiers), so when plugins are
  // registered we still run the visitor.
  if (casBindings.size === 0 && (options.parserPlugins?.length ?? 0) === 0) {
    return { code: source, rules: [], map: null, transformed: false };
  }

  const rules: CompiledRule[] = [];
  let transformed = false;
  const dynamicSources = new Map<string, t.Expression>();
  const counter = { n: 0 };
  const crossFile = resolveCrossFileConfig(options);
  const ctx: WalkContext = { dynamicSources, counter, crossFile };
  const parserPlugins = options.parserPlugins ?? [];

  /**
   * Apply a plugin-produced `SpreadPlan` to the JSX element that
   * hosts the spread. Mirrors the attribute-rewriting logic the
   * default single-chain handler uses, but defers the attr shape
   * to `plan.buildAttrs` so the plugin owns the merge with
   * existing className / style.
   */
  function applyPluginSpreadPlan(
    path: NodePath<t.JSXSpreadAttribute>,
    plan: SpreadPlan,
  ): void {
    const opening = path.parent;
    if (!t.isJSXOpeningElement(opening)) return;

    const {
      spreadIdx,
      styleIdx,
      classNameIdx,
      existingStyleAttr,
      existingClassNameAttr,
    } = findAttributeIndices(opening, path.node);

    // Cas spread comes AFTER the host style attr → cas keys override
    // user-written ones on collision (the later spread / attr wins).
    // Matches the single-chain handler's `casWins` semantics below.
    const casWins = spreadIdx > styleIdx;
    const newSpreadAttrs = plan.buildAttrs({
      className: existingClassNameAttr,
      style: existingStyleAttr,
      casWins,
    });

    // The plan's attrs determine the final shape. If the plan
    // doesn't return a className / style attr, the existing one is
    // kept; if it does, the existing one is replaced.
    const planAttrNames = new Set<string>();
    for (const attr of newSpreadAttrs) {
      if (t.isJSXIdentifier(attr.name)) planAttrNames.add(attr.name.name);
    }

    for (const rule of plan.rules) rules.push(rule);

    opening.attributes = rebuildAttributes(
      opening,
      spreadIdx,
      newSpreadAttrs,
      classNameIdx >= 0 && planAttrNames.has('className') ? classNameIdx : null,
      styleIdx >= 0 && planAttrNames.has('style') ? styleIdx : null,
    );
  }

  /**
   * Helpers handed to parser plugins. Wraps the parser's internal
   * walkers so plugins can compose them on sub-expressions without
   * re-implementing the chain logic. Each helper is a thin façade
   * with no plugin-specific state.
   */
  const pluginHelpers: ParserPluginHelpers = {
    // The legacy plugin helper exposes `Op[] | null`. Internally the
    // walker now returns `ExtendedOp[]` and may include
    // BranchPlaceholders for `.cond()`-bearing chains. The plugin
    // helper bails (returns null) on branched chains for back-compat;
    // plugins that want cond support can be added later via a richer
    // helper. For now the top-level JSX handler is the only consumer
    // that branches matter for.
    walkChain: (p) => {
      const ext = walkChain(p, casBindings, ctx);
      if (ext === null) return null;
      if (hasAnyBranchPlaceholder(ext)) return null;
      return ext as Op[];
    },
    compileOps: (chainOps) =>
      compileOps(chainOps, {
        registry: options.registry,
        ...(options.shorthandPolicy !== undefined
          ? { shorthandPolicy: options.shorthandPolicy }
          : {}),
        ...(options.plugins !== undefined ? { plugins: options.plugins } : {}),
      }),
    peelPropsAccess,
    registerDynamicSource: (node) => {
      const id = `slot-${++ctx.counter.n}`;
      ctx.dynamicSources.set(id, node);
      return id;
    },
    makeClassNameAttr,
    makeStyleAttr,
    getDynamicSource: (sourceId) => {
      const node = ctx.dynamicSources.get(sourceId);
      if (!node) {
        throw new Error(
          `[cassida] parser plugin requested an unknown dynamic source id "${sourceId}". ` +
            `Did the plugin compile the chain via helpers.compileOps?`,
        );
      }
      return node;
    },
    mergeStyleExpression,
  };

  /**
   * Returns `true` if the spread at `siblingIndex` on the host
   * element would be claimed by Cassida — either by the default
   * bare-chain walker OR by any registered parser plugin. Uses
   * isolated probe contexts so the probe never mutates the real
   * dynamic-slot or rules state.
   *
   * Direct NodePath access via `parentPath.get('attributes')[i]` —
   * cheaper than a Babel `traverse(parentPath, ...)` lookup,
   * especially when an element has many sibling attributes.
   */
  function isCassidaClaimedSpread(
    siblingIndex: number,
    fromPath: NodePath<t.JSXSpreadAttribute>,
  ): boolean {
    const parentPath = fromPath.parentPath;
    if (!parentPath || !parentPath.isJSXOpeningElement()) return false;
    const attrPaths = parentPath.get('attributes');
    const attrPath = attrPaths[siblingIndex];
    if (!attrPath || !attrPath.isJSXSpreadAttribute()) return false;
    const probeArgPath = peelPropsAccess(attrPath.get('argument'));
    const probeCtx: WalkContext = {
      dynamicSources: new Map(),
      counter: { n: 0 },
      crossFile,
    };
    // 1) Bare-chain claim.
    if (walkChain(probeArgPath, casBindings, probeCtx) !== null) return true;
    // 2) Plugin claims. Build a throwaway helper bound to the probe
    // ctx so any dynamic-slot registrations the plugin triggers
    // during detection don't leak into the real state.
    const probeHelpers: ParserPluginHelpers = {
      walkChain: (q) => {
        const ext = walkChain(q, casBindings, probeCtx);
        if (ext === null) return null;
        if (ext.some(isBranchPlaceholder)) return null;
        return ext as Op[];
      },
      compileOps: (chainOps) =>
        compileOps(chainOps, {
          registry: options.registry,
          ...(options.shorthandPolicy !== undefined
            ? { shorthandPolicy: options.shorthandPolicy }
            : {}),
          ...(options.plugins !== undefined
            ? { plugins: options.plugins }
            : {}),
        }),
      peelPropsAccess,
      registerDynamicSource: (node) => {
        const id = `probe-slot-${++probeCtx.counter.n}`;
        probeCtx.dynamicSources.set(id, node);
        return id;
      },
      makeClassNameAttr,
      makeStyleAttr,
      getDynamicSource: (sourceId) => {
        const node = probeCtx.dynamicSources.get(sourceId);
        if (!node) {
          throw new Error(
            `[cassida] parser plugin requested an unknown dynamic source id "${sourceId}" during probe.`,
          );
        }
        return node;
      },
      mergeStyleExpression,
    };
    for (const plugin of parserPlugins) {
      if (!plugin.trySpread) continue;
      try {
        if (plugin.trySpread(probeArgPath, probeHelpers) !== null) return true;
      } catch {
        // A plugin that throws during probe is treated as
        // non-claiming. The "real" pass below will re-invoke
        // and surface the error with the proper code-frame.
      }
    }
    return false;
  }

  /**
   * Throw if the host element carries any *other* Cassida-claimed
   * spread besides the current one. Single Class Principle demands
   * one chain per element; multi-spread is an authorship mistake.
   */
  function assertNoOtherCassidaSpreads(
    opening: t.JSXOpeningElement,
    path: NodePath<t.JSXSpreadAttribute>,
  ): void {
    for (let i = 0; i < opening.attributes.length; i++) {
      const a = opening.attributes[i]!;
      if (a === path.node || !t.isJSXSpreadAttribute(a)) continue;
      if (isCassidaClaimedSpread(i, path)) {
        throw path.buildCodeFrameError(
          '[cassida] Multiple {...cas()} spreads on the same JSX element are not supported. Combine them into a single chain.',
        );
      }
    }
  }

  traverse(ast, {
    JSXSpreadAttribute(path) {
      // path.get('argument') on a typed NodePath<JSXSpreadAttribute>
      // returns NodePath<Expression>; no cast needed.
      const argPath = peelPropsAccess(path.get('argument'));

      const ext = walkChain(argPath, casBindings, ctx);
      if (ext === null) {
        // Bare chain didn't match. Give registered parser plugins a
        // turn before we leave the JSX untouched. First-match wins;
        // each plugin is responsible for its own conservative-bail
        // semantics so others get a turn when a plugin defers.
        for (const plugin of parserPlugins) {
          if (!plugin.trySpread) continue;
          let plan: SpreadPlan | null;
          try {
            plan = plugin.trySpread(argPath, pluginHelpers);
          } catch (err) {
            throw path.buildCodeFrameError(
              `[cassida] parser plugin "${plugin.name}" threw while handling a JSX spread: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
          if (plan === null) continue;
          // Same multi-spread guard as the default path — plugin-
          // claimed spreads count just as much as bare-chain ones.
          const opening = path.parent;
          if (t.isJSXOpeningElement(opening)) {
            assertNoOtherCassidaSpreads(opening, path);
          }
          applyPluginSpreadPlan(path, plan);
          transformed = true;
          return;
        }
        return;
      }

      const opening = path.parent;
      if (!t.isJSXOpeningElement(opening)) return;

      assertNoOtherCassidaSpreads(opening, path);

      // Split the static-chain path from the branched-chain path. A
      // chain with no `.cond()` calls produces a single leaf with no
      // conditions; the existing single-class emission handles that
      // efficiently. Cond-bearing chains go through `handleBranched`
      // which materializes every Cartesian leaf and emits nested
      // className / style ternaries.
      const branched = expandBranches(ext);
      if (branched.length === 1 && branched[0]!.conditions.length === 0) {
        handleSingleChain(path, opening, branched[0]!.ops);
      } else {
        handleBranchedChain(path, opening, branched);
      }
      transformed = true;
    },
  });

  function handleSingleChain(
    path: NodePath<t.JSXSpreadAttribute>,
    opening: t.JSXOpeningElement,
    ops: Op[],
  ): void {
    const compiled = compileOps(ops, {
      registry: options.registry,
      ...(options.shorthandPolicy !== undefined ? { shorthandPolicy: options.shorthandPolicy } : {}),
      ...(options.plugins !== undefined ? { plugins: options.plugins } : {}),
    });
    rules.push(compiled);

    const {
      spreadIdx,
      styleIdx,
      classNameIdx,
      existingStyleAttr,
      existingClassNameAttr,
    } = findAttributeIndices(opening, path.node);

    const casWins = spreadIdx > styleIdx;
    const casBaseCssProps = Object.keys(compiled.tree.bag);

    const newClassNameAttr = makeClassNameAttr(existingClassNameAttr, compiled.className);
    const styleResult = decideStyleAttr(
      existingStyleAttr,
      compiled.dynamics,
      casBaseCssProps,
      dynamicSources,
      casWins,
    );

    const replacement: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [
      newClassNameAttr,
    ];
    if (styleResult.attr !== null) replacement.push(styleResult.attr);
    opening.attributes = rebuildAttributes(
      opening,
      spreadIdx,
      replacement,
      classNameIdx >= 0 ? classNameIdx : null,
      styleIdx >= 0 && styleResult.replacesExisting ? styleIdx : null,
    );
  }

  /**
   * Emit the JSX shape for a `.cond()`-expanded chain. Each leaf
   * compiles to its own `cas-XXXXXXXX` class, and the className
   * attribute becomes a balanced nested ternary that picks the right
   * class for the runtime test outcomes. Branches that carry dynamic
   * slots also produce a parallel `style={...}` nested ternary; the
   * empty-style side is `void 0` so React skips application cleanly.
   */
  function handleBranchedChain(
    path: NodePath<t.JSXSpreadAttribute>,
    opening: t.JSXOpeningElement,
    leaves: BranchedChain,
  ): void {
    const compiledLeaves = leaves.map((leaf) => ({
      leaf,
      rule: compileOps(leaf.ops, {
        registry: options.registry,
        ...(options.shorthandPolicy !== undefined
          ? { shorthandPolicy: options.shorthandPolicy }
          : {}),
        ...(options.plugins !== undefined ? { plugins: options.plugins } : {}),
      }),
    }));
    for (const { rule } of compiledLeaves) rules.push(rule);

    const classNameExpr = buildBranchedExpr(compiledLeaves, (rule) =>
      t.stringLiteral(rule.className),
    );

    const anyDynamic = compiledLeaves.some(({ rule }) => rule.dynamics.length > 0);
    const styleExpr = anyDynamic
      ? buildBranchedExpr(compiledLeaves, (rule) => {
          if (rule.dynamics.length === 0) {
            return t.unaryExpression('void', t.numericLiteral(0));
          }
          return t.objectExpression(
            rule.dynamics.map((slot) =>
              t.objectProperty(
                t.stringLiteral(slot.varName),
                mustGetDynamicSource(slot, dynamicSources),
              ),
            ),
          );
        })
      : null;

    const {
      spreadIdx,
      styleIdx,
      classNameIdx,
      existingStyleAttr,
      existingClassNameAttr,
    } = findAttributeIndices(opening, path.node);

    const newClassNameAttr = makeClassNameAttr(existingClassNameAttr, classNameExpr);
    // Match `handleSingleChain` / `applyPluginSpreadPlan`: cas-side
    // keys win on collision when the Cassida spread appears after the
    // host `style=` attr in source order. Reverse case (cas first,
    // user style last) preserves the user-written declarations.
    const casWins = spreadIdx > styleIdx;
    const newStyleAttr =
      styleExpr === null
        ? null
        : mergeStyleExpression(existingStyleAttr, styleExpr, casWins);

    const replacement: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [
      newClassNameAttr,
    ];
    if (newStyleAttr !== null) replacement.push(newStyleAttr);

    opening.attributes = rebuildAttributes(
      opening,
      spreadIdx,
      replacement,
      classNameIdx >= 0 ? classNameIdx : null,
      styleIdx >= 0 && newStyleAttr !== null ? styleIdx : null,
    );
  }

  if (!transformed) {
    return { code: source, rules: [], map: null, transformed: false };
  }

  const generateOpts: Parameters<typeof generate>[1] = {
    sourceMaps: true,
    retainLines: false,
  };
  if (options.filename !== undefined) generateOpts.sourceFileName = options.filename;
  const out = generate(ast, generateOpts, source);
  return { code: out.code, rules, map: out.map ?? null, transformed: true };
}

/**
 * Strip a trailing `.props` member access from a JSX-spread argument.
 *
 * From v0.3 the documented shape is `{...cas().X().props}` — the
 * terminator that exposes only `{ className, style }` to JSX so the
 * chain's CSS-property-named methods don't collide with React's HTML
 * attribute typings. The parser treats `<chain>.props` as an
 * equivalent walking root to the bare chain; the rewrite output is
 * identical for both forms, so this helper just peels and hands the
 * inner path to `walkChain`.
 *
 * Bare chains (`{...cas()...}` without `.props`) pass through
 * unchanged for the v0.3.x migration window.
 */
function peelPropsAccess(argPath: NodePath): NodePath {
  const memberArg = pathAs(argPath, t.isMemberExpression);
  if (!memberArg || memberArg.node.computed) return argPath;
  const propPath = pathAs(memberArg.get('property'), t.isIdentifier);
  if (!propPath || propPath.node.name !== 'props') return argPath;
  return memberArg.get('object');
}

/**
 * Walks a `cas().a().b()...` chain backward from the outermost call,
 * accumulating ops in source order. Modifiers (`hover`, `focus`,
 * `media`, `on`, …) recurse into their callback's body.
 *
 * Type-narrowing is handled through `pathAs`, so this function never
 * needs to spread `as NodePath` casts. Once a path is confirmed to be
 * a `CallExpression`, `path.get('callee')` and `.get('arguments')`
 * return correctly typed sub-paths automatically.
 *
 * Returns null when the expression isn't rooted at one of `chainRoots`,
 * an op has unsupported argument shape (mixed dynamic+literal, spread
 * arguments, multiple-or-zero callback params, etc.), or any other
 * structural mismatch. On null the caller leaves the JSX untouched.
 */
function walkChain(
  start: NodePath,
  chainRoots: ReadonlySet<string>,
  ctx: WalkContext,
): ExtendedOp[] | null {
  const ops: ExtendedOp[] = [];
  let current: NodePath = start;

  while (true) {
    // Inner-chain root: bare Identifier matching a callback param.
    const idPath = pathAs(current, t.isIdentifier);
    if (idPath && chainRoots.has(idPath.node.name)) break;

    // Otherwise current must be a CallExpression to continue.
    const callPath = pathAs(current, t.isCallExpression);
    if (!callPath) return null;

    const calleePath = callPath.get('callee');

    // Branch A: callee is `obj.method(...)` — descend the chain or
    // intercept the special `cas.unsafe(preset)` chain root.
    const memberPath = pathAs(calleePath, t.isMemberExpression);
    if (memberPath && !memberPath.node.computed) {
      const propertyPath = pathAs(memberPath.get('property'), t.isIdentifier);
      if (!propertyPath) return null;
      const methodName = propertyPath.node.name;
      const argPaths = callPath.get('arguments');

      // Special case: `cas.unsafe(preset)` at the chain root. Detected
      // when the member-object is the chain-root identifier itself
      // (i.e. `fss`, not a callback param) AND the property is
      // `unsafe`. The preset object is expanded into RawOps which
      // bypass the registry — this is the user's deliberate opt-out
      // of FSS's safety guarantees, in the spirit of Rust's `unsafe`.
      const memberObjId = pathAs(memberPath.get('object'), t.isIdentifier);
      if (
        memberObjId &&
        chainRoots.has(memberObjId.node.name) &&
        methodName === 'unsafe'
      ) {
        if (argPaths.length !== 1) return null;
        const evald = argPaths[0]!.evaluate();
        if (!evald.confident) return null;
        const value = evald.value;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return null;
        }
        const expanded = expandUnsafePreset(value as Record<string, unknown>);
        for (let i = expanded.length - 1; i >= 0; i--) ops.push(expanded[i]!);
        break;
      }

      if (methodName === 'cond') {
        // .cond(test, cbT, cbF?) — chain-internal branching. Recorded
        // as a BranchPlaceholder; expandBranches multiplies the
        // surrounding ops with each branch's inner ops into a
        // Cartesian set of leaves. Each leaf compiles to its own
        // `cas-XXXXXXXX` class; the JSX-side ternary picks among them
        // at runtime using the original `test` expression.
        //
        // BranchPlaceholders can appear at the top level OR nested
        // inside a modifier scope (`.hover(c => c.cond(...))`).
        // `expandBranches` recurses into ExtendedScopedOp.ops to find
        // them and lifts the resulting Cartesian product to the top.
        if (argPaths.length < 2 || argPaths.length > 3) return null;
        const testArg = argPaths[0]!;
        if (!t.isExpression(testArg.node)) return null;
        const truthyOps = collectFromCallback(argPaths[1]!, ctx);
        if (truthyOps === null) return null;
        const falsyOps =
          argPaths.length === 3 ? collectFromCallback(argPaths[2]!, ctx) : [];
        if (falsyOps === null) return null;
        ops.push({
          __branch: {
            test: testArg.node,
            truthyOps,
            falsyOps,
          },
        });
        current = memberPath.get('object');
        continue;
      }

      if (methodName === 'set') {
        // .set(key, value) — direct CSS property write, bypasses registry.
        // Both args must be confidently-evaluable; non-confident
        // arguments fall through to the runtime fallback for now.
        // (Phase 7: extend RawOp to carry dynamic source IDs.)
        if (argPaths.length !== 2) return null;
        const keyEval = argPaths[0]!.evaluate();
        if (!keyEval.confident || typeof keyEval.value !== 'string') return null;
        const valEval = argPaths[1]!.evaluate();
        if (!valEval.confident) return null;
        const valid = EvaluatedPrimitiveSchema.safeParse(valEval.value);
        if (!valid.success) return null;
        ops.push({
          property: camelToKebab(keyEval.value),
          value: String(valid.data),
        });
        current = memberPath.get('object');
        continue;
      }

      if (methodName in canonicalModifiers) {
        if (argPaths.length !== 1) return null;
        const innerOps = collectFromCallback(argPaths[0]!, ctx);
        if (innerOps === null) return null;
        const scope = canonicalModifiers[methodName as keyof typeof canonicalModifiers];
        ops.push({ scope, ops: innerOps });
      } else if (methodName in argModifiers) {
        if (argPaths.length !== 2) return null;
        const argEval = argPaths[0]!.evaluate();
        if (!argEval.confident || typeof argEval.value !== 'string') return null;
        const innerOps = collectFromCallback(argPaths[1]!, ctx);
        if (innerOps === null) return null;
        const scope = inferScope(
          methodName as keyof typeof argModifiers,
          argEval.value,
        );
        ops.push({ scope, ops: innerOps });
      } else {
        const args = readArgs(argPaths, ctx);
        if (args === null) return null;
        const dynamics = args.filter(isDynamic);
        if (dynamics.length > 0 && (args.length !== 1 || dynamics.length !== 1)) {
          return null;
        }
        ops.push({ method: methodName, args });
      }

      current = memberPath.get('object');
      continue;
    }

    // Branch B: callee is the chain root identifier `cas()`.
    const casIdPath = pathAs(calleePath, t.isIdentifier);
    if (casIdPath && chainRoots.has(casIdPath.node.name)) {
      if (callPath.node.arguments.length === 0) break;
      if (callPath.node.arguments.length !== 1) return null;
      const argPaths = callPath.get('arguments');
      const evald = argPaths[0]!.evaluate();
      if (!evald.confident) return null;
      const value = evald.value;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
      }
      const expanded = expandSafePreset(value as Record<string, unknown>);
      if (!expanded) return null;
      for (let i = expanded.length - 1; i >= 0; i--) ops.push(expanded[i]!);
      break;
    }

    // Branch C: callee is an Identifier that's NOT a chain root.
    // Treat as same-file function composition: `withCard(cas())` etc.
    // The function must be a 1-param const arrow / function declaration
    // whose body is a chain rooted at the param. The function's body
    // ops are appended to the argument's ops in source order.
    if (casIdPath) {
      const composed = tryFunctionComposition(callPath, casIdPath, chainRoots, ctx);
      if (composed === null) return null;
      // Push reversed so the composition lands first after the final reverse.
      for (let i = composed.length - 1; i >= 0; i--) ops.push(composed[i]!);
      break;
    }

    return null;
  }

  return ops.reverse();
}

/**
 * Attempts to resolve a same-file function composition like
 * `withCard(cas())` or `withCard(withTheme(cas()))`. Returns the
 * composed source-ordered Op list or null if the call doesn't fit
 * the supported pattern.
 *
 * Phase 6c-2 supports:
 *   - `const f = (c) => c.chain()` (ArrowFunctionExpression, 1 param)
 *   - `const f = (c) => { c.chain(); }` or `{ return c.chain(); }`
 *   - `function f(c) { ... }` (FunctionDeclaration, 1 param)
 *
 * Phase 7 will tackle: multi-param functions, conditional bodies,
 * loops, and cross-file imports (Linaria-class static evaluation).
 * Anything outside the simple pattern returns null and the caller
 * lets the chain fall through to runtime fallback.
 */
function tryFunctionComposition(
  callPath: NodePath<t.CallExpression>,
  calleeIdPath: NodePath<t.Identifier>,
  chainRoots: ReadonlySet<string>,
  ctx: WalkContext,
): ExtendedOp[] | null {
  const fnName = calleeIdPath.node.name;
  const binding = calleeIdPath.scope.getBinding(fnName);
  if (!binding) return null;
  // Only `const` bindings or function declarations are accepted —
  // `let`/`var` could be reassigned and we can't follow that.
  if (binding.kind !== 'const' && binding.kind !== 'hoisted') return null;

  // Locate the function expression (arrow or declaration).
  let paramName: string | null = null;
  let bodyPath: NodePath | null = null;

  const declPath = binding.path;
  if (t.isVariableDeclarator(declPath.node)) {
    const initPath = pathAs(declPath.get('init'), t.isArrowFunctionExpression);
    if (!initPath) return null;
    if (initPath.node.params.length !== 1) return null;
    const param = initPath.node.params[0]!;
    if (!t.isIdentifier(param)) return null;
    paramName = param.name;
    bodyPath = initPath.get('body');
  } else if (t.isFunctionDeclaration(declPath.node)) {
    const fnPath = declPath as NodePath<t.FunctionDeclaration>;
    if (fnPath.node.params.length !== 1) return null;
    const param = fnPath.node.params[0]!;
    if (!t.isIdentifier(param)) return null;
    paramName = param.name;
    bodyPath = fnPath.get('body');
  } else {
    return null;
  }

  if (paramName === null || bodyPath === null) return null;
  const innerRoots = new Set([paramName]);

  // Resolve the function body: same logic as a callback body in
  // `collectFromCallback` — expression body or block-of-chains.
  const blockPath = pathAs(bodyPath, t.isBlockStatement);
  const fnBodyOps = blockPath
    ? collectFromBlock(blockPath, innerRoots, ctx)
    : walkChain(bodyPath, innerRoots, ctx);
  if (fnBodyOps === null) return null;
  // `.cond()` is not yet permitted anywhere inside a function
  // composition's body or argument. The mixin idiom `withCard(cas())`
  // is meant for static layering; branched chains here would force
  // the composition to fan out too. Check deep, so a cond inside a
  // modifier scope inside the body also bails.
  if (hasAnyBranchPlaceholder(fnBodyOps)) return null;

  // The argument MUST be exactly 1 (the chain to feed in).
  const argPaths = callPath.get('arguments');
  if (argPaths.length !== 1) return null;
  const argPath = argPaths[0]!;
  if (!t.isExpression(argPath.node)) return null;
  // Walk the argument with the OUTER chainRoots — typically `fss`,
  // sometimes a recursive composition's own scope.
  const argExt = walkChain(argPath, chainRoots, ctx);
  if (argExt === null) return null;
  if (hasAnyBranchPlaceholder(argExt)) return null;

  // Compose: argument ops first (the input chain), then function body
  // ops (the mixin layered on top). LIFO inside the merged op list
  // works exactly as if the user had written everything inline.
  return [...argExt, ...fnBodyOps];
}

function collectFromCallback(
  cbPath: NodePath,
  ctx: WalkContext,
): ExtendedOp[] | null {
  const arrowPath = pathAs(cbPath, t.isArrowFunctionExpression);
  if (!arrowPath) return null;

  const params = arrowPath.node.params;
  if (params.length === 0) return [];
  if (params.length > 1) return null;
  const param = params[0]!;
  if (!t.isIdentifier(param)) return null;
  const innerRoots = new Set([param.name]);

  const bodyPath = arrowPath.get('body');
  const blockPath = pathAs(bodyPath, t.isBlockStatement);
  return blockPath
    ? collectFromBlock(blockPath, innerRoots, ctx)
    : walkChain(bodyPath, innerRoots, ctx);
}

function collectFromBlock(
  blockPath: NodePath<t.BlockStatement>,
  innerRoots: ReadonlySet<string>,
  ctx: WalkContext,
): ExtendedOp[] | null {
  const allOps: ExtendedOp[] = [];
  const stmtPaths = blockPath.get('body');
  for (const stmtPath of stmtPaths) {
    const exprStmtPath = pathAs(stmtPath, t.isExpressionStatement);
    if (exprStmtPath) {
      const ext = walkChain(exprStmtPath.get('expression'), innerRoots, ctx);
      if (ext === null) return null;
      allOps.push(...ext);
      continue;
    }
    const returnStmtPath = pathAs(stmtPath, t.isReturnStatement);
    if (returnStmtPath) {
      // ReturnStatement.argument is `Expression | null | undefined`;
      // `pathAs` (with its widened input type) handles the nullable
      // generic and narrows to NodePath<Expression> in one step.
      const exprPath = pathAs(returnStmtPath.get('argument'), t.isExpression);
      if (!exprPath) continue;
      const ext = walkChain(exprPath, innerRoots, ctx);
      if (ext === null) return null;
      allOps.push(...ext);
      continue;
    }
    return null;
  }
  return allOps;
}

function readArgs(argPaths: readonly NodePath[], ctx: WalkContext): unknown[] | null {
  const out: unknown[] = [];
  for (const argPath of argPaths) {
    const node = argPath.node;
    if (!t.isExpression(node)) return null;

    // 1) Plain literal — fastest path.
    const lit = literalToValue(node);
    if (lit !== NON_LITERAL) {
      out.push(lit);
      continue;
    }

    // 2) Babel's static evaluator. Validate the evaluated result is a
    // CSS-inlineable primitive — confidently-evaluated objects, arrays,
    // and undefineds fall through to dynamic-CSS-variable handling.
    const evald = argPath.evaluate();
    if (evald.confident) {
      const validated = EvaluatedPrimitiveSchema.safeParse(evald.value);
      if (validated.success) {
        out.push(validated.data);
        continue;
      }
    }

    // 3) Cross-file static evaluator — handles design tokens defined
    // in separate modules (`import { theme } from './theme'`). Babel's
    // own evaluator stops at the import boundary; ours follows it.
    if (ctx.crossFile) {
      const folded = evaluateNode(argPath, ctx.crossFile);
      if (folded !== UNRESOLVED) {
        const validated = EvaluatedPrimitiveSchema.safeParse(folded);
        if (validated.success) {
          out.push(validated.data);
          continue;
        }
      }
    }

    // 4) Dynamic — promote to CSS variable.
    const id = `slot-${++ctx.counter.n}`;
    ctx.dynamicSources.set(id, node);
    out.push({ [DYNAMIC_TAG]: true, id });
  }
  return out;
}

/**
 * Resolves the cross-file evaluator config from `TransformOptions`.
 * Returns `null` when the evaluator is disabled or can't anchor
 * (no filename → can't resolve relative imports).
 */
function resolveCrossFileConfig(options: TransformOptions): CrossFileConfig | null {
  const flag = options.crossFileEvaluation;
  if (flag === false) return null;
  const filename = options.filename;
  if (!filename) return null;
  // Allocate a cache once per `transform()` call when the caller
  // didn't pass one. Otherwise every chain arg builds its own cache
  // and re-reads / re-parses the same imported modules — turning a
  // typical 10-method component into 10× the file IO and parse work.
  const cache = createModuleCacheLocal(flag);
  return { filename, cache };
}

function createModuleCacheLocal(
  flag: TransformOptions['crossFileEvaluation'],
): ModuleCache {
  if (typeof flag === 'object' && flag !== null && flag.cache) return flag.cache;
  return createModuleCache();
}

function inferScope(
  modifier: keyof typeof argModifiers,
  value: string,
): Scope {
  if (modifier === 'media') {
    return { kind: 'media', query: value.replace(/^@media\s*/i, '').trim() };
  }
  const trimmed = value.trim();
  if (/^@media\b/i.test(trimmed)) {
    return { kind: 'media', query: trimmed.replace(/^@media\s*/i, '').trim() };
  }
  if (trimmed.startsWith(':') || trimmed.startsWith('::')) {
    return { kind: 'pseudo', selector: trimmed };
  }
  return { kind: 'raw', selector: trimmed };
}

/**
 * Expand a confidently-evaluated preset object into a list of
 * MethodOps for the safe `cas(preset)` path. Each key becomes a
 * method call against the registry. Null/undefined values are
 * skipped (idiomatic "unset" syntax). Unknown / blacklisted keys
 * are not pre-checked here — the canonicalizer will surface them
 * with a clear "unknown method" error.
 */
function expandSafePreset(value: Record<string, unknown>): MethodOp[] | null {
  const ops: MethodOp[] = [];
  for (const [key, val] of Object.entries(value)) {
    if (val === null || val === undefined) continue;
    ops.push({ method: key, args: [val] });
  }
  return ops;
}

/**
 * Expand a preset object into RawOps for the unsafe path. Keys are
 * accepted in either camelCase (converted to kebab) or kebab-case
 * (passed through, including vendor prefixes like `-webkit-foo`).
 * Values are stringified as-is. Bypasses the registry, the
 * shorthand-policy guard, and family tracking — that's the contract
 * of `cas.unsafe`.
 */
function expandUnsafePreset(value: Record<string, unknown>): RawOp[] {
  const ops: RawOp[] = [];
  for (const [key, val] of Object.entries(value)) {
    if (val === null || val === undefined) continue;
    ops.push({ property: camelToKebab(key), value: String(val) });
  }
  return ops;
}

function camelToKebab(s: string): string {
  // Already kebab (or vendor-prefixed `-webkit-foo`) → leave alone.
  if (s.includes('-')) return s;
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function literalToValue(node: t.Node): unknown | NonLiteral {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isNumericLiteral(node)) return node.value;
  if (t.isBooleanLiteral(node)) return node.value;
  if (t.isNullLiteral(node)) return null;
  if (t.isUnaryExpression(node) && node.operator === '-') {
    const inner = literalToValue(node.argument);
    if (typeof inner === 'number') return -inner;
    return NON_LITERAL;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }
  return NON_LITERAL;
}

/**
 * Build a `className=` JSX attribute that merges Cassida's contribution
 * with the host element's existing `className` attribute. Accepts
 * either a literal class string (the default-path case) or an
 * arbitrary Expression (the plugin-path case: ternaries from
 * conditional spreads, etc.). Covers all four merge combinations
 * — no-existing, string + string, string + expression, expression
 * + expression — so plugin authors don't reimplement them.
 */
function makeClassNameAttr(
  existing: t.JSXAttribute | null,
  value: string | t.Expression,
): t.JSXAttribute {
  const asExpr: t.Expression =
    typeof value === 'string' ? t.stringLiteral(value) : value;
  const asString = typeof value === 'string' ? value : null;

  if (existing === null || existing.value === null || existing.value === undefined) {
    return t.jsxAttribute(t.jsxIdentifier('className'), wrapForAttr(asExpr));
  }
  const existingValue = existing.value;

  if (t.isStringLiteral(existingValue)) {
    // existing is "extra"; new is either string or expression.
    if (asString !== null) {
      return t.jsxAttribute(
        t.jsxIdentifier('className'),
        t.stringLiteral(`${existingValue.value} ${asString}`),
      );
    }
    // string + expression → template literal `"extra " + <expr>`
    return t.jsxAttribute(
      t.jsxIdentifier('className'),
      t.jsxExpressionContainer(
        t.templateLiteral(
          [
            t.templateElement({
              raw: `${existingValue.value} `,
              cooked: `${existingValue.value} `,
            }, false),
            t.templateElement({ raw: '', cooked: '' }, true),
          ],
          [asExpr],
        ),
      ),
    );
  }

  if (t.isJSXExpressionContainer(existingValue)) {
    const existingExpr = existingValue.expression;
    if (t.isJSXEmptyExpression(existingExpr)) {
      return t.jsxAttribute(t.jsxIdentifier('className'), wrapForAttr(asExpr));
    }
    // expression + (string | expression) → template literal that
    // composes both with a separating space.
    const suffixRaw = asString !== null ? ` ${asString}` : ' ';
    const quasis: t.TemplateElement[] =
      asString !== null
        ? [
            t.templateElement({ raw: '', cooked: '' }, false),
            t.templateElement({ raw: suffixRaw, cooked: suffixRaw }, true),
          ]
        : [
            t.templateElement({ raw: '', cooked: '' }, false),
            t.templateElement({ raw: ' ', cooked: ' ' }, false),
            t.templateElement({ raw: '', cooked: '' }, true),
          ];
    const expressions: t.Expression[] =
      asString !== null ? [existingExpr] : [existingExpr, asExpr];
    return t.jsxAttribute(
      t.jsxIdentifier('className'),
      t.jsxExpressionContainer(t.templateLiteral(quasis, expressions)),
    );
  }
  return t.jsxAttribute(t.jsxIdentifier('className'), wrapForAttr(asExpr));
}

/**
 * Wrap an expression in the form a JSX attribute value expects:
 * bare string literal stays bare; anything else becomes a
 * `JSXExpressionContainer`.
 */
function wrapForAttr(
  expr: t.Expression,
): t.StringLiteral | t.JSXExpressionContainer {
  if (t.isStringLiteral(expr)) return expr;
  return t.jsxExpressionContainer(expr);
}

/**
 * Build a `style=` JSX attribute that merges the supplied object
 * expression with the host element's existing `style`. Returns
 * `null` when there's nothing to emit (no existing, no additions).
 *
 * `casWins` controls precedence on key collision. When `true` the
 * plugin contribution comes *after* the existing object spread, so
 * its keys take effect on collision. When `false` the order is
 * reversed.
 */
function makeStyleAttr(
  existing: t.JSXAttribute | null,
  additions: t.ObjectExpression,
  casWins: boolean,
): t.JSXAttribute | null {
  const hasAdditions = additions.properties.length > 0;
  const existingExpr = getExistingStyleExpr(existing);

  if (!hasAdditions && existingExpr === null) return null;
  if (!hasAdditions) {
    // Nothing to merge; preserving the existing attr means returning
    // null and signalling "no replace" to the caller. The caller
    // keeps the original attr in place.
    return null;
  }
  if (existingExpr === null) {
    return t.jsxAttribute(
      t.jsxIdentifier('style'),
      t.jsxExpressionContainer(additions),
    );
  }

  // Both exist — emit a merged object via spread. casWins picks the
  // order; the second spread overrides on key collision.
  const merged = casWins
    ? t.objectExpression([
        t.spreadElement(existingExpr),
        ...additions.properties,
      ])
    : t.objectExpression([
        t.spreadElement(additions),
        ...(t.isObjectExpression(existingExpr)
          ? existingExpr.properties
          : [t.spreadElement(existingExpr)]),
      ]);
  return t.jsxAttribute(
    t.jsxIdentifier('style'),
    t.jsxExpressionContainer(merged),
  );
}

/**
 * Generalized `style=` merge. Accepts an arbitrary plugin-side
 * expression (e.g. a `ConditionalExpression` whose branches carry
 * different per-branch CSS-variable bindings) rather than the literal
 * object form `makeStyleAttr` requires. Used by parser plugins that
 * emit branch-conditional style — most prominently the
 * `@cassida/plugin-conditional` v2 path that lifts
 * `cond ? cas().X(dyn) : cas().Y(dyn2)` spreads.
 *
 * Merge shape (`casWins=true`):
 *
 *   no existing     → `style={pluginExpr}`
 *   existing object → `style={{...existingProps, ...pluginExpr}}`
 *   existing other  → `style={{...existingExpr, ...pluginExpr}}`
 *
 * `{...undefined}` is a no-op at runtime per spec, so a conditional
 * pluginExpr whose branches may be `void 0` composes cleanly with an
 * existing host `style`.
 */
function mergeStyleExpression(
  existing: t.JSXAttribute | null,
  pluginExpr: t.Expression,
  casWins: boolean,
): t.JSXAttribute {
  const existingExpr = getExistingStyleExpr(existing);
  if (existingExpr === null) {
    return t.jsxAttribute(
      t.jsxIdentifier('style'),
      t.jsxExpressionContainer(pluginExpr),
    );
  }

  // Both present — spread both into a fresh object. The spread that
  // comes later wins on key collision. We inline the existing object's
  // properties as-is (including any `ObjectMethod` getters/setters) to
  // match `makeStyleAttr`'s shape and avoid silently dropping rare but
  // valid AST node kinds.
  const existingProps = t.isObjectExpression(existingExpr)
    ? existingExpr.properties
    : [t.spreadElement(existingExpr)];

  const merged = casWins
    ? t.objectExpression([...existingProps, t.spreadElement(pluginExpr)])
    : t.objectExpression([t.spreadElement(pluginExpr), ...existingProps]);

  return t.jsxAttribute(
    t.jsxIdentifier('style'),
    t.jsxExpressionContainer(merged),
  );
}

/**
 * Find the positions of the current spread attribute and any
 * existing `className` / `style` siblings on the host JSX element.
 * Shared by the default chain handler and the plugin path.
 */
function findAttributeIndices(
  opening: t.JSXOpeningElement,
  currentSpread: t.JSXSpreadAttribute,
): {
  readonly spreadIdx: number;
  readonly classNameIdx: number;
  readonly styleIdx: number;
  readonly existingClassNameAttr: t.JSXAttribute | null;
  readonly existingStyleAttr: t.JSXAttribute | null;
} {
  let spreadIdx = -1;
  let styleIdx = -1;
  let classNameIdx = -1;
  let existingStyleAttr: t.JSXAttribute | null = null;
  let existingClassNameAttr: t.JSXAttribute | null = null;
  for (let i = 0; i < opening.attributes.length; i++) {
    const a = opening.attributes[i]!;
    if (a === currentSpread) {
      spreadIdx = i;
      continue;
    }
    if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name)) {
      if (a.name.name === 'style') {
        existingStyleAttr = a;
        styleIdx = i;
      } else if (a.name.name === 'className') {
        existingClassNameAttr = a;
        classNameIdx = i;
      }
    }
  }
  return {
    spreadIdx,
    classNameIdx,
    styleIdx,
    existingClassNameAttr,
    existingStyleAttr,
  };
}

/**
 * Splice a list of replacement attributes into the JSX element at
 * the position of the original spread, optionally dropping the
 * existing `className` / `style` siblings (when they're being
 * overridden by the replacement set).
 */
function rebuildAttributes(
  opening: t.JSXOpeningElement,
  spreadIdx: number,
  replacement: ReadonlyArray<t.JSXAttribute | t.JSXSpreadAttribute>,
  dropClassNameIdx: number | null,
  dropStyleIdx: number | null,
): (t.JSXAttribute | t.JSXSpreadAttribute)[] {
  const out: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
  for (let i = 0; i < opening.attributes.length; i++) {
    if (i === spreadIdx) {
      for (const attr of replacement) out.push(attr);
      continue;
    }
    if (dropClassNameIdx !== null && i === dropClassNameIdx) continue;
    if (dropStyleIdx !== null && i === dropStyleIdx) continue;
    out.push(opening.attributes[i]!);
  }
  return out;
}

function getStaticKeyName(key: t.Expression | t.PrivateName): string | null {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
}

function getExistingStyleExpr(attr: t.JSXAttribute | null): t.Expression | null {
  if (attr === null || attr.value === null || attr.value === undefined) return null;
  if (!t.isJSXExpressionContainer(attr.value)) return null;
  const expr = attr.value.expression;
  if (t.isJSXEmptyExpression(expr)) return null;
  return expr;
}

interface StyleDecision {
  readonly attr: t.JSXAttribute | null;
  readonly replacesExisting: boolean;
}

function decideStyleAttr(
  existing: t.JSXAttribute | null,
  dynamics: readonly DynamicSlot[],
  casCssProps: readonly string[],
  dynamicSources: ReadonlyMap<string, t.Expression>,
  casWins: boolean,
): StyleDecision {
  const casCamelProps = new Set(casCssProps.map(cssToCamel));
  const existingExpr = getExistingStyleExpr(existing);

  let mustReplace = dynamics.length > 0;
  if (!mustReplace && casWins && existingExpr !== null && t.isObjectExpression(existingExpr)) {
    for (const p of existingExpr.properties) {
      if (t.isObjectProperty(p) && !p.computed) {
        const key = getStaticKeyName(p.key);
        if (key !== null && casCamelProps.has(key)) {
          mustReplace = true;
          break;
        }
      }
    }
  }

  if (!mustReplace) {
    return { attr: null, replacesExisting: false };
  }

  const casVarProps: t.ObjectProperty[] = dynamics.map((slot) => {
    const value = dynamicSources.get(slot.sourceId);
    if (!value) {
      throw new Error(`[cassida] internal: missing source AST for slot ${slot.sourceId}`);
    }
    return t.objectProperty(t.stringLiteral(slot.varName), value);
  });

  const userProps: (t.ObjectProperty | t.SpreadElement)[] = [];
  if (existingExpr !== null) {
    if (t.isObjectExpression(existingExpr)) {
      for (const p of existingExpr.properties) {
        if (casWins && t.isObjectProperty(p) && !p.computed) {
          const key = getStaticKeyName(p.key);
          if (key !== null && casCamelProps.has(key)) continue;
        }
        if (t.isObjectProperty(p) || t.isSpreadElement(p)) {
          userProps.push(p);
        }
      }
    } else {
      userProps.push(t.spreadElement(existingExpr));
    }
  }

  const props: (t.ObjectProperty | t.SpreadElement)[] = casWins
    ? [...userProps, ...casVarProps]
    : [...casVarProps, ...userProps];

  if (props.length === 0) {
    return { attr: null, replacesExisting: true };
  }

  return {
    attr: t.jsxAttribute(
      t.jsxIdentifier('style'),
      t.jsxExpressionContainer(t.objectExpression(props)),
    ),
    replacesExisting: true,
  };
}
