/**
 * `@cassida/next-plugin` — Next.js integration for Cassida.
 *
 * `withCassida(nextConfig, options)` wraps a Next.js config to:
 *   1. Register `@cassida/swc-plugin` in `experimental.swcPlugins`
 *      so `cas()` chains in `.tsx` files lift to `Op[]` IR comments.
 *   2. Inject a webpack loader that scans those IR comments,
 *      compiles them via `@cassida/compiler`, substitutes the
 *      placeholder class names, and accumulates the rules.
 *   3. Expose the aggregated `@layer cas` CSS bundle as a virtual
 *      module the consumer's app entry can import.
 *
 * Design reference: `.claude/plans/swc-port-phase-1.md`.
 */

import { createRequire } from 'node:module';

import type { NextConfig } from 'next';
import type { CassConfig, CassPlugin, Registry } from '@cassida/compiler';
import type { CassParserPlugin, PathAliases } from '@cassida/parser';

import type { IrLoaderOptions } from './ir-loader.js';
import { CassidaWebpackPlugin } from './webpack-plugin.js';
export { rewriteIrComments, default as cassidaIrLoader } from './ir-loader.js';
export type { IrLoaderOptions } from './ir-loader.js';
export { buildVirtualCss } from './virtual-css.js';
export type { VirtualCssOptions } from './virtual-css.js';
export { CassidaWebpackPlugin } from './webpack-plugin.js';
export {
  setRulesForFile,
  deleteRulesForFile,
  trackedFiles,
  subscribe as subscribeToRules,
} from './store.js';

/**
 * Functional form of `next.config.{js,mjs,ts}`: receives the build
 * phase + a `defaultConfig` and returns the object (sync or async).
 */
export type NextConfigFn = (
  phase: string,
  ctx: { defaultConfig: NextConfig },
) => NextConfig | Promise<NextConfig>;

/**
 * Either form Next.js permits for a config file. `withCassida` accepts
 * both shapes via overloads so the return type stays narrowed to the
 * shape that was passed in — callers don't need a type guard on the
 * returned value.
 */
export type NextConfigInput = NextConfig | NextConfigFn;

/**
 * Options accepted by `withCassida()`. A superset of the `CassConfig`
 * shape that `cassida.config.json` accepts, plus Next.js-specific knobs
 * for plugin selection, registry override, and the path-alias auto-discovery
 * toggle.
 */
export interface NextCassidaOptions extends CassConfig {
  /**
   * Registry override. Defaults to `@cassida/compiler`'s `defaultRegistry`.
   * Custom registries are rarely needed; the typical override is to extend
   * the property table for proprietary CSS properties.
   */
  readonly registry?: Registry;

  /**
   * Which optional plugins to load. Each key matches an `@cassida/plugin-*`
   * package; `true` enables with defaults, `false` disables, an object
   * passes per-plugin options. Unknown keys are ignored with a warning.
   *
   * Plugins are lazy-imported, so disabling one means the package isn't
   * loaded at all — useful for keeping the build cold-start cheap.
   */
  readonly plugins?: {
    readonly hoverFix?: boolean;
    readonly conditional?: boolean | { readonly shortCircuit?: boolean };
    readonly print?: boolean;
    readonly globalCss?: boolean | { readonly preflight?: string };
  };

  /**
   * AST-level parser plugins. Same shape as `@cassida/parser`'s
   * `CassParserPlugin`. Inline-only — these are functions, not
   * serialisable. Phase 1 ships the loader path; the SWC plugin Phase 4
   * will route unclaimed spreads to JS plugins via the same interface.
   */
  readonly parserPlugins?: readonly CassParserPlugin[];

  /**
   * CSS plugins forwarded to `compileOps`. Like `parserPlugins`, inline-only.
   */
  readonly cssPlugins?: readonly CassPlugin[];

  /**
   * TypeScript-style path aliases for cross-file evaluation. When omitted
   * (default), the loader auto-discovers `compilerOptions.paths` from
   * `tsconfig.json` via `loadTsconfigPaths(projectRoot)`. Pass `false` to
   * disable auto-discovery, or an explicit map to override.
   */
  readonly pathAliases?: PathAliases | false;

  /**
   * Files / paths the IR-comment loader should skip. Defaults to
   * `/node_modules/` — third-party packages don't run through the
   * Cassida SWC plugin and therefore can't contain IR comments. In
   * a pnpm / yarn workspace where local packages are symlinked into
   * `node_modules`, override this (or pass `null` for no exclusion)
   * so chains inside those workspace packages still get compiled.
   *
   * Mirrors webpack's `Rule.exclude` shape: a regex, a string path,
   * a predicate, or `null` to disable.
   */
  readonly loaderExclude?: RegExp | string | ((path: string) => boolean) | null;

  /**
   * How the plugin bridges rules across Next.js's parallel webpack
   * compilers (Client, Server, Edge, Middleware).
   *
   *   - `'shared-singleton'` (default) — all four compilers feed into
   *     the in-process module-singleton rule store. The Client
   *     compiler's `processAssets` drains the union when it writes
   *     `virtual.css`. This is the path Server-only Server Components
   *     take to reach the browser stylesheet. See
   *     `packages/next-plugin/src/store.ts` for the contract.
   *
   *   - `'sidecar-file'` (Phase 2, not yet implemented) — writes
   *     per-compiler rule snapshots to a filesystem sidecar and reads
   *     the union from there. Removes the module-singleton at the
   *     cost of build-time IO. Throws at config time if selected
   *     today so consumers don't silently fall back.
   *
   * Defaults to `'shared-singleton'`. Leave unset unless you have a
   * specific reason to opt out — every shipped Next.js integration
   * test relies on the singleton bridge.
   */
  readonly multiCompilerMode?: 'shared-singleton' | 'sidecar-file';
}

/**
 * Wrap a Next.js config with Cassida integration. Registers the SWC
 * plugin, wires up the CSS pipeline, and configures path-alias resolution.
 *
 * ```js
 * // next.config.js
 * import { withCassida } from '@cassida/next-plugin';
 *
 * export default withCassida(
 *   { reactStrictMode: true },
 *   { plugins: { hoverFix: true, conditional: true } },
 * );
 * ```
 *
 * Phase 1 returns the next config unchanged. The full integration lands
 * in subsequent commits.
 */
// Function-form overload is declared first: NextConfig has an open
// index signature, so a `(phase, ctx) => ...` arrow is also assignable
// to NextConfig itself. TypeScript picks the first matching overload,
// so flipping the order would silently route function-form callers
// into the object-form return and break narrowing at call sites.
export function withCassida(
  nextConfig: NextConfigFn,
  cassidaOptions?: NextCassidaOptions,
): NextConfigFn;
export function withCassida(
  nextConfig?: NextConfig,
  cassidaOptions?: NextCassidaOptions,
): NextConfig;
export function withCassida(
  nextConfig: NextConfigInput = {},
  cassidaOptions: NextCassidaOptions = {},
): NextConfigInput {
  // Function-form `next.config.js` returns the wrapped function so
  // the integration applies to whatever NextConfig it eventually
  // resolves to. Preserve the user function's sync / async shape:
  // forcing an async wrapper around a sync user function would
  // surprise third-party tools that introspect the return type.
  if (typeof nextConfig === 'function') {
    const userFn = nextConfig;
    return ((phase, ctx) => {
      const resolved = userFn(phase, ctx);
      if (resolved instanceof Promise) {
        return resolved.then((cfg) => applyCassida(cfg, cassidaOptions));
      }
      return applyCassida(resolved, cassidaOptions);
    }) as NextConfigFn;
  }
  return applyCassida(nextConfig, cassidaOptions);
}

// Lazy memoisation — defer the wasm lookup until `withCassida` is
// actually invoked. Importing the package shouldn't fail when the
// wasm artefact is missing (e.g. during monorepo bootstrap, static
// analysis, or unit tests that don't exercise the integration).
let cachedWasmPath: string | undefined;
function getWasmPath(): string {
  return (cachedWasmPath ??= resolveWasmPath());
}

function applyCassida(
  cfg: NextConfig,
  options: NextCassidaOptions,
): NextConfig {
  // `multiCompilerMode` is forward-looking. Only the singleton bridge
  // is implemented today — fail loudly at config time on the other
  // value so consumers don't silently fall back. See the option's
  // JSDoc for the architectural background.
  const multiCompilerMode = options.multiCompilerMode ?? 'shared-singleton';
  if (multiCompilerMode === 'sidecar-file') {
    throw new Error(
      '[cassida/next-plugin] multiCompilerMode: "sidecar-file" is not yet ' +
        'implemented (Phase 2). Use "shared-singleton" (the default) or omit ' +
        'the option entirely.',
    );
  }
  if (
    multiCompilerMode !== 'shared-singleton' &&
    multiCompilerMode !== 'sidecar-file'
  ) {
    throw new Error(
      `[cassida/next-plugin] multiCompilerMode: unknown value ${JSON.stringify(
        multiCompilerMode,
      )}. Allowed: "shared-singleton" (default), "sidecar-file" (Phase 2 stub).`,
    );
  }

  // `options.plugins` is the declarative form (`{ hoverFix: true, ... }`);
  // resolve each enabled flag into the actual `CassPlugin` instance and
  // merge with the inline `options.cssPlugins` list. Without this the
  // declarative form is silently inert.
  const resolvedPlugins = resolveDeclarativeCssPlugins(options.plugins);
  const mergedPlugins: CassPlugin[] = [
    ...resolvedPlugins,
    ...(options.cssPlugins ?? []),
  ];
  const loaderOptions: IrLoaderOptions = {
    ...(options.registry !== undefined ? { registry: options.registry } : {}),
    ...(options.shorthand?.policy !== undefined
      ? { shorthandPolicy: options.shorthand.policy }
      : {}),
    ...(mergedPlugins.length > 0 ? { plugins: mergedPlugins } : {}),
  };

  // 1. Register the SWC plugin (the chain → IR-comment transform).
  // Next.js's `experimental.swcPlugins` is an array of
  // `[pathOrPackage, jsonOptions]` tuples. The wasm artefact ships
  // alongside this package via the `./loader` subpath export.
  // Skip the append if the same wasm path is already registered
  // (e.g. the user wrapped twice, or another tool added it) so the
  // plugin doesn't run on every file twice.
  const wasm = getWasmPath();
  const existingSwcPlugins = readSwcPlugins(cfg);
  const alreadyRegistered = existingSwcPlugins.some(
    ([path]) => path === wasm,
  );
  const swcPlugins: SwcPluginEntry[] = alreadyRegistered
    ? [...existingSwcPlugins]
    : [...existingSwcPlugins, [wasm, {}]];

  // `CssEmitter`'s `layer` field defaults to `'fss'` (a vestige of
  // the pre-rename project name); for `withCassida` callers we want
  // `'cas'` — matching `defaultConfig.layer`, the README, and the
  // documented `@layer cas { ... }` contract every consumer asserts
  // against. Honour `options.layer` if the user explicitly set one
  // (string for custom name, `null` for "no @layer wrap").
  const layer: string | null = options.layer ?? 'cas';

  // 2. Wrap user's `webpack` hook to inject the IR-comment loader.
  const userWebpack = cfg.webpack;
  const loaderExclude =
    options.loaderExclude === undefined ? /node_modules/ : options.loaderExclude;
  const wrappedWebpack: NextWebpackHook = (config, ctx) => {
    const base =
      typeof userWebpack === 'function' ? userWebpack(config, ctx) : config;
    return injectIrLoader(base, loaderOptions, loaderExclude, { layer });
  };

  return {
    ...cfg,
    experimental: {
      ...(cfg.experimental ?? {}),
      swcPlugins,
    },
    webpack: wrappedWebpack,
  };
}

/**
 * Build a `createRequire`-backed resolver anchored at THIS module's
 * file, regardless of whether the runtime loaded the package as ESM
 * (`import.meta.url`) or CJS (`__filename`). `createRequire` accepts
 * either form directly — a file URL or an absolute path — so we can
 * hand it the raw value without round-tripping through
 * `pathToFileURL` / `fileURLToPath` / `dirname`.
 *
 * The `__filename` reference is guarded behind a `typeof` check so
 * strict ESM hosts that don't define it (some bundlers, Deno-compat
 * shims) don't trip a `ReferenceError` while evaluating the ternary.
 */
function getRequire(): NodeRequire {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return createRequire(import.meta.url);
  }
  if (typeof __filename !== 'undefined') {
    return createRequire(__filename);
  }
  // Last-resort fallback: anchor at the current working directory.
  // Reached only on truly exotic hosts with neither `import.meta.url`
  // nor `__filename`.
  return createRequire(`${process.cwd()}/`);
}

/**
 * Resolve the Next.js-targeted WASM artefact path via the loader
 * subpath. `@cassida/swc-plugin` ships two builds (modern for
 * Rspack / @swc/core mainline, next for `@next/swc`) — we deliberately
 * pick `wasmPathNext` because the SWC plugin ABI is version-bound to
 * the host's swc_core and Next.js 15.x pins swc_core 35.0.0, which
 * the modern (66.x) WASM is not ABI-compatible with. Loading the
 * wrong build manifests as "failed to invoke plugin" on every file.
 *
 * Going through the `loader` subpath avoids
 * `require.resolve('@cassida/swc-plugin')` — the package's `main`
 * points at the modern WASM file directly and some toolchains stumble
 * on that.
 */
function resolveWasmPath(): string {
  const req = getRequire();
  const loaderEntry = req('@cassida/swc-plugin/loader') as {
    wasmPathNext: string;
  };
  return loaderEntry.wasmPathNext;
}

type SwcPluginEntry = [string, Record<string, unknown>];

function readSwcPlugins(cfg: NextConfig): readonly SwcPluginEntry[] {
  const experimental = cfg.experimental as
    | { swcPlugins?: readonly SwcPluginEntry[] }
    | undefined;
  return experimental?.swcPlugins ?? [];
}

type NextWebpackHook = NonNullable<NextConfig['webpack']>;
type WebpackConfig = Parameters<NextWebpackHook>[0];

function injectIrLoader(
  config: WebpackConfig,
  options: IrLoaderOptions,
  exclude: RegExp | string | ((path: string) => boolean) | null,
  webpackPluginOptions: { layer: string | null },
): WebpackConfig {
  const loaderRule = {
    test: /\.[cm]?[jt]sx?$/,
    enforce: 'post' as const,
    // Default to skipping node_modules — third-party packages don't
    // carry Cassida IR. Monorepo consumers with symlinked workspace
    // packages can override via `loaderExclude` so chains inside
    // those packages still get compiled.
    ...(exclude !== null ? { exclude } : {}),
    use: [
      {
        loader: cassidaIrLoaderPath(),
        options,
      },
    ],
  };
  const rules = (config.module?.rules ?? []) as unknown[];
  const existingPlugins = (config.plugins ?? []) as unknown[];
  // Next.js invokes the user's `webpack` hook once per compilation
  // (client + server + edge + middleware in App Router). A naive
  // append would land N CassidaWebpackPlugin instances on the same
  // shared config object, each with its own listener wired into
  // the singleton store — redundant rewrites at best, double-fire
  // bugs at worst. Check for an existing instance before append,
  // both `instanceof` (same realm) and constructor-name (different
  // realm — bundled / re-exported / hoisted copies).
  const hasCassidaPlugin = existingPlugins.some(
    (p) =>
      p instanceof CassidaWebpackPlugin ||
      (typeof p === 'object' &&
        p !== null &&
        (p as { constructor?: { name?: string } }).constructor?.name ===
          'CassidaWebpackPlugin'),
  );
  return {
    ...config,
    module: {
      ...(config.module ?? {}),
      rules: [...rules, loaderRule],
    },
    plugins: hasCassidaPlugin
      ? existingPlugins
      : [...existingPlugins, new CassidaWebpackPlugin(webpackPluginOptions)],
  };
}

/**
 * Resolve the enabled entries in `options.plugins` (the declarative
 * convenience form) into actual `CassPlugin` instances.
 *
 * Phase 1.x scope:
 *   - `hoverFix`: synchronously require'd from `@cassida/plugin-hover-fix`.
 *
 * The remaining flags (`conditional`, `print`, `globalCss`) wire to
 * pieces that aren't CSS plugins:
 *   - `conditional` is a parser plugin and needs the Phase 4 parser-
 *     plugin API on the SWC side before it can fire here.
 *   - `print` is a CSS-string factory; it's served through the global
 *     CSS pipeline, not via `compileOps`.
 *   - `globalCss` is a Vite plugin; the Next.js equivalent is a
 *     separate webpack integration that lands in a follow-up.
 * For now those three are recognised but no-op; a console warning
 * surfaces when the user enables them so the misconfiguration is
 * visible. Removing the warning is the signal that Phase 1.x has
 * caught up.
 */
function resolveDeclarativeCssPlugins(
  flags: NextCassidaOptions['plugins'],
): CassPlugin[] {
  if (!flags) return [];
  const plugins: CassPlugin[] = [];
  if (flags.hoverFix) {
    try {
      // `@cassida/plugin-hover-fix` exports a default `hoverFix()`
      // factory. createRequire'd CJS surfaces ESM defaults as
      // `mod.default`; the type cast threads both possibilities.
      const mod = getRequire()('@cassida/plugin-hover-fix') as
        | { default: (opts?: unknown) => CassPlugin }
        | ((opts?: unknown) => CassPlugin);
      const factory = typeof mod === 'function' ? mod : mod.default;
      plugins.push(factory());
    } catch (cause) {
      throw new Error(
        `[cassida/next-plugin] options.plugins.hoverFix is enabled but @cassida/plugin-hover-fix could not be required: ${(cause as Error).message}`,
      );
    }
  }
  for (const stubKey of ['conditional', 'print', 'globalCss'] as const) {
    if (flags[stubKey]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cassida/next-plugin] options.plugins.${stubKey} is recognised but not yet wired in the Next.js path. ` +
          `Tracking issue: https://github.com/pishio/cassida/issues — disable this flag to silence the warning.`,
      );
    }
  }
  return plugins;
}

function cassidaIrLoaderPath(): string {
  // Relative resolve sidesteps the package's `exports` map. The
  // map only exposes `.` and `./package.json`, so a
  // `require.resolve('@cassida/next-plugin/dist/ir-loader.js')`
  // call would land on `ERR_PACKAGE_PATH_NOT_EXPORTED` in modern
  // Node. The relative form anchors at this file's directory and
  // walks the publish layout directly.
  return getRequire().resolve('./ir-loader.js');
}

export type { CassConfig, CassPlugin, CassParserPlugin, PathAliases };
