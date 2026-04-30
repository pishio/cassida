import { parse, type ParserPlugin } from '@babel/parser';
import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import {
  compileOps,
  type CompiledRule,
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

  // First pass: collect all local names bound to the `fss` named import
  // from the configured source. This is order-independent: we don't rely
  // on imports textually preceding the JSX site.
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

  // Second pass: rewrite static chains.
  const rules: CompiledRule[] = [];
  let transformed = false;

  traverse(ast, {
    JSXSpreadAttribute(path) {
      const ops = collectOps(path.node.argument, fssBindings);
      if (!ops) return;
      const compiled = compileOps(ops, { registry: options.registry });
      rules.push(compiled);
      path.replaceWith(
        t.jsxAttribute(
          t.jsxIdentifier('className'),
          t.stringLiteral(compiled.className),
        ),
      );
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

function collectOps(node: t.Node, fssBindings: ReadonlySet<string>): Op[] | null {
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
      // Base call. v0 supports only `fss()` with no args.
      if (current.arguments.length !== 0) return null;
      break;
    }

    return null;
  }

  return ops.reverse();
}

function readArgs(args: ReadonlyArray<t.Node>): unknown[] | null {
  const out: unknown[] = [];
  for (const a of args) {
    const v = literalToValue(a);
    if (v === NON_LITERAL) return null;
    out.push(v);
  }
  return out;
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
