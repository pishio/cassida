/**
 * Type-only assertions for `@cassida/parser`.
 *
 * The `.test-d.ts` suffix is outside vitest's `**\/*.test.ts` include
 * pattern, so this file is never executed at runtime; it is only checked
 * by `tsc -p tsconfig.typecheck.json`. Each `// @ts-expect-error` encodes
 * a consumer-facing guarantee — if the line below ever stops being a
 * type error, the directive itself errors and CI surfaces the regression.
 */
import { defaultRegistry, type CompiledRule } from '@cassida/compiler';
import {
  createModuleCache,
  loadTsconfigPaths,
  transform,
  type CassParserPlugin,
  type ModuleCache,
  type PathAliases,
  type SpreadPlan,
  type TransformOptions,
  type TransformResult,
} from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // ────────────────────────────────────────────────────────────────
  // 1) `transform()` returns a `TransformResult` with a specific
  //    shape — `code` string, `rules` readonly tuple of CompiledRule,
  //    `map` is `object | null`, `transformed` is a boolean.
  // ────────────────────────────────────────────────────────────────
  const r: TransformResult = transform('', { registry: defaultRegistry });
  const code: string = r.code;
  const rules: readonly CompiledRule[] = r.rules;
  const map: object | null = r.map;
  const transformed: boolean = r.transformed;
  void code;
  void rules;
  void map;
  void transformed;
  // @ts-expect-error -- `TransformResult.rules` is readonly
  r.rules.push({} as never);
  // @ts-expect-error -- `code` is a string, not a number
  const _badCode: number = r.code;
  void _badCode;

  // ────────────────────────────────────────────────────────────────
  // 2) `TransformOptions.registry` is required; all other fields
  //    are optional. Bad shapes are rejected.
  // ────────────────────────────────────────────────────────────────
  // @ts-expect-error -- `registry` is the only required field; missing it errors
  transform('', {});
  // @ts-expect-error -- shorthandPolicy must be one of the allowed enum values
  transform('', { registry: defaultRegistry, shorthandPolicy: 'permissive' });
  // @ts-expect-error -- `importSource` is a string, not a number
  transform('', { registry: defaultRegistry, importSource: 42 });

  // Valid minimum and full options shapes.
  transform('', { registry: defaultRegistry });
  transform('', {
    registry: defaultRegistry,
    filename: '/x/y.tsx',
    importSource: '@cassida/core',
    shorthandPolicy: 'strict',
    crossFileEvaluation: false,
  });
  transform('', {
    registry: defaultRegistry,
    crossFileEvaluation: { cache: createModuleCache() },
  });

  // ────────────────────────────────────────────────────────────────
  // 3) `PathAliases` is a readonly record from pattern → target(s).
  //    Targets can be a single string or a readonly array.
  // ────────────────────────────────────────────────────────────────
  const aliases: PathAliases = {
    '@/*': '/abs/src/*',
    '#shared/*': ['/abs/shared/*', '/abs/fallback/*'],
  };
  void aliases;
  // @ts-expect-error -- numeric target is not allowed
  const badAliases: PathAliases = { '@/*': 42 };
  void badAliases;

  // `loadTsconfigPaths` returns `PathAliases | null`.
  const loaded: PathAliases | null = loadTsconfigPaths(process.cwd());
  void loaded;
  // The optional `onError` callback is typed.
  const loaded2 = loadTsconfigPaths(process.cwd(), { onError: (e: unknown): void => void e });
  void loaded2;
  // @ts-expect-error -- the second argument must be the options object, not a string
  loadTsconfigPaths(process.cwd(), 'bad');

  // ────────────────────────────────────────────────────────────────
  // 4) `ModuleCache` is a Map — `createModuleCache()` returns the
  //    same type and exposes the Map interface.
  // ────────────────────────────────────────────────────────────────
  const cache: ModuleCache = createModuleCache();
  // `Map` methods are available on the returned cache.
  const size: number = cache.size;
  void size;
  cache.clear();

  // ────────────────────────────────────────────────────────────────
  // 5) `CassParserPlugin.trySpread` is optional and, when present,
  //    returns `SpreadPlan | null`. Plugins missing `name` fail
  //    structural typing.
  // ────────────────────────────────────────────────────────────────
  const plugin: CassParserPlugin = {
    name: 'try-something',
    trySpread: (_path, _helpers): SpreadPlan | null => null,
  };
  void plugin;
  // @ts-expect-error -- `name` is required
  const badPlugin: CassParserPlugin = { trySpread: (): null => null };
  void badPlugin;
  const wrongReturn: CassParserPlugin = {
    name: 'bad',
    // @ts-expect-error -- `trySpread` may not return undefined
    trySpread: (): undefined => undefined,
  };
  void wrongReturn;

  // ────────────────────────────────────────────────────────────────
  // 6) `SpreadPlan` carries `rules: readonly CompiledRule[]` plus a
  //    `buildAttrs` callback. The rules array is readonly.
  // ────────────────────────────────────────────────────────────────
  const plan: SpreadPlan = {
    rules: [] as readonly CompiledRule[],
    buildAttrs: () => [],
  };
  void plan;
  // @ts-expect-error -- `rules` is readonly; push errors
  plan.rules.push({} as never);
  // @ts-expect-error -- `SpreadPlan` requires `buildAttrs`
  const badPlan: SpreadPlan = { rules: [] };
  void badPlan;

  // ────────────────────────────────────────────────────────────────
  // 7) `TransformOptions.crossFileEvaluation` is the documented
  //    discriminated shape: boolean OR `{ cache?: ModuleCache }`.
  // ────────────────────────────────────────────────────────────────
  const opts1: TransformOptions = {
    registry: defaultRegistry,
    crossFileEvaluation: true,
  };
  const opts2: TransformOptions = {
    registry: defaultRegistry,
    crossFileEvaluation: { cache: createModuleCache() },
  };
  void opts1;
  void opts2;
  const opts3: TransformOptions = {
    registry: defaultRegistry,
    // @ts-expect-error -- an arbitrary object shape is rejected
    crossFileEvaluation: { somethingElse: 1 },
  };
  void opts3;

  // ────────────────────────────────────────────────────────────────
  // 8) The parser export surface for `pathAliases`: forwarded to the
  //    static evaluator. `PathAliases` is the shape; `false` (the
  //    next-plugin / vite-plugin convention) is NOT accepted here —
  //    those wrappers normalize before calling `transform`.
  // ────────────────────────────────────────────────────────────────
  const optsAlias: TransformOptions = {
    registry: defaultRegistry,
    pathAliases: { '@/*': '/abs/*' },
  };
  void optsAlias;
  const badAlias: TransformOptions = {
    registry: defaultRegistry,
    // @ts-expect-error -- raw `transform()` does not accept `false` here
    pathAliases: false,
  };
  void badAlias;
}
