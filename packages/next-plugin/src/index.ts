/**
 * `@cassida/next-plugin` — Next.js integration for Cassida.
 *
 * Phase 1 scaffold: defines the `withCassida()` API surface and the
 * `NextCassidaOptions` type. The actual SWC-plugin registration,
 * IR-comment loader, and CSS virtual module are no-ops for now — they
 * land in subsequent commits as Phase 1 fills in.
 *
 * Design reference: `.claude/plans/swc-port-phase-1.md`.
 */

import type {
  CassConfig,
  CassPlugin,
  Registry,
} from '@cassida/compiler';
import type { CassParserPlugin, PathAliases } from '@cassida/parser';

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
export function withCassida<TConfig>(
  nextConfig: TConfig = {} as TConfig,
  _cassidaOptions: NextCassidaOptions = {},
): TConfig {
  // TODO(phase-1):
  //   1. Resolve options against CassConfig schema (reuse compiler's parser).
  //   2. Auto-discover path aliases when `pathAliases` is undefined.
  //   3. Inject `experimental.swcPlugins` with @cassida/swc-plugin's WASM.
  //      Resolve the path via `import { wasmPath } from '@cassida/swc-plugin/loader'`
  //      rather than `require.resolve('@cassida/swc-plugin')` so pnpm
  //      hoisting / dual-CJS-ESM packages don't trip the resolver.
  //   4. Register the IR-comment loader for webpack + turbopack.
  //   5. Register the @layer cas virtual module.
  //   6. RSC guard: warn when cas() runtime lands in a Server Component.
  //   7. Function-config support: Next.js permits `(phase, ctx) => NextConfig`
  //      in `next.config.{js,mjs,ts}` in addition to the object form.
  //      The mutation path needs to wrap the user function so options are
  //      applied to its return value; the current generic signature accepts
  //      both shapes structurally but does no work, so functional configs
  //      pass through unchanged for now.
  return nextConfig;
}

export type { CassConfig, CassPlugin, CassParserPlugin, PathAliases };
