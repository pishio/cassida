/**
 * Type-only assertions for `@cassida/next-plugin`.
 *
 * The `.test-d.ts` suffix is outside vitest's `**\/*.test.ts` include
 * pattern, so this file is never executed at runtime; it is only checked
 * by `tsc -p tsconfig.typecheck.json`. Each `// @ts-expect-error` encodes
 * a consumer-facing guarantee — if the line below ever stops being a
 * type error, the directive itself errors and CI surfaces the regression.
 */
import type { NextConfig } from 'next';
import type { CassConfig, Registry } from '@cassida/compiler';
import { defaultRegistry } from '@cassida/compiler';
import {
  buildVirtualCss,
  rewriteIrComments,
  withCassida,
  type IrLoaderOptions,
  type NextCassidaOptions,
  type NextConfigFn,
  type VirtualCssOptions,
} from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // ────────────────────────────────────────────────────────────────
  // 1) `NextCassidaOptions extends CassConfig` — every CassConfig
  //    field is assignable to NextCassidaOptions and vice-versa
  //    when filtered to the shared keys.
  // ────────────────────────────────────────────────────────────────
  const fromCassConfig: CassConfig = { layer: 'cas' };
  const nextOpts: NextCassidaOptions = fromCassConfig;
  void nextOpts;

  // ────────────────────────────────────────────────────────────────
  // 2) `NextCassidaOptions.plugins` is the declarative form. Each key
  //    has a precise type — no widening, no `unknown` leak.
  // ────────────────────────────────────────────────────────────────
  type PluginsField = NonNullable<NextCassidaOptions['plugins']>;

  // `hoverFix` is exactly `boolean | undefined`.
  type HoverFixType = PluginsField['hoverFix'];
  const _hover: HoverFixType = true;
  const _hoverUndef: HoverFixType = undefined;
  void _hover;
  void _hoverUndef;
  // @ts-expect-error -- hoverFix is a boolean toggle, not a string
  const _badHover: HoverFixType = 'enabled';
  void _badHover;

  // `conditional` is `boolean | { shortCircuit?: boolean } | undefined`.
  const _condBool: PluginsField['conditional'] = false;
  const _condObj: PluginsField['conditional'] = { shortCircuit: true };
  const _condUndef: PluginsField['conditional'] = undefined;
  void _condBool;
  void _condObj;
  void _condUndef;
  // @ts-expect-error -- `conditional` object form rejects unknown fields
  const _badCondShape: PluginsField['conditional'] = { unknown: true };
  void _badCondShape;
  // @ts-expect-error -- `conditional` does not accept arbitrary strings
  const _badCondStr: PluginsField['conditional'] = 'on';
  void _badCondStr;

  // `globalCss` permits `boolean | { preflight?: string } | undefined`.
  const _g1: PluginsField['globalCss'] = true;
  const _g2: PluginsField['globalCss'] = { preflight: '* { box-sizing: border-box }' };
  void _g1;
  void _g2;

  // `print` is purely `boolean | undefined`.
  const _print: PluginsField['print'] = true;
  void _print;

  // ────────────────────────────────────────────────────────────────
  // 3) `withCassida` overloads: function-form input → function-form
  //    output; object-form input → object-form output. The narrowed
  //    return type lets call sites rely on the result's shape without
  //    a runtime guard.
  // ────────────────────────────────────────────────────────────────
  const userFn: NextConfigFn = (_phase, _ctx) => ({});
  const wrappedFn: NextConfigFn = withCassida(userFn);
  void wrappedFn;

  // Object form: input `NextConfig` → output `NextConfig`.
  const userCfg: NextConfig = { reactStrictMode: true };
  const wrappedCfg: NextConfig = withCassida(userCfg);
  void wrappedCfg;

  // Empty / no-arg call: returns `NextConfig` per the object overload.
  const empty: NextConfig = withCassida();
  void empty;

  // Options forwarded with a typed shape.
  withCassida(userCfg, { plugins: { hoverFix: true } });
  withCassida(userFn, { plugins: { conditional: { shortCircuit: true } } });
  // @ts-expect-error -- bad plugin key shape
  withCassida(userCfg, { plugins: { hoverFix: 'on' } });

  // ────────────────────────────────────────────────────────────────
  // 4) `NextConfigFn` shape: `(phase: string, ctx: { defaultConfig })
  //    => NextConfig | Promise<NextConfig>`. Sync or async user
  //    functions both satisfy it.
  // ────────────────────────────────────────────────────────────────
  const syncFn: NextConfigFn = (_phase, _ctx) => ({ reactStrictMode: true });
  const asyncFn: NextConfigFn = async (_phase, _ctx) => ({ reactStrictMode: true });
  void syncFn;
  void asyncFn;
  // TypeScript functions are contravariant in arity, so a single-arg
  // user fn is structurally compatible with the two-arg signature.
  // What we DO assert: a function returning the wrong shape fails.
  // @ts-expect-error -- return shape must be NextConfig | Promise<NextConfig>
  const _badReturn: NextConfigFn = () => 'not-a-config';
  void _badReturn;

  // ────────────────────────────────────────────────────────────────
  // 5) `IrLoaderOptions` — every field optional, registry / policies
  //    must be of the right shape when present.
  // ────────────────────────────────────────────────────────────────
  const loaderOpts: IrLoaderOptions = {};
  void loaderOpts;
  const loaderOpts2: IrLoaderOptions = { shorthandPolicy: 'strict' };
  void loaderOpts2;
  // @ts-expect-error -- shorthandPolicy is an enum, no arbitrary strings
  const badLoader: IrLoaderOptions = { shorthandPolicy: 'permissive' };
  void badLoader;

  // `rewriteIrComments` returns `{ code: string; rules: CompiledRule[] }`.
  const rewritten = rewriteIrComments('source', loaderOpts);
  const _code: string = rewritten.code;
  const _rulesLen: number = rewritten.rules.length;
  void _code;
  void _rulesLen;

  // ────────────────────────────────────────────────────────────────
  // 6) `VirtualCssOptions` extends `CssEmitterOptions` — the layer
  //    and mediaSort fields are reachable on this shape too.
  // ────────────────────────────────────────────────────────────────
  const vcss: VirtualCssOptions = { layer: 'cas', mediaSort: 'mobile-first' };
  const vcssBuilt: string = buildVirtualCss(vcss);
  void vcssBuilt;
  // @ts-expect-error -- arbitrary mediaSort values are rejected
  const badVcss: VirtualCssOptions = { mediaSort: 'whatever' };
  void badVcss;

  // ────────────────────────────────────────────────────────────────
  // 7) `NextCassidaOptions.pathAliases` accepts a real alias map OR
  //    the special `false` opt-out, but nothing else.
  // ────────────────────────────────────────────────────────────────
  const optsAliasMap: NextCassidaOptions = {
    pathAliases: { '@/*': '/abs/*' },
  };
  const optsAliasFalse: NextCassidaOptions = { pathAliases: false };
  void optsAliasMap;
  void optsAliasFalse;
  // @ts-expect-error -- `true` is not a valid `pathAliases` value
  const badAlias: NextCassidaOptions = { pathAliases: true };
  void badAlias;

  // ────────────────────────────────────────────────────────────────
  // 8) `loaderExclude` is `RegExp | string | predicate | null` — the
  //    documented webpack-rule shape, no widening to `unknown`.
  // ────────────────────────────────────────────────────────────────
  const ex1: NextCassidaOptions = { loaderExclude: /node_modules/ };
  const ex2: NextCassidaOptions = { loaderExclude: '/x/y' };
  const ex3: NextCassidaOptions = { loaderExclude: (p: string): boolean => p.includes('x') };
  const ex4: NextCassidaOptions = { loaderExclude: null };
  void ex1;
  void ex2;
  void ex3;
  void ex4;
  // @ts-expect-error -- numbers are not a valid loaderExclude
  const badEx: NextCassidaOptions = { loaderExclude: 42 };
  void badEx;

  // ────────────────────────────────────────────────────────────────
  // 9) `VirtualCssOptions` shape lock — extends `CssEmitterOptions`,
  //    so `layer` accepts `string | null | undefined` and `mediaSort`
  //    is the narrow literal union `'mobile-first' | 'desktop-first'`.
  //    A future widening (e.g. csstype change in `CssEmitterOptions`)
  //    would surface here as a typecheck regression.
  // ────────────────────────────────────────────────────────────────
  const vco1: VirtualCssOptions = {};
  void vco1;
  const vco2: VirtualCssOptions = { layer: 'cas' };
  void vco2;
  const vco3: VirtualCssOptions = { layer: null };
  void vco3;
  const vco4: VirtualCssOptions = { mediaSort: 'desktop-first' };
  void vco4;
  // @ts-expect-error -- `mediaSort` is a literal union, no arbitrary strings
  const vcoBad: VirtualCssOptions = { mediaSort: 'whatever-first' };
  void vcoBad;

  // ────────────────────────────────────────────────────────────────
  // 10) `NextCassidaOptions['plugins']` is a closed record — unknown
  //     keys (typos like `hoverFixx`) are rejected at the type level
  //     even when EPC is bypassed via a variable indirection. This
  //     catches the silent-runtime-no-op footgun the multi-persona
  //     review flagged.
  // ────────────────────────────────────────────────────────────────
  // @ts-expect-error -- typo: `hoverFix` (closed-record rejects unknown keys)
  const _typo: NextCassidaOptions = { plugins: { hoverFixx: true } };
  void _typo;
  // Sanity: every documented key is still accepted.
  const _ok: NextCassidaOptions = {
    plugins: { hoverFix: true, conditional: true, print: true, globalCss: true },
  };
  void _ok;

  // ────────────────────────────────────────────────────────────────
  // 11) `IrLoaderOptions.registry` accepts a `Registry` from
  //     `@cassida/compiler`. Consumers who override the registry
  //     pass it through this slot; widening or removing the
  //     `Registry` import would silently break that path.
  // ────────────────────────────────────────────────────────────────
  const _loaderWithReg: IrLoaderOptions = { registry: defaultRegistry };
  void _loaderWithReg;
  // The slot is optional — must also accept the empty form.
  const _loaderEmpty: IrLoaderOptions = {};
  void _loaderEmpty;
  // Anchor the `Registry` import as load-bearing.
  const _regAlias: Registry = defaultRegistry;
  void _regAlias;
}
