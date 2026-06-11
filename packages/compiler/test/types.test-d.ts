/**
 * Type-only assertions for `@cassida/compiler`.
 *
 * The `.test-d.ts` suffix is outside vitest's `**\/*.test.ts` include
 * pattern, so this file is never executed at runtime; it is only checked
 * by `tsc -p tsconfig.typecheck.json`. Each `// @ts-expect-error` encodes
 * a consumer-facing guarantee — if the line below ever stops being a
 * type error, the directive itself errors and CI surfaces the regression.
 */
import {
  CassConfigSchema,
  CssEmitter,
  applyPlugins,
  canonicalModifiers,
  compileOps,
  defaultConfig,
  defaultMacros,
  defaultRegistry,
  defineMacro,
  extendRegistry,
  isMethodOp,
  isRawOp,
  isScopedOp,
  mergeConfig,
  parseCassConfig,
  resolveMacros,
  zIndexMacro,
  type CassConfig,
  type CassPlugin,
  type CompiledRule,
  type CompileOptions,
  type CssEmitterOptions,
  type MacroDefinition,
  type MediaSort,
  type MethodOp,
  type Op,
  type PluginContext,
  type RawOp,
  type Registry,
  type RegistryEntry,
  type ResolvedCassConfig,
  type Scope,
  type ScopeBag,
  type ScopedOp,
  type ShorthandPolicy,
} from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // ────────────────────────────────────────────────────────────────
  // 1) `Op` is a discriminated union; the three is-checks narrow it.
  // ────────────────────────────────────────────────────────────────
  const op: Op = { method: 'color', args: ['red'] };
  if (isMethodOp(op)) {
    const m: MethodOp = op;
    // `method` is a plain string after narrow.
    const name: string = m.method;
    void name;
  }
  if (isScopedOp(op)) {
    const s: ScopedOp = op;
    const scope: Scope = s.scope;
    void scope;
  }
  if (isRawOp(op)) {
    const r: RawOp = op;
    const property: string = r.property;
    const value: string = r.value;
    void property;
    void value;
  }

  // ────────────────────────────────────────────────────────────────
  // 2) `Scope` is itself a discriminated union over `kind`.
  // ────────────────────────────────────────────────────────────────
  const pseudo: Scope = { kind: 'pseudo', selector: ':hover' };
  if (pseudo.kind === 'pseudo') {
    const sel: string = pseudo.selector;
    void sel;
  }
  // @ts-expect-error -- `media` scopes have `query`, not `selector`
  const badMedia: Scope = { kind: 'media', selector: '(min-width: 0)' };
  void badMedia;
  // @ts-expect-error -- `raw` scopes do not have a `query` field
  const badRaw: Scope = { kind: 'raw', query: '> *' };
  void badRaw;

  // ────────────────────────────────────────────────────────────────
  // 3) `CssEmitterOptions.layer` accepts string | null | undefined,
  //    `mediaSort` is the `MediaSort` enum.
  // ────────────────────────────────────────────────────────────────
  const okEmitter: CssEmitterOptions = { layer: 'cas', mediaSort: 'mobile-first' };
  const okEmitterNull: CssEmitterOptions = { layer: null };
  void okEmitter;
  void okEmitterNull;
  // @ts-expect-error -- `mediaSort` does not accept arbitrary strings
  const badSort: CssEmitterOptions = { mediaSort: 'arbitrary' };
  void badSort;
  // @ts-expect-error -- `layer` does not accept numbers
  const badLayer: CssEmitterOptions = { layer: 42 };
  void badLayer;

  // ────────────────────────────────────────────────────────────────
  // 4) `MediaSort` and `ShorthandPolicy` are string-literal unions.
  // ────────────────────────────────────────────────────────────────
  const ms1: MediaSort = 'mobile-first';
  const ms2: MediaSort = 'desktop-first';
  const sp1: ShorthandPolicy = 'strict';
  const sp2: ShorthandPolicy = 'shorthand-first';
  const sp3: ShorthandPolicy = 'lenient';
  void ms1;
  void ms2;
  void sp1;
  void sp2;
  void sp3;
  // @ts-expect-error -- only two media-sort values are allowed
  const badMs: MediaSort = 'oldest-first';
  void badMs;
  // @ts-expect-error -- `ShorthandPolicy` does not include 'permissive'
  const badPolicy: ShorthandPolicy = 'permissive';
  void badPolicy;

  // ────────────────────────────────────────────────────────────────
  // 5) `CassConfig` is `.strict()` — extra fields must fail at the
  //    Zod boundary. At the TypeScript surface, `parseCassConfig`
  //    returns the narrowed `CassConfig` shape regardless of input.
  // ────────────────────────────────────────────────────────────────
  const cfg: CassConfig = parseCassConfig({ layer: 'cas' });
  // Returned shape is `CassConfig` — every member optional.
  const layer: string | null | undefined = cfg.layer;
  void layer;
  // Zod-derived inference: `media.sort` is the `MediaSort` enum.
  const parsedSort: MediaSort | undefined = cfg.media?.sort;
  void parsedSort;
  // @ts-expect-error -- `layer` cannot be a number on the TS surface either
  const badConfig: CassConfig = { layer: 42 };
  void badConfig;
  // The `CassConfig` Zod schema is `.strict()` — extra fields are
  // rejected at runtime. Lock the same contract at the type level so
  // a typo in user config surfaces as a typecheck error, not a runtime
  // surprise from `parseCassConfig`.
  // @ts-expect-error -- `CassConfig` rejects unknown fields
  const _badConfig: CassConfig = { unknownField: 1, layer: 'cas' };
  void _badConfig;

  // The Zod schema itself is exported, so consumers can compose it.
  const schema = CassConfigSchema;
  void schema;

  // ────────────────────────────────────────────────────────────────
  // 6) `ResolvedCassConfig` has every field required and `readonly`.
  // ────────────────────────────────────────────────────────────────
  const resolved: ResolvedCassConfig = defaultConfig;
  // Required: `layer` is `string | null`, NOT `undefined`.
  const _layer: string | null = resolved.layer;
  const _sort: MediaSort = resolved.media.sort;
  const _mode: ResolvedCassConfig['css']['mode'] = resolved.css.mode;
  void _layer;
  void _sort;
  void _mode;
  // @ts-expect-error -- `layer` is readonly
  resolved.layer = 'other';

  // `mergeConfig` accepts a sequence of `CassConfig | undefined` and
  // narrows to `ResolvedCassConfig`.
  const merged: ResolvedCassConfig = mergeConfig({ layer: 'cas' }, undefined);
  void merged;
  // @ts-expect-error -- passing a string fails the `CassConfig | undefined` slot
  mergeConfig('not-a-config');

  // ────────────────────────────────────────────────────────────────
  // 7) `Registry` is a frozen record; `RegistryEntry` carries a
  //    `format` formatter and the property metadata. `defaultRegistry`
  //    must be assignable to `Registry`.
  // ────────────────────────────────────────────────────────────────
  const reg: Registry = defaultRegistry;
  void reg;
  // `extendRegistry` accepts two registries and returns a `Registry`.
  const extended: Registry = extendRegistry(defaultRegistry, {});
  void extended;
  // @ts-expect-error -- entries cannot be plain strings
  const badReg: Registry = { color: 'red' };
  void badReg;

  // RegistryEntry shape probe — `format` is callable with unknowns.
  const entry: RegistryEntry = {
    property: 'color',
    format: (v: unknown): string => String(v),
  };
  void entry;
  // @ts-expect-error -- `property` is required
  const badEntry: RegistryEntry = { format: (): string => '' };
  void badEntry;

  // ────────────────────────────────────────────────────────────────
  // 8) `compileOps` returns a `CompiledRule` with a string className,
  //    frozen `dynamics`, and a `ScopeBag` tree. The compile-options
  //    `registry` is required.
  // ────────────────────────────────────────────────────────────────
  const compiled: CompiledRule = compileOps([], { registry: defaultRegistry });
  const cn: string = compiled.className;
  const tree: ScopeBag = compiled.tree;
  void cn;
  void tree;
  // @ts-expect-error -- `registry` is required on CompileOptions
  compileOps([], {});

  // `CompiledRule.dynamics` is `readonly` — push errors.
  // @ts-expect-error -- `dynamics` is readonly
  compiled.dynamics.push({} as never);

  // ────────────────────────────────────────────────────────────────
  // 9) `CssEmitter.add` accepts a `CompiledRule` and returns a string.
  // ────────────────────────────────────────────────────────────────
  const emitter = new CssEmitter({ layer: 'cas' });
  const added: string = emitter.add(compiled);
  void added;
  // @ts-expect-error -- emitter.add does NOT accept a plain string
  emitter.add('cas-deadbeef');

  // ────────────────────────────────────────────────────────────────
  // 10) `applyPlugins` is sync, threads `PluginContext` through, and
  //     enforces the `CassPlugin` shape (name + transform).
  // ────────────────────────────────────────────────────────────────
  const plugin: CassPlugin = {
    name: 'noop',
    transform: (t: ScopeBag): ScopeBag => t,
  };
  const ctx: PluginContext = { config: { layer: 'cas', importSource: '@cassida/core' } };
  const result: ScopeBag = applyPlugins(compiled.tree, [plugin], ctx);
  void result;
  // @ts-expect-error -- plugin must declare a `name`
  const badPlugin: CassPlugin = { transform: (t: ScopeBag): ScopeBag => t };
  void badPlugin;
  const asyncPlugin: CassPlugin = {
    name: 'async',
    // @ts-expect-error -- plugin.transform must be sync (return ScopeBag, not Promise)
    transform: async (t: ScopeBag): Promise<ScopeBag> => t,
  };
  void asyncPlugin;

  // ────────────────────────────────────────────────────────────────
  // 11) `canonicalModifiers` is a frozen const-typed map; keys are the
  //     literal modifier-name set, values are `Scope`-compatible. Each
  //     entry's `kind` survives narrowing in user code.
  // ────────────────────────────────────────────────────────────────
  const hoverScope = canonicalModifiers.hover;
  if (hoverScope.kind === 'pseudo') {
    const sel: string = hoverScope.selector;
    void sel;
  }
  // @ts-expect-error -- "doesNotExist" is not in the canonical modifier map
  void canonicalModifiers.doesNotExist;

  // ────────────────────────────────────────────────────────────────
  // 12) `CompiledRule['tree']['children']` is exactly `readonly ScopeBag[]`.
  //     Emitter recurses through this; widening to `ReadonlyArray<ScopeBag
  //     | RawOp>` (or similar) would break the nested `:hover` / `@media`
  //     emission silently.
  // ────────────────────────────────────────────────────────────────
  type _ChildElement = CompiledRule['tree']['children'] extends ReadonlyArray<infer C> ? C : never;
  type _ChildIsScopeBag = _ChildElement extends ScopeBag ? (ScopeBag extends _ChildElement ? true : false) : false;
  const _childAssert: _ChildIsScopeBag = true;
  void _childAssert;

  // ────────────────────────────────────────────────────────────────
  // 13) Macros surface: `defineMacro` returns a `CassPlugin`,
  //     `defaultMacros` is a readonly array of those, `resolveMacros`
  //     accepts a `readonly string[]` and returns the same shape.
  //     `MacroDefinition` is closed (`.strict()`-style); unknown fields
  //     fail at the type level, matching the zod schema.
  // ────────────────────────────────────────────────────────────────
  const _macroDef: MacroDefinition = {
    name: 'opacity-transition',
    trigger: { property: 'opacity' },
    fills: [{ property: 'transition', value: 'opacity 200ms' }],
  };
  const _macroDefWithSkip: MacroDefinition = {
    name: 'sticky-bottom',
    trigger: { property: 'position', value: 'sticky' },
    fills: [{ property: 'top', value: '0' }],
    skipIfAnyPresent: ['top', 'bottom'],
  };
  const _macroPlugin: CassPlugin = defineMacro(_macroDef);
  void _macroPlugin;

  // `defaultMacros` is readonly and elements are `CassPlugin`.
  const _allMacros: readonly CassPlugin[] = defaultMacros;
  void _allMacros;
  // @ts-expect-error -- defaultMacros is readonly; cannot push
  defaultMacros.push(zIndexMacro);

  // `resolveMacros` accepts no args or a readonly string[].
  const _resolved1: readonly CassPlugin[] = resolveMacros();
  const _resolved2: readonly CassPlugin[] = resolveMacros(['zIndex']);
  void _resolved1;
  void _resolved2;
  // @ts-expect-error -- numbers are not valid macro names
  resolveMacros([1]);

  // `MacroDefinition` rejects unknown fields (zod `.strict` parity).
  const _bad1: MacroDefinition = {
    name: 'x',
    trigger: { property: 'y' },
    fills: [],
    // @ts-expect-error -- unknown field `whenAbsent`
    whenAbsent: ['z'],
  };
  void _bad1;
  // The historical `scope` field has been retracted from the surface
  // (it was reserved for an unimplemented 'all' modifier-scope mode).
  const _bad2: MacroDefinition = {
    name: 'x',
    trigger: { property: 'y' },
    fills: [],
    // @ts-expect-error -- scope is not a part of the type
    scope: 'root',
  };
  void _bad2;

  // ────────────────────────────────────────────────────────────────
  // 14) `CassConfig.macros.disable` is `readonly string[] | undefined`
  //     and the surrounding `macros` block is itself optional. `.strict`
  //     means a typo at the leaf level fails the type check.
  // ────────────────────────────────────────────────────────────────
  const _cfgMacrosOk: CassConfig = { macros: { disable: ['zIndex'] } };
  const _cfgMacrosOmittable: CassConfig = { macros: {} };
  const _cfgMacrosAbsent: CassConfig = {};
  void _cfgMacrosOk;
  void _cfgMacrosOmittable;
  void _cfgMacrosAbsent;
  // @ts-expect-error -- disable must be string[]
  const _cfgMacrosBad1: CassConfig = { macros: { disable: [1] } };
  void _cfgMacrosBad1;
  // @ts-expect-error -- unknown field on the macros block
  const _cfgMacrosBad2: CassConfig = { macros: { enableAll: true } };
  void _cfgMacrosBad2;

  // `ResolvedCassConfig.macros.disable` is a non-optional readonly string[].
  const _resolvedMacros: ResolvedCassConfig['macros'] = { disable: [] };
  void _resolvedMacros;

  // `CompileOptions.macros` is optional readonly CassPlugin[].
  const _compileWithMacros: CompileOptions = {
    registry: defaultRegistry,
    macros: defaultMacros,
  };
  void _compileWithMacros;
}
