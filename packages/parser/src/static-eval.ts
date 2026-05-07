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
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// Babel's ESM packaging exposes the function under `.default` when
// imported from a Node ESM consumer. Mirrors the same shim as the
// host index.ts so this module works under both CJS and ESM resolves.
const traverse = (
  (traverseModule as { default?: typeof traverseModule }).default ?? traverseModule
) as typeof traverseModule;

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
  /** Exported name → bound declaration. */
  readonly exports: Map<string, ExportEntry>;
  /** Re-exports: `export { x } from './y'` or `export * from './y'`. */
  readonly reExports: ReadonlyArray<ReExport>;
  /**
   * Cached `NodePath<Program>` for the parsed AST. Captured by a
   * single `traverse` at module-load time so identifier resolution
   * can use the program scope without re-walking the AST per
   * lookup. `null` until first use; populated lazily on demand.
   */
  programPath: NodePath<t.Program> | null;
  /**
   * Cached resolved namespace object for `import * as`. The contents
   * are stable across the lifetime of the cache (a module record is
   * never re-loaded once stored), so we compute it once and reuse.
   * Slots may legitimately hold UNRESOLVED for unfoldable per-export
   * values; downstream member access handles that correctly.
   * `undefined` until first computed.
   */
  namespace: Record<string, unknown> | Unresolved | undefined;
}

/**
 * One exported binding's resolution recipe. The simple case is a
 * direct AST node; destructured exports
 * (`export const { primary } = colors`) carry an additional key path
 * to apply once the init expression has been evaluated.
 */
type ExportEntry = {
  readonly init: t.Node;
  readonly path?: ReadonlyArray<PathSegment>;
};
type PathSegment =
  | { readonly kind: 'object'; readonly key: string }
  | { readonly kind: 'array'; readonly index: number };

type ReExport =
  | { readonly kind: 'named'; readonly localName: string; readonly importedName: string; readonly source: string }
  | { readonly kind: 'all'; readonly source: string };

export type ModuleCache = Map<string, ModuleRecord | null>;

export const createModuleCache = (): ModuleCache => new Map();

const SUPPORTED_EXTS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  // Design tokens are commonly stored in JSON for cross-tool sharing
  // (Style Dictionary, Figma plugins, Tailwind config). Treated below
  // as a synthetic module exporting each top-level key as a named
  // export plus the whole object as the default export, matching how
  // Vite / Rollup interpret ESM JSON imports.
  '.json',
];

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
  if (t.isUnaryExpression(node)) {
    const inner = evalExpression(node.argument, hostPath, hostFile, ctx);
    if (inner === UNRESOLVED) return UNRESOLVED;
    if (node.operator === '-' || node.operator === '+') {
      if (typeof inner === 'number') return node.operator === '-' ? -inner : inner;
      return UNRESOLVED;
    }
    if (node.operator === '!') return !inner;
    // `typeof`, `void`, `delete` would need execution semantics —
    // out of scope for a literal evaluator.
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
  // Reassignable bindings can't be folded — `let x = 'red'; x = 'blue'`
  // would otherwise compile to the init value, ignoring runtime
  // mutation. `binding.constant` is true for `const` and unmutated
  // imports; false for `let` / `var` / parameters / mutated imports.
  if (!binding.constant) return UNRESOLVED;

  // Local cycle detection — `const a = b; const b = a;` would recurse
  // infinitely without a guard. Imports already use `<modulePath>::<name>`;
  // for locals we mint a parallel key from the host file.
  const cycleKey = hostFile
    ? `${hostFile}::local::${binding.identifier.name}`
    : null;
  if (cycleKey && ctx.inProgress.has(cycleKey)) return UNRESOLVED;

  const declPath = binding.path;
  const node = declPath.node;

  // Local const/let — the value is the init expression.
  if (t.isVariableDeclarator(node)) {
    if (!node.init) return UNRESOLVED;
    if (!t.isExpression(node.init)) return UNRESOLVED;
    if (cycleKey) ctx.inProgress.add(cycleKey);
    try {
      return evalExpression(node.init, declPath, hostFile, ctx);
    } finally {
      if (cycleKey) ctx.inProgress.delete(cycleKey);
    }
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
  // We *tolerate* UNRESOLVED slots: a theme file commonly exports
  // helper functions (or other non-static values) alongside literal
  // tokens. Bailing the whole namespace when any single export is
  // un-foldable would make `import * as theme from './theme'` useless
  // for the literal-only properties the consumer actually accesses.
  // Instead, slots stay UNRESOLVED in the namespace object; downstream
  // member access on them naturally returns UNRESOLVED only for
  // those specific properties.
  if (exportName === '*') {
    if (record.namespace !== undefined) return record.namespace;
    const out: Record<string, unknown> = {};
    ctx.inProgress.add(cycleKey);
    try {
      // 1) Local exports take precedence — they shadow any name that
      // a star re-export would otherwise contribute.
      for (const name of record.exports.keys()) {
        out[name] = resolveExport(modulePath, name, ctx);
      }
      // 2) Star re-exports follow ESM ambiguity semantics. A name
      // contributed by exactly one star source flows through; a name
      // contributed by two or more (and not shadowed by a local)
      // becomes ambiguous in ECMAScript and would crash the consumer
      // at import time, so we exclude it from the namespace and the
      // chain falls through to dynamic for that property access.
      const AMBIGUOUS = Symbol('ambiguous');
      const starOrigin = new Map<string, string | typeof AMBIGUOUS>();
      for (const re of record.reExports) {
        if (re.kind !== 'all') continue;
        const target = resolveModule(modulePath, re.source);
        if (!target) continue;
        const v = resolveExport(target, '*', ctx);
        if (v === UNRESOLVED || v === null || typeof v !== 'object') continue;
        for (const name of Object.keys(v)) {
          if (record.exports.has(name)) continue; // local shadows
          const existing = starOrigin.get(name);
          if (existing === undefined) {
            starOrigin.set(name, target);
            out[name] = (v as Record<string, unknown>)[name];
          } else if (existing !== target) {
            starOrigin.set(name, AMBIGUOUS);
          }
        }
      }
      for (const [name, origin] of starOrigin) {
        if (origin === AMBIGUOUS) delete out[name];
      }
    } finally {
      ctx.inProgress.delete(cycleKey);
    }
    record.namespace = out;
    return out;
  }

  const direct = record.exports.get(exportName);
  if (direct) {
    ctx.inProgress.add(cycleKey);
    try {
      const initVal = evalExpressionInModule(direct.init, modulePath, ctx);
      if (initVal === UNRESOLVED) return UNRESOLVED;
      if (!direct.path || direct.path.length === 0) return initVal;
      return walkPath(initVal, direct.path);
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

  // `export *` chains. ESM resolution: a name re-exported by more
  // than one star source becomes ambiguous and would crash the
  // consumer at import time — so we *also* refuse to fold it. If we
  // returned the first match we'd silently produce a class whose
  // value the consumer can't actually access at runtime.
  let starHit: unknown | Unresolved = UNRESOLVED;
  let ambiguous = false;
  for (const re of record.reExports) {
    if (re.kind !== 'all') continue;
    const target = resolveModule(modulePath, re.source);
    if (!target) continue;
    ctx.inProgress.add(cycleKey);
    try {
      const v = resolveExport(target, exportName, ctx);
      if (v === UNRESOLVED) continue;
      if (starHit !== UNRESOLVED) {
        ambiguous = true;
        break;
      }
      starHit = v;
    } finally {
      ctx.inProgress.delete(cycleKey);
    }
  }
  if (ambiguous) return UNRESOLVED;
  return starHit;
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
/**
 * Walk a destructure path (`{ a: { b } }` → `["a", "b"]`) on a value
 * that's already been evaluated. Bails to UNRESOLVED if the path
 * passes through a non-object or a missing key.
 */
function walkPath(
  value: unknown,
  path: ReadonlyArray<PathSegment>,
): unknown | Unresolved {
  let cur: unknown = value;
  for (const seg of path) {
    if (cur === UNRESOLVED) return UNRESOLVED;
    // `typeof [] === 'object'`, so the bare object check covers both
    // record and array shapes.
    if (cur === null || typeof cur !== 'object') return UNRESOLVED;
    if (seg.kind === 'object') {
      cur = (cur as Record<string, unknown>)[seg.key];
    } else {
      cur = (cur as unknown[])[seg.index];
    }
  }
  return cur;
}

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

  // Fall back to scope-aware evaluation. We anchor against the
  // module's Program-scope NodePath rather than re-walking the AST
  // to find the target node — the export init is, in the common
  // case, a top-level expression whose Identifier references are all
  // resolvable at program scope. Theme files rarely introduce inner
  // function scopes that the evaluator can fold into anyway (calls
  // are out of scope), so program scope is a safe fit.
  const record = ctx.cache.get(modulePath);
  if (!record) return UNRESOLVED;
  const programPath = getProgramPath(record);
  if (!programPath) return UNRESOLVED;
  return evalExpression(node, programPath, modulePath, ctx);
}

/**
 * Lazily compute and cache the `NodePath<Program>` for a module. One
 * traversal per module amortizes across every identifier resolution
 * that needs scope.
 */
function getProgramPath(record: ModuleRecord): NodePath<t.Program> | null {
  if (record.programPath) return record.programPath;
  let captured: NodePath<t.Program> | null = null;
  traverse(record.ast, {
    Program(path) {
      captured = path;
      path.stop();
    },
  });
  record.programPath = captured;
  return captured;
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

  // JSON modules: parse natively and synthesize an AST that the rest
  // of the resolver treats like any other module. Each top-level key
  // becomes a named export; the whole object is also the default
  // export — matching Vite / Rollup ESM JSON import semantics.
  if (modulePath.endsWith('.json')) {
    const record = loadJsonModule(modulePath, source);
    cache.set(modulePath, record);
    return record;
  }

  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      sourceFilename: modulePath,
      // Theme files commonly use modern syntax. Babel handles unused
      // grammars lazily so the cost is negligible; the upside is
      // fewer parse errors that silently disable cross-file folding.
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
    });
  } catch {
    cache.set(modulePath, null);
    return null;
  }

  const exports = new Map<string, ExportEntry>();
  const reExports: ReExport[] = [];

  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt)) {
      // `export const x = ...;` / `export function x() {}` / etc.
      if (stmt.declaration) {
        if (t.isVariableDeclaration(stmt.declaration)) {
          for (const decl of stmt.declaration.declarations) {
            if (!decl.init) continue;
            if (t.isIdentifier(decl.id)) {
              exports.set(decl.id.name, { init: decl.init });
            } else {
              // Destructured: `export const { primary } = colors` or
              // `export const [first] = arr`. Walk the pattern,
              // attaching a path to the shared `init` for each
              // bound name.
              collectPatternBindings(decl.id, decl.init, [], exports);
            }
          }
        } else if (
          (t.isFunctionDeclaration(stmt.declaration) ||
            t.isClassDeclaration(stmt.declaration)) &&
          stmt.declaration.id
        ) {
          // We can't statically evaluate functions/classes; record a
          // placeholder so the lookup hits and bails.
          exports.set(stmt.declaration.id.name, { init: stmt.declaration });
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
            // `export { x }` — link to the local declaration. Honors
            // destructured locals via the shared pattern walker.
            const entry = findLocalExportEntry(ast, local);
            if (entry) exports.set(exported, entry);
          }
        }
      }
    } else if (t.isExportDefaultDeclaration(stmt)) {
      const d = stmt.declaration;
      if (t.isExpression(d)) exports.set('default', { init: d });
      // Function/class default: leave unresolvable.
    } else if (t.isExportAllDeclaration(stmt)) {
      reExports.push({ kind: 'all', source: stmt.source.value });
    }
  }

  const record: ModuleRecord = {
    path: modulePath,
    ast,
    exports,
    reExports,
    programPath: null,
    namespace: undefined,
  };
  cache.set(modulePath, record);
  return record;
}

/**
 * Build a synthetic ModuleRecord for a `.json` import.
 *
 * Each top-level JSON key becomes a named export; the whole object is
 * also the default export. Each value is converted to an equivalent
 * AST literal so the rest of the evaluator sees a normal-shaped
 * record and the existing `evalExpression` path resolves everything.
 */
function loadJsonModule(modulePath: string, source: string): ModuleRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }

  const ast = parse('', { sourceType: 'module', sourceFilename: modulePath });
  const exports = new Map<string, ExportEntry>();
  const defaultNode = jsonToAst(value);
  exports.set('default', { init: defaultNode });
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      exports.set(k, { init: jsonToAst(v) });
    }
  }
  return {
    path: modulePath,
    ast,
    exports,
    reExports: [],
    programPath: null,
    namespace: undefined,
  };
}

function jsonToAst(value: unknown): t.Node {
  if (value === null) return t.nullLiteral();
  if (typeof value === 'string') return t.stringLiteral(value);
  if (typeof value === 'number') return t.numericLiteral(value);
  if (typeof value === 'boolean') return t.booleanLiteral(value);
  if (Array.isArray(value)) {
    return t.arrayExpression(value.map((v) => jsonToAst(v) as t.Expression));
  }
  if (typeof value === 'object') {
    const props: t.ObjectProperty[] = [];
    for (const [k, v] of Object.entries(value)) {
      // String-literal keys, not identifiers. JSON keys can contain
      // hyphens, spaces, leading digits, or any other non-Identifier
      // character; `t.identifier(k)` would throw on those. The
      // evaluator's ObjectExpression branch handles both forms.
      props.push(
        t.objectProperty(t.stringLiteral(k), jsonToAst(v) as t.Expression),
      );
    }
    return t.objectExpression(props);
  }
  // `undefined` / function / symbol — JSON.parse can't produce these,
  // but defend anyway by emitting a node the evaluator will refuse.
  return t.identifier('undefined');
}

/**
 * Walk a destructure pattern and register one ExportEntry per bound
 * identifier, each carrying a path that — when applied to the shared
 * `init` value — produces that identifier's destructured value.
 *
 * Supported:
 *   - ObjectPattern shorthand: `{ a }` → path `[{ object: 'a' }]`
 *   - ObjectPattern renamed:   `{ a: b }` → bind `b`, path `[{ object: 'a' }]`
 *   - ArrayPattern:            `[a, b]` → path `[{ array: 0 }]`, …
 *   - Nested patterns:         `{ a: { b } }` → path `[{ object: 'a' }, { object: 'b' }]`
 *
 * Unsupported (yields no binding for that slot):
 *   - Computed property keys
 *   - Default values (`{ a = 1 }`) — would need fallback semantics
 *   - Rest patterns (`{ ...rest }`)
 */
function collectPatternBindings(
  pattern: t.Node,
  init: t.Node,
  pathSoFar: ReadonlyArray<PathSegment>,
  out: Map<string, ExportEntry>,
): void {
  if (t.isIdentifier(pattern)) {
    out.set(pattern.name, { init, path: [...pathSoFar] });
    return;
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) continue;
      let keyName: string;
      if (t.isIdentifier(prop.key)) keyName = prop.key.name;
      else if (t.isStringLiteral(prop.key)) keyName = prop.key.value;
      else if (t.isNumericLiteral(prop.key)) keyName = String(prop.key.value);
      else continue;
      collectPatternBindings(
        prop.value,
        init,
        [...pathSoFar, { kind: 'object', key: keyName }],
        out,
      );
    }
    return;
  }
  if (t.isArrayPattern(pattern)) {
    pattern.elements.forEach((el, i) => {
      if (el === null) return;
      collectPatternBindings(
        el,
        init,
        [...pathSoFar, { kind: 'array', index: i }],
        out,
      );
    });
    return;
  }
  // AssignmentPattern (`{ a = default }`) and RestElement intentionally
  // skipped.
}

/**
 * Finds the local declaration of `name` in a module's top-level
 * scope, returning a fully-formed `ExportEntry` so destructured
 * locals (`const { x } = colors; export { x };`) carry their path
 * the same way `export const { x } = colors` does.
 */
function findLocalExportEntry(ast: t.File, name: string): ExportEntry | null {
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!decl.init) continue;
        if (t.isIdentifier(decl.id) && decl.id.name === name) {
          return { init: decl.init };
        }
        // Destructure: walk the pattern, return only if it binds
        // the requested name. Reusing the same collector keeps the
        // semantics in lockstep with `export const { x } = ...`.
        if (
          t.isObjectPattern(decl.id) ||
          t.isArrayPattern(decl.id)
        ) {
          const tmp = new Map<string, ExportEntry>();
          collectPatternBindings(decl.id, decl.init, [], tmp);
          const hit = tmp.get(name);
          if (hit) return hit;
        }
      }
    } else if (
      (t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) &&
      stmt.id?.name === name
    ) {
      return { init: stmt };
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
