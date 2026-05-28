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
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { NextConfig } from 'next';
import type { CassConfig, CassPlugin, Registry } from '@cassida/compiler';
import type { CassParserPlugin, PathAliases } from '@cassida/parser';

import type { IrLoaderOptions } from './ir-loader.js';
export { rewriteIrComments, default as cassidaIrLoader } from './ir-loader.js';
export type { IrLoaderOptions } from './ir-loader.js';
export { buildVirtualCss } from './virtual-css.js';
export type { VirtualCssOptions } from './virtual-css.js';
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

const wasmPath = resolveWasmPath();

function applyCassida(
  cfg: NextConfig,
  options: NextCassidaOptions,
): NextConfig {
  const loaderOptions: IrLoaderOptions = {
    ...(options.registry !== undefined ? { registry: options.registry } : {}),
    ...(options.shorthand?.policy !== undefined
      ? { shorthandPolicy: options.shorthand.policy }
      : {}),
    ...(options.cssPlugins !== undefined ? { plugins: options.cssPlugins } : {}),
  };

  // 1. Register the SWC plugin (the chain → IR-comment transform).
  // Next.js's `experimental.swcPlugins` is an array of
  // `[pathOrPackage, jsonOptions]` tuples. The wasm artefact ships
  // alongside this package via the `./loader` subpath export.
  // Skip the append if the same wasm path is already registered
  // (e.g. the user wrapped twice, or another tool added it) so the
  // plugin doesn't run on every file twice.
  const existingSwcPlugins = readSwcPlugins(cfg);
  const alreadyRegistered = existingSwcPlugins.some(
    ([path]) => path === wasmPath,
  );
  const swcPlugins: SwcPluginEntry[] = alreadyRegistered
    ? [...existingSwcPlugins]
    : [...existingSwcPlugins, [wasmPath, {}]];

  // 2. Wrap user's `webpack` hook to inject the IR-comment loader.
  const userWebpack = cfg.webpack;
  const loaderExclude =
    options.loaderExclude === undefined ? /node_modules/ : options.loaderExclude;
  const wrappedWebpack: NextWebpackHook = (config, ctx) => {
    const base =
      typeof userWebpack === 'function' ? userWebpack(config, ctx) : config;
    return injectIrLoader(base, loaderOptions, loaderExclude);
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
 * directory, regardless of whether the runtime loaded the package as
 * ESM (`import.meta.url`) or CJS (`__filename`). Used by the wasm
 * lookup and the loader-path lookup below. Windows-safe via
 * `pathToFileURL` for the CJS fallback.
 */
function getRequire(): NodeRequire {
  const url =
    typeof import.meta !== 'undefined' && import.meta.url
      ? import.meta.url
      : pathToFileURL(__filename).toString();
  const here = dirname(fileURLToPath(url));
  return createRequire(`${here}/`);
}

/**
 * Resolve the WASM artefact path via the loader subpath. Avoids
 * `require.resolve('@cassida/swc-plugin')` directly because the
 * package's `main` points at the WASM file — some toolchains
 * stumble on that.
 */
function resolveWasmPath(): string {
  const req = getRequire();
  const loaderEntry = req('@cassida/swc-plugin/loader') as { wasmPath: string };
  return loaderEntry.wasmPath;
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
  return {
    ...config,
    module: {
      ...(config.module ?? {}),
      rules: [...rules, loaderRule],
    },
  };
}

function cassidaIrLoaderPath(): string {
  return getRequire().resolve('@cassida/next-plugin/dist/ir-loader.js');
}

export type { CassConfig, CassPlugin, CassParserPlugin, PathAliases };
