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
  isDynamic,
  type CompiledRule,
  type DynamicSlot,
  type Op,
  type Registry,
  type Scope,
} from '@fss/compiler';

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
      const argPath = path.get('argument') as NodePath;
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
        // Build a NodePath for the sibling attribute's argument by
        // re-traversing — cheap on small attribute lists.
        let probed: Op[] | null = null;
        path.parentPath?.traverse({
          JSXSpreadAttribute(p) {
            if (p.node === a) {
              probed = walkChain(p.get('argument') as NodePath, fssBindings, probeCtx);
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

      const compiled = compileOps(ops, { registry: options.registry });
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
      // Conflict-filter targets only the BASE scope's properties; user's
      // inline style cannot conflict with `:hover { ... }` etc. because
      // those don't apply at the default state.
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
 * Returns null when:
 * - the expression isn't rooted at one of `chainRoots`
 * - any op has unsupported argument shape (mixed dynamic+literal,
 *   spread arguments, multiple-or-zero callback params, etc.)
 *
 * On null, the caller leaves the JSX untouched (runtime fallback).
 */
function walkChain(
  startPath: NodePath,
  chainRoots: ReadonlySet<string>,
  ctx: WalkContext,
): Op[] | null {
  const ops: Op[] = [];
  let current: NodePath = startPath;

  while (true) {
    // Inner chains (callbacks) terminate at the parameter Identifier
    // itself: `c.color('red')` ends at `c`, not at `c()`. Outer chains
    // terminate at `fss()` — handled below in the CallExpression
    // branch — so both forms are accepted but distinguished here.
    if (t.isIdentifier(current.node) && chainRoots.has(current.node.name)) {
      break;
    }

    if (!t.isCallExpression(current.node)) return null;
    const calleePath = current.get('callee') as NodePath;
    const callee = calleePath.node;

    if (
      t.isMemberExpression(callee) &&
      !callee.computed &&
      t.isIdentifier(callee.property)
    ) {
      const methodName = callee.property.name;
      const argPaths = current.get('arguments') as NodePath[];

      if (methodName in canonicalModifiers) {
        // Zero-arg modifier: takes a single callback.
        if (argPaths.length !== 1) return null;
        const innerOps = collectFromCallback(argPaths[0]!, ctx);
        if (innerOps === null) return null;
        const scope =
          canonicalModifiers[methodName as keyof typeof canonicalModifiers];
        ops.push({ scope, ops: innerOps });
      } else if (methodName in argModifiers) {
        // Arg-taking modifier: (selector|query, callback).
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
        // Plain style method.
        const args = readArgs(argPaths, ctx);
        if (args === null) return null;
        // Phase 1 limitation carries through Phase 2: each op must be
        // all-literal or single-dynamic.
        const dynamics = args.filter(isDynamic);
        if (dynamics.length > 0 && (args.length !== 1 || dynamics.length !== 1)) {
          return null;
        }
        ops.push({ method: methodName, args });
      }

      current = calleePath.get('object') as NodePath;
      continue;
    }

    if (t.isIdentifier(callee) && chainRoots.has(callee.name)) {
      if (current.node.arguments.length !== 0) return null;
      break;
    }

    return null;
  }

  return ops.reverse();
}

function collectFromCallback(cbPath: NodePath, ctx: WalkContext): Op[] | null {
  if (!t.isArrowFunctionExpression(cbPath.node)) return null;
  const params = cbPath.node.params;
  if (params.length === 0) return [];
  if (params.length > 1) return null;
  const param = params[0]!;
  if (!t.isIdentifier(param)) return null;
  const innerRoots = new Set([param.name]);

  const body = cbPath.node.body;
  if (t.isBlockStatement(body)) {
    return collectFromBlock(cbPath.get('body') as NodePath, innerRoots, ctx);
  }
  return walkChain(cbPath.get('body') as NodePath, innerRoots, ctx);
}

function collectFromBlock(
  blockPath: NodePath,
  innerRoots: ReadonlySet<string>,
  ctx: WalkContext,
): Op[] | null {
  if (!t.isBlockStatement(blockPath.node)) return null;
  const allOps: Op[] = [];
  const stmtPaths = blockPath.get('body') as NodePath[];
  for (const stmtPath of stmtPaths) {
    if (t.isExpressionStatement(stmtPath.node)) {
      const exprPath = stmtPath.get('expression') as NodePath;
      const ops = walkChain(exprPath, innerRoots, ctx);
      if (ops === null) return null;
      allOps.push(...ops);
    } else if (t.isReturnStatement(stmtPath.node)) {
      if (stmtPath.node.argument === null) continue;
      const argPath = stmtPath.get('argument') as NodePath;
      const ops = walkChain(argPath, innerRoots, ctx);
      if (ops === null) return null;
      allOps.push(...ops);
    } else {
      return null;
    }
  }
  return allOps;
}

function readArgs(argPaths: NodePath[], ctx: WalkContext): unknown[] | null {
  const out: unknown[] = [];
  for (const argPath of argPaths) {
    const node = argPath.node;
    if (!t.isExpression(node)) return null;

    // Plain literal (fastest path; covers strings, numbers, booleans,
    // template literals without expressions, unary minus on numbers).
    const lit = literalToValue(node);
    if (lit !== NON_LITERAL) {
      out.push(lit);
      continue;
    }

    // Babel's static evaluator. Handles `BASE * 2`, `'rgb(' + r + ')'`
    // when the operands are themselves confident, etc. No JS execution
    // sandbox is involved — Babel evaluates pure expressions in-place.
    const evald = argPath.evaluate();
    if (evald.confident) {
      out.push(evald.value);
      continue;
    }

    // Dynamic — promote to CSS variable.
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
  // 'on': sniff the selector form.
  const trimmed = value.trim();
  if (/^@media\b/i.test(trimmed)) {
    return { kind: 'media', query: trimmed.replace(/^@media\s*/i, '').trim() };
  }
  if (trimmed.startsWith(':') || trimmed.startsWith('::')) {
    return { kind: 'pseudo', selector: trimmed };
  }
  return { kind: 'raw', selector: trimmed };
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
          [expr as t.Expression],
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
  return expr as t.Expression;
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
