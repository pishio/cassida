import { parse, type ParserPlugin } from '@babel/parser';
import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import {
  compileOps,
  cssToCamel,
  DYNAMIC_TAG,
  isDynamic,
  type CompiledRule,
  type DynamicSlot,
  type Op,
  type Registry,
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

  // First pass: collect every local name bound to the `fss` named import
  // from the configured source. Order-independent of JSX usage.
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

  // Per-file dynamic-slot tracking: each non-literal arg gets a fresh
  // sourceId; the AST expression is stashed for later re-injection into
  // the element's inline style.
  let dynamicCounter = 0;
  const dynamicSources = new Map<string, t.Expression>();

  const readArgs = (args: ReadonlyArray<t.Node>): unknown[] | null => {
    const out: unknown[] = [];
    for (const a of args) {
      const v = literalToValue(a);
      if (v !== NON_LITERAL) {
        out.push(v);
        continue;
      }
      if (!t.isExpression(a)) return null;
      const id = `slot-${++dynamicCounter}`;
      dynamicSources.set(id, a);
      out.push({ [DYNAMIC_TAG]: true, id });
    }
    return out;
  };

  const collectOps = (node: t.Node): Op[] | null => {
    const ops: Op[] = [];
    let current: t.Node = node;

    while (true) {
      if (!t.isCallExpression(current)) return null;
      const callee = current.callee;

      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
        const args = readArgs(current.arguments);
        if (!args) return null;
        ops.push({ method: callee.property.name, args });
        current = callee.object;
        continue;
      }

      if (t.isIdentifier(callee) && fssBindings.has(callee.name)) {
        if (current.arguments.length !== 0) return null;
        break;
      }

      return null;
    }

    // Phase 1: each op must be all-literal OR exactly-one-dynamic.
    for (const op of ops) {
      const dynamics = op.args.filter(isDynamic);
      if (dynamics.length > 0 && (op.args.length !== 1 || dynamics.length !== 1)) {
        return null;
      }
    }

    return ops.reverse();
  };

  traverse(ast, {
    JSXSpreadAttribute(path) {
      const ops = collectOps(path.node.argument);
      if (!ops) return;

      const opening = path.parent;
      if (!t.isJSXOpeningElement(opening)) return;

      // Reject multiple {...fss()} spreads on the same element. We use a
      // throwaway sources map for the probe so we don't pollute counters.
      const probeCount = (n: t.Node): number => {
        const probeSources = new Map<string, t.Expression>();
        let probeCounter = 0;
        const probeReadArgs = (args: ReadonlyArray<t.Node>): unknown[] | null => {
          const out: unknown[] = [];
          for (const a of args) {
            const v = literalToValue(a);
            if (v !== NON_LITERAL) {
              out.push(v);
              continue;
            }
            if (!t.isExpression(a)) return null;
            const id = `probe-${++probeCounter}`;
            probeSources.set(id, a);
            out.push({ [DYNAMIC_TAG]: true, id });
          }
          return out;
        };
        const probeCollect = (node: t.Node): Op[] | null => {
          const out: Op[] = [];
          let cur: t.Node = node;
          while (true) {
            if (!t.isCallExpression(cur)) return null;
            const callee = cur.callee;
            if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
              const args = probeReadArgs(cur.arguments);
              if (!args) return null;
              out.push({ method: callee.property.name, args });
              cur = callee.object;
              continue;
            }
            if (t.isIdentifier(callee) && fssBindings.has(callee.name)) {
              if (cur.arguments.length !== 0) return null;
              break;
            }
            return null;
          }
          return out;
        };
        return probeCollect(n) === null ? 0 : 1;
      };

      const otherFssSpreads = opening.attributes.filter(
        (a) => a !== path.node && t.isJSXSpreadAttribute(a) && probeCount(a.argument) > 0,
      );
      if (otherFssSpreads.length > 0) {
        throw path.buildCodeFrameError(
          '[fss] Multiple {...fss()} spreads on the same JSX element are not supported. Combine them into a single chain.',
        );
      }

      const compiled = compileOps(ops, { registry: options.registry });
      rules.push(compiled);

      // Locate sibling style/className attributes.
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
      const fssCssProps = Object.keys(compiled.bag);

      const newClassNameAttr = makeClassNameAttr(existingClassNameAttr, compiled.className);
      const styleResult = decideStyleAttr(
        existingStyleAttr,
        compiled.dynamics,
        fssCssProps,
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
  /** The new `style=` attribute, or `null` if no style attribute should be present. */
  readonly attr: t.JSXAttribute | null;
  /** Whether the user's existing `style=` attribute should be removed from the JSX. */
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

  // We must take ownership of the style attribute when:
  // - There are dynamics (need to inject CSS-var entries), OR
  // - FSS wins and user's static style sets a property FSS also controls
  //   (we must drop user's key so the class rule resolves instead of
  //   being overridden by inline > class).
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

  // Build the FSS dynamic var entries.
  const fssVarProps: t.ObjectProperty[] = dynamics.map((slot) => {
    const value = dynamicSources.get(slot.sourceId);
    if (!value) {
      throw new Error(`[fss] internal: missing source AST for slot ${slot.sourceId}`);
    }
    return t.objectProperty(t.stringLiteral(slot.varName), value);
  });

  // Carry user's style entries through, filtering conflicting keys when
  // FSS wins. Non-literal user-style is spread as-is — we cannot
  // statically inspect its keys (Phase 1 limitation; documented in
  // CLAUDE.md).
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
    // We took ownership only to drop user's conflicting keys, leaving
    // nothing behind. Still drop the old attribute; emit nothing new.
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
