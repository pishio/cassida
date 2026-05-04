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
  type MethodOp,
  type Op,
  type RawOp,
  type Registry,
  type Scope,
  type ShorthandPolicy,
} from '@fss/compiler';
import { pathAs } from './path-guard.js';

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
   * Defaults to `@fss/core`. Renamed imports (`{ fss as ff }`) are honored.
   */
  readonly importSource?: string;
  /**
   * Policy for shorthand ↔ longhand co-occurrence within a single scope.
   * Forwarded to `compileOps`. Defaults to `'strict'`.
   */
  readonly shorthandPolicy?: ShorthandPolicy;
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
}

export function transform(source: string, options: TransformOptions): TransformResult {
  const importSource = options.importSource ?? '@fss/core';

  const plugins: ParserPlugin[] = ['jsx'];
  if (/\.tsx?$/.test(options.filename ?? '')) plugins.push('typescript');

  const parseOpts: Parameters<typeof parse>[1] = {
    sourceType: 'module',
    plugins,
  };
  if (options.filename !== undefined) parseOpts.sourceFilename = options.filename;
  const ast = parse(source, parseOpts);

  // First pass: collect every local name bound to the `fss` named import.
  const fssBindings = new Set<string>();
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== importSource) return;
      for (const spec of path.node.specifiers) {
        if (
          t.isImportSpecifier(spec) &&
          t.isIdentifier(spec.imported) &&
          spec.imported.name === 'fss'
        ) {
          fssBindings.add(spec.local.name);
        }
      }
    },
  });

  if (fssBindings.size === 0) {
    return { code: source, rules: [], map: null, transformed: false };
  }

  const rules: CompiledRule[] = [];
  let transformed = false;
  const dynamicSources = new Map<string, t.Expression>();
  const counter = { n: 0 };
  const ctx: WalkContext = { dynamicSources, counter };

  traverse(ast, {
    JSXSpreadAttribute(path) {
      // path.get('argument') on a typed NodePath<JSXSpreadAttribute>
      // returns NodePath<Expression>; no cast needed.
      const argPath = path.get('argument');
      const ops = walkChain(argPath, fssBindings, ctx);
      if (!ops) return;

      const opening = path.parent;
      if (!t.isJSXOpeningElement(opening)) return;

      // Reject multiple {...fss()} spreads on the same element.
      const probeCtx: WalkContext = {
        dynamicSources: new Map(),
        counter: { n: 0 },
      };
      const otherFssSpreads = opening.attributes.filter((a) => {
        if (a === path.node || !t.isJSXSpreadAttribute(a)) return false;
        let probed: Op[] | null = null;
        path.parentPath?.traverse({
          JSXSpreadAttribute(p) {
            if (p.node === a) {
              probed = walkChain(p.get('argument'), fssBindings, probeCtx);
              p.stop();
            }
          },
        });
        return probed !== null;
      });
      if (otherFssSpreads.length > 0) {
        throw path.buildCodeFrameError(
          '[fss] Multiple {...fss()} spreads on the same JSX element are not supported. Combine them into a single chain.',
        );
      }

      const compiled = compileOps(ops, {
        registry: options.registry,
        ...(options.shorthandPolicy !== undefined ? { shorthandPolicy: options.shorthandPolicy } : {}),
      });
      rules.push(compiled);

      let spreadIdx = -1;
      let styleIdx = -1;
      let classNameIdx = -1;
      let existingStyleAttr: t.JSXAttribute | null = null;
      let existingClassNameAttr: t.JSXAttribute | null = null;

      for (let i = 0; i < opening.attributes.length; i++) {
        const a = opening.attributes[i]!;
        if (a === path.node) {
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

      const fssWins = spreadIdx > styleIdx;
      const fssBaseCssProps = Object.keys(compiled.tree.bag);

      const newClassNameAttr = makeClassNameAttr(existingClassNameAttr, compiled.className);
      const styleResult = decideStyleAttr(
        existingStyleAttr,
        compiled.dynamics,
        fssBaseCssProps,
        dynamicSources,
        fssWins,
      );

      const newAttrs: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
      for (let i = 0; i < opening.attributes.length; i++) {
        if (i === spreadIdx) {
          newAttrs.push(newClassNameAttr);
          if (styleResult.attr !== null) newAttrs.push(styleResult.attr);
          continue;
        }
        if (i === classNameIdx) continue;
        if (i === styleIdx && styleResult.replacesExisting) continue;
        newAttrs.push(opening.attributes[i]!);
      }
      opening.attributes = newAttrs;

      transformed = true;
    },
  });

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
 * Walks a `fss().a().b()...` chain backward from the outermost call,
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
): Op[] | null {
  const ops: Op[] = [];
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
    // intercept the special `fss.unsafe(preset)` chain root.
    const memberPath = pathAs(calleePath, t.isMemberExpression);
    if (memberPath && !memberPath.node.computed) {
      const propertyPath = pathAs(memberPath.get('property'), t.isIdentifier);
      if (!propertyPath) return null;
      const methodName = propertyPath.node.name;
      const argPaths = callPath.get('arguments');

      // Special case: `fss.unsafe(preset)` at the chain root. Detected
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

    // Branch B: callee is the chain root identifier `fss()` (or the
    // bare callback param for an inner chain — wait, those terminate
    // earlier as Identifiers, not CallExpressions). Accepts:
    //   - `fss()` zero-arg base call
    //   - `fss(preset)` one-arg form: `preset` must be a confidently
    //     evaluable plain object; its keys become MethodOps that the
    //     registry validates (safe path). Unknown / blacklisted keys
    //     surface as the canonicalizer's "unknown method" error.
    const fssIdPath = pathAs(calleePath, t.isIdentifier);
    if (fssIdPath && chainRoots.has(fssIdPath.node.name)) {
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

    return null;
  }

  return ops.reverse();
}

function collectFromCallback(cbPath: NodePath, ctx: WalkContext): Op[] | null {
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
  if (blockPath) return collectFromBlock(blockPath, innerRoots, ctx);
  return walkChain(bodyPath, innerRoots, ctx);
}

function collectFromBlock(
  blockPath: NodePath<t.BlockStatement>,
  innerRoots: ReadonlySet<string>,
  ctx: WalkContext,
): Op[] | null {
  const allOps: Op[] = [];
  const stmtPaths = blockPath.get('body');
  for (const stmtPath of stmtPaths) {
    const exprStmtPath = pathAs(stmtPath, t.isExpressionStatement);
    if (exprStmtPath) {
      const ops = walkChain(exprStmtPath.get('expression'), innerRoots, ctx);
      if (ops === null) return null;
      allOps.push(...ops);
      continue;
    }
    const returnStmtPath = pathAs(stmtPath, t.isReturnStatement);
    if (returnStmtPath) {
      // ReturnStatement.argument is `Expression | null | undefined`;
      // `pathAs` (with its widened input type) handles the nullable
      // generic and narrows to NodePath<Expression> in one step.
      const exprPath = pathAs(returnStmtPath.get('argument'), t.isExpression);
      if (!exprPath) continue;
      const ops = walkChain(exprPath, innerRoots, ctx);
      if (ops === null) return null;
      allOps.push(...ops);
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

    // 3) Dynamic — promote to CSS variable.
    const id = `slot-${++ctx.counter.n}`;
    ctx.dynamicSources.set(id, node);
    out.push({ [DYNAMIC_TAG]: true, id });
  }
  return out;
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
 * MethodOps for the safe `fss(preset)` path. Each key becomes a
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
 * of `fss.unsafe`.
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

function makeClassNameAttr(
  existing: t.JSXAttribute | null,
  fssClass: string,
): t.JSXAttribute {
  if (existing === null || existing.value === null || existing.value === undefined) {
    return t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(fssClass));
  }
  const value = existing.value;
  if (t.isStringLiteral(value)) {
    return t.jsxAttribute(
      t.jsxIdentifier('className'),
      t.stringLiteral(`${value.value} ${fssClass}`),
    );
  }
  if (t.isJSXExpressionContainer(value)) {
    const expr = value.expression;
    if (t.isJSXEmptyExpression(expr)) {
      return t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(fssClass));
    }
    return t.jsxAttribute(
      t.jsxIdentifier('className'),
      t.jsxExpressionContainer(
        t.templateLiteral(
          [
            t.templateElement({ raw: '', cooked: '' }, false),
            t.templateElement({ raw: ` ${fssClass}`, cooked: ` ${fssClass}` }, true),
          ],
          [expr],
        ),
      ),
    );
  }
  return t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(fssClass));
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
  fssCssProps: readonly string[],
  dynamicSources: ReadonlyMap<string, t.Expression>,
  fssWins: boolean,
): StyleDecision {
  const fssCamelProps = new Set(fssCssProps.map(cssToCamel));
  const existingExpr = getExistingStyleExpr(existing);

  let mustReplace = dynamics.length > 0;
  if (!mustReplace && fssWins && existingExpr !== null && t.isObjectExpression(existingExpr)) {
    for (const p of existingExpr.properties) {
      if (t.isObjectProperty(p) && !p.computed) {
        const key = getStaticKeyName(p.key);
        if (key !== null && fssCamelProps.has(key)) {
          mustReplace = true;
          break;
        }
      }
    }
  }

  if (!mustReplace) {
    return { attr: null, replacesExisting: false };
  }

  const fssVarProps: t.ObjectProperty[] = dynamics.map((slot) => {
    const value = dynamicSources.get(slot.sourceId);
    if (!value) {
      throw new Error(`[fss] internal: missing source AST for slot ${slot.sourceId}`);
    }
    return t.objectProperty(t.stringLiteral(slot.varName), value);
  });

  const userProps: (t.ObjectProperty | t.SpreadElement)[] = [];
  if (existingExpr !== null) {
    if (t.isObjectExpression(existingExpr)) {
      for (const p of existingExpr.properties) {
        if (fssWins && t.isObjectProperty(p) && !p.computed) {
          const key = getStaticKeyName(p.key);
          if (key !== null && fssCamelProps.has(key)) continue;
        }
        if (t.isObjectProperty(p) || t.isSpreadElement(p)) {
          userProps.push(p);
        }
      }
    } else {
      userProps.push(t.spreadElement(existingExpr));
    }
  }

  const props: (t.ObjectProperty | t.SpreadElement)[] = fssWins
    ? [...userProps, ...fssVarProps]
    : [...fssVarProps, ...userProps];

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
