/**
 * Cross-file static evaluator.
 *
 * Babel's built-in `path.evaluate()` only follows local bindings —
 * the moment an arg references a value imported from another module,
 * it returns `confident: false` and the chain falls through to runtime
 * fallback. This evaluator extends the lookup across `import`
 * declarations so design-token files can drive static class names:
 *
 *   ```ts
 *   // theme.ts
 *   export const theme = {
 *     brand: { primary: '#3b82f6' },
 *     spacing: { md: 16 },
 *   };
 *
 *   // component.tsx
 *   import { theme } from './theme';
 *   <div {...cas().color(theme.brand.primary).padding(theme.spacing.md)} />
 *   //                  ^------ resolves to '#3b82f6' at build time
 *   ```
 *
 * Scope, by design:
 *   - Literals (string, number, boolean), object & array literals,
 *     and member access on the above are resolved
 *   - `import` declarations are followed (named, default, namespace)
 *   - Re-exports (`export { x } from './y'`, `export * from './y'`)
 *     are followed
 *   - TypeScript wrappers (`as const`, `satisfies`, parenthesized)
 *     are unwrapped
 *
 * Out of scope (returns `UNRESOLVED` so the caller bails to dynamic):
 *   - Function calls, including `Object.freeze(...)`
 *   - Template literals with substitutions
 *   - Spread elements / computed properties
 *   - Imports from `node_modules` (theme packages may want this
 *     someday — leaving the door open via a future `allow` option)
 *
 * Cycle detection prevents stack-overflow on circular imports; the
 * AST cache amortizes parsing across many evaluator calls within a
 * single build.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';

export const UNRESOLVED = Symbol.for('cassida.staticEval.unresolved');
export type Unresolved = typeof UNRESOLVED;

export interface StaticEvalOptions {
  /**
   * Absolute path of the file containing the AST being evaluated.
   * Required for any cross-file resolution; without it, the evaluator
   * silently degrades to local-scope-only.
   */
  readonly filename?: string;
  /**
   * Shared cache for parsed modules across many `evaluateNode` calls
   * within a single build. Defaults to a fresh cache per call.
   */
  readonly cache?: ModuleCache;
}

/**
 * Lazy-resolved exports of a parsed module. Each entry maps an
 * exported name to the AST node that holds the value.
 */
interface ModuleRecord {
  readonly path: string;
  readonly ast: t.File;
  /** Exported name → AST node holding the value. */
  readonly exports: Map<string, t.Node>;
  /** Re-exports: `export { x } from './y'` or `export * from './y'`. */
  readonly reExports: ReadonlyArray<ReExport>;
}

type ReExport =
  | { readonly kind: 'named'; readonly localName: string; readonly importedName: string; readonly source: string }
  | { readonly kind: 'all'; readonly source: string };

export type ModuleCache = Map<string, ModuleRecord | null>;

export const createModuleCache = (): ModuleCache => new Map();

const SUPPORTED_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

interface InternalContext {
  readonly cache: ModuleCache;
  /** Cycle guard: tuples of "<modulePath>::<exportName>". */
  readonly inProgress: Set<string>;
}

/**
 * Try to evaluate the given expression to a constant value, following
 * imports as needed. Returns `UNRESOLVED` for anything dynamic.
 */
export function evaluateNode(
  argPath: NodePath,
  options: StaticEvalOptions = {},
): unknown | Unresolved {
  if (!argPath.node || !t.isExpression(argPath.node)) return UNRESOLVED;
  const ctx: InternalContext = {
    cache: options.cache ?? createModuleCache(),
    inProgress: new Set(),
  };
  return evalExpression(argPath.node, argPath, options.filename, ctx);
}

function evalExpression(
  node: t.Node,
  /** Path scope used to resolve identifiers — only meaningful for the
   *  *initial* host file; once we step into another module we use the
   *  imported module's records and don't have a scope handle. */
  hostPath: NodePath | null,
  hostFile: string | undefined,
  ctx: InternalContext,
): unknown | Unresolved {
  // Unwrap TS wrappers and parenthesized.
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)) {
    return evalExpression(node.expression, hostPath, hostFile, ctx);
  }
  if (t.isParenthesizedExpression(node)) {
    return evalExpression(node.expression, hostPath, hostFile, ctx);
  }

  // Literals.
  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node)) {
    return node.value;
  }
  if (t.isNullLiteral(node)) return null;
  if (t.isTemplateLiteral(node)) {
    if (node.expressions.length === 0 && node.quasis.length === 1) {
      return node.quasis[0]!.value.cooked ?? node.quasis[0]!.value.raw;
    }
    return UNRESOLVED;
  }
  if (t.isUnaryExpression(node) && (node.operator === '-' || node.operator === '+')) {
    const inner = evalExpression(node.argument, hostPath, hostFile, ctx);
    if (inner === UNRESOLVED) return UNRESOLVED;
    if (typeof inner === 'number') return node.operator === '-' ? -inner : inner;
    return UNRESOLVED;
  }

  // Object / Array literals.
  if (t.isObjectExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) return UNRESOLVED;
      const key = prop.key;
      let keyName: string;
      if (t.isIdentifier(key)) keyName = key.name;
      else if (t.isStringLiteral(key)) keyName = key.value;
      else if (t.isNumericLiteral(key)) keyName = String(key.value);
      else return UNRESOLVED;
      if (!t.isExpression(prop.value)) return UNRESOLVED;
      const v = evalExpression(prop.value, hostPath, hostFile, ctx);
      if (v === UNRESOLVED) return UNRESOLVED;
      out[keyName] = v;
    }
    return out;
  }
  if (t.isArrayExpression(node)) {
    const out: unknown[] = [];
    for (const el of node.elements) {
      if (el === null) {
        out.push(undefined);
        continue;
      }
      if (!t.isExpression(el)) return UNRESOLVED;
      const v = evalExpression(el, hostPath, hostFile, ctx);
      if (v === UNRESOLVED) return UNRESOLVED;
      out.push(v);
    }
    return out;
  }

  // Member access — `theme.brand.primary` / `theme["brand"]`
  if (t.isMemberExpression(node)) {
    const objVal = evalExpression(node.object, hostPath, hostFile, ctx);
    if (objVal === UNRESOLVED) return UNRESOLVED;
    if (objVal === null || typeof objVal !== 'object') return UNRESOLVED;
    let key: string | number;
    if (!node.computed) {
      if (!t.isIdentifier(node.property)) return UNRESOLVED;
      key = node.property.name;
    } else {
      const keyVal = evalExpression(node.property as t.Expression, hostPath, hostFile, ctx);
      if (keyVal === UNRESOLVED) return UNRESOLVED;
      if (typeof keyVal !== 'string' && typeof keyVal !== 'number') return UNRESOLVED;
      key = keyVal;
    }
    return (objVal as Record<string | number, unknown>)[key];
  }

  // Identifier — local binding in host file, or imported from elsewhere.
  if (t.isIdentifier(node)) {
    if (!hostPath) return UNRESOLVED;
    const binding = hostPath.scope.getBinding(node.name);
    if (!binding) return UNRESOLVED;
    return resolveBinding(binding, hostFile, ctx);
  }

  return UNRESOLVED;
}

function resolveBinding(
  binding: import('@babel/traverse').Binding,
  hostFile: string | undefined,
  ctx: InternalContext,
): unknown | Unresolved {
  const declPath = binding.path;
  const node = declPath.node;

  // Local const/let — the value is the init expression.
  if (t.isVariableDeclarator(node)) {
    if (!node.init) return UNRESOLVED;
    if (!t.isExpression(node.init)) return UNRESOLVED;
    return evalExpression(node.init, declPath, hostFile, ctx);
  }

  // Imported binding — follow the import declaration.
  if (
    t.isImportSpecifier(node) ||
    t.isImportDefaultSpecifier(node) ||
    t.isImportNamespaceSpecifier(node)
  ) {
    if (!hostFile) return UNRESOLVED;
    const importDecl = declPath.parent;
    if (!t.isImportDeclaration(importDecl)) return UNRESOLVED;
    const source = importDecl.source.value;
    const resolved = resolveModule(hostFile, source);
    if (!resolved) return UNRESOLVED;

    const imported =
      t.isImportDefaultSpecifier(node)
        ? 'default'
        : t.isImportNamespaceSpecifier(node)
          ? '*'
          : t.isIdentifier(node.imported)
            ? node.imported.name
            : node.imported.value;

    return resolveExport(resolved, imported, ctx);
  }

  return UNRESOLVED;
}

function resolveExport(
  modulePath: string,
  exportName: string,
  ctx: InternalContext,
): unknown | Unresolved {
  const cycleKey = `${modulePath}::${exportName}`;
  if (ctx.inProgress.has(cycleKey)) return UNRESOLVED;

  const record = loadModule(modulePath, ctx.cache);
  if (!record) return UNRESOLVED;

  // Namespace import — build an object from every named export.
  if (exportName === '*') {
    const out: Record<string, unknown> = {};
    for (const name of record.exports.keys()) {
      ctx.inProgress.add(cycleKey);
      const v = resolveExport(modulePath, name, ctx);
      ctx.inProgress.delete(cycleKey);
      if (v === UNRESOLVED) return UNRESOLVED;
      out[name] = v;
    }
    // Also fold in re-export `*` sources.
    for (const re of record.reExports) {
      if (re.kind !== 'all') continue;
      const target = resolveModule(modulePath, re.source);
      if (!target) return UNRESOLVED;
      ctx.inProgress.add(cycleKey);
      const v = resolveExport(target, '*', ctx);
      ctx.inProgress.delete(cycleKey);
      if (v === UNRESOLVED) return UNRESOLVED;
      if (v === null || typeof v !== 'object') return UNRESOLVED;
      Object.assign(out, v);
    }
    return out;
  }

  const direct = record.exports.get(exportName);
  if (direct) {
    ctx.inProgress.add(cycleKey);
    try {
      const evalCtx: InternalContext = {
        cache: ctx.cache,
        inProgress: ctx.inProgress,
      };
      return evalExpressionInModule(direct, modulePath, evalCtx);
    } finally {
      ctx.inProgress.delete(cycleKey);
    }
  }

  // Re-exports: `export { foo } from './bar'`
  for (const re of record.reExports) {
    if (re.kind === 'named' && re.localName === exportName) {
      const target = resolveModule(modulePath, re.source);
      if (!target) return UNRESOLVED;
      ctx.inProgress.add(cycleKey);
      try {
        return resolveExport(target, re.importedName, ctx);
      } finally {
        ctx.inProgress.delete(cycleKey);
      }
    }
  }

  // `export *` chains: walk each one looking for the name.
  for (const re of record.reExports) {
    if (re.kind !== 'all') continue;
    const target = resolveModule(modulePath, re.source);
    if (!target) continue;
    ctx.inProgress.add(cycleKey);
    try {
      const v = resolveExport(target, exportName, ctx);
      if (v !== UNRESOLVED) return v;
    } finally {
      ctx.inProgress.delete(cycleKey);
    }
  }

  return UNRESOLVED;
}

/**
 * Evaluate an AST node found inside a *foreign* module — one we don't
 * have a Babel `NodePath` for. We do have the parsed AST and can build
 * a synthetic `Program`-rooted traversal to look up identifier
 * bindings, but that's heavy. For the common case (literal export, or
 * member access on a literal object), the foreign expression
 * references no foreign-local bindings and `evalExpression` works
 * directly. When it does need scope resolution we lazily traverse to
 * find a NodePath.
 */
function evalExpressionInModule(
  node: t.Node,
  modulePath: string,
  ctx: InternalContext,
): unknown | Unresolved {
  if (!t.isExpression(node)) return UNRESOLVED;

  // First try without scope — covers `export const x = 'literal'` and
  // `export const theme = { ... nested literals ... }`.
  const cheap = evalExpression(node, null, modulePath, ctx);
  if (cheap !== UNRESOLVED) return cheap;

  // Fall back to a scope-aware traversal of the foreign module's AST.
  const record = ctx.cache.get(modulePath);
  if (!record) return UNRESOLVED;
  return evalWithModuleScope(node, record.ast, modulePath, ctx);
}

function evalWithModuleScope(
  target: t.Node,
  ast: t.File,
  modulePath: string,
  ctx: InternalContext,
): unknown | Unresolved {
  // A small one-shot traversal that yields the NodePath for the
  // target node. We import @babel/traverse lazily to avoid a circular
  // module dependency at top-level (the parser also imports it).
  const traverseMod = require('@babel/traverse');
  const traverse: typeof import('@babel/traverse').default =
    typeof traverseMod === 'function' ? traverseMod : traverseMod.default;

  let result: unknown | Unresolved = UNRESOLVED;
  let found = false;
  traverse(ast, {
    enter(path) {
      if (found) {
        path.stop();
        return;
      }
      if (path.node === target) {
        found = true;
        result = evalExpression(target, path, modulePath, ctx);
        path.stop();
      }
    },
  });
  return result;
}

function loadModule(modulePath: string, cache: ModuleCache): ModuleRecord | null {
  const cached = cache.get(modulePath);
  if (cached !== undefined) return cached;

  let source: string;
  try {
    source = readFileSync(modulePath, 'utf8');
  } catch {
    cache.set(modulePath, null);
    return null;
  }

  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      sourceFilename: modulePath,
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    cache.set(modulePath, null);
    return null;
  }

  const exports = new Map<string, t.Node>();
  const reExports: ReExport[] = [];

  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt)) {
      // `export const x = ...;` / `export function x() {}` / etc.
      if (stmt.declaration) {
        if (t.isVariableDeclaration(stmt.declaration)) {
          for (const decl of stmt.declaration.declarations) {
            if (t.isIdentifier(decl.id) && decl.init) {
              exports.set(decl.id.name, decl.init);
            }
          }
        } else if (
          (t.isFunctionDeclaration(stmt.declaration) ||
            t.isClassDeclaration(stmt.declaration)) &&
          stmt.declaration.id
        ) {
          // We can't statically evaluate functions/classes; record an
          // unresolvable-ish placeholder so the lookup hits and bails.
          exports.set(stmt.declaration.id.name, stmt.declaration);
        }
      }
      // `export { x }` / `export { x } from './y'`
      for (const spec of stmt.specifiers) {
        if (t.isExportSpecifier(spec)) {
          const local = spec.local.name;
          const exported = t.isIdentifier(spec.exported)
            ? spec.exported.name
            : spec.exported.value;
          if (stmt.source) {
            reExports.push({
              kind: 'named',
              localName: exported,
              importedName: local,
              source: stmt.source.value,
            });
          } else {
            // `export { x }` — link to the local declaration. Look up
            // the binding's init at evaluation time via module scope.
            // We mark with a placeholder that triggers a scope walk.
            const decl = findLocalDeclaration(ast, local);
            if (decl) exports.set(exported, decl);
          }
        }
      }
    } else if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      if (t.isExpression(d)) exports.set('default', d);
      // Function/class default: leave unresolvable.
    } else if (t.isExportAllDeclaration(stmt)) {
      reExports.push({ kind: 'all', source: stmt.source.value });
    }
  }

  const record: ModuleRecord = { path: modulePath, ast, exports, reExports };
  cache.set(modulePath, record);
  return record;
}

function findLocalDeclaration(ast: t.File, name: string): t.Node | null {
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id) && decl.id.name === name && decl.init) {
          return decl.init;
        }
      }
    } else if (
      (t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) &&
      stmt.id?.name === name
    ) {
      return stmt;
    }
  }
  return null;
}

/**
 * Resolve a relative import specifier against the host file. Returns
 * the absolute path of an existing source file, or `null` if it can't
 * be resolved by trying our supported extensions and `index` lookups.
 *
 * Bare specifiers (npm packages) and absolute non-file specifiers
 * are deliberately rejected — design tokens are user-owned files, and
 * silently following imports into `node_modules` would be a security
 * footgun (eval-by-AST of an attacker-controlled package). A future
 * `allow` option can opt in.
 */
function resolveModule(fromFile: string, specifier: string): string | null {
  if (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !isAbsolute(specifier)
  ) {
    return null;
  }
  const baseDir = dirname(fromFile);
  const base = isAbsolute(specifier) ? specifier : resolve(baseDir, specifier);

  // Direct hit.
  if (existsAsFile(base)) return base;
  // Extension probes.
  for (const ext of SUPPORTED_EXTS) {
    const cand = base + ext;
    if (existsAsFile(cand)) return cand;
  }
  // Directory `index.<ext>`.
  if (existsAsDirectory(base)) {
    for (const ext of SUPPORTED_EXTS) {
      const cand = resolve(base, `index${ext}`);
      if (existsAsFile(cand)) return cand;
    }
  }
  return null;
}

function existsAsFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
function existsAsDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
