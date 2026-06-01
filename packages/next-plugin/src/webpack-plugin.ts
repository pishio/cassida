/**
 * `CassidaWebpackPlugin` — exposes the aggregated `@layer cas` CSS
 * as a webpack-virtual module at the stable path
 * `node_modules/@cassida/next-plugin/virtual.css`. The consumer
 * imports `'@cassida/next-plugin/virtual.css'` from `app/layout.tsx`
 * (or any Server / Client Component) and Next.js's standard CSS
 * pipeline handles the file like any other CSS import — bundling,
 * minification, chunking, and HMR all come along for free.
 *
 * Resolves the "consumer imports virtual module BEFORE the IR
 * loader populates the store" race in two passes per compilation:
 *
 *   1. `compiler.hooks.thisCompilation` — seed the placeholder so
 *      the resolver finds the module when the graph is being built.
 *   2. `compilation.hooks.processAssets` at
 *      `PROCESS_ASSETS_STAGE_PRE_PROCESS` — every JSX file has
 *      already passed through the `enforce: 'post'` IR loader by
 *      this stage, so `store.allRules()` is complete; we drain the
 *      store via `buildVirtualCss(...)` and overwrite the virtual
 *      content BEFORE CSS minimisers / chunkers run.
 *
 * Multi-compiler architecture (Next.js App Router runs Server +
 * Client + Edge compilers in parallel):
 *
 *   The store is intentionally a singleton across the whole webpack
 *   process so Server-Component-only `cas()` chains — which compile
 *   exclusively in the Server compiler — still reach the *Client*
 *   compiler's `virtual.css`. The browser receives RSC-serialised
 *   `<aside className="cas-XXXXXXXX">` markup whose CSS rule only
 *   exists in the Server namespace; without the bridge, the Client
 *   bundle ships unstyled markup.
 *
 *   Each compiler still owns its own namespace inside the store
 *   (Next.js sets `compiler.options.name`); the `beforeRun` /
 *   `watchRun` hooks below clear *only* that compiler's namespace so
 *   stale rules from a between-build edit don't pile up across HMR
 *   passes. The OTHER compiler's namespace is preserved across these
 *   clears — that's the bridge surviving its independent lifecycle.
 *
 * For dev / HMR: a between-compilation store update (rare, usually
 * from an external watcher) re-writes the virtual module's content
 * the next time a compilation fires; Next.js's CSS HMR picks the
 * file-change event up.
 */

import { fileURLToPath } from 'node:url';

import VirtualModulesPlugin from 'webpack-virtual-modules';

import {
  allRules,
  allRulesForCompiler,
  clearCompilerNamespace,
  knownCompilerNames,
  lastWrittenAtForCompiler,
} from './store.js';
import {
  buildVirtualCss,
  type VirtualCssOptions,
} from './virtual-css.js';

/**
 * Absolute physical path of the `virtual.css` shipped in this
 * package. Webpack resolves symlinks to their real on-disk paths
 * (pnpm workspaces, yarn link, hoisted node_modules), so the path
 * we register the virtual module under must match the resolved
 * path the consumer's import ends at — using a hard-coded
 * `node_modules/...` relative path would miss the symlink case
 * and the consumer's import would fall through to the on-disk
 * fallback content instead of the live aggregated CSS.
 *
 * `import.meta.url` is the published `dist/webpack-plugin.js`
 * location at runtime; `virtual.css` sits one directory up
 * (package root) per `packages/next-plugin/package.json:files`.
 */
const VIRTUAL_MODULE_PATH = fileURLToPath(
  new URL('../virtual.css', import.meta.url),
);

/** Placeholder content the early-graph resolver lands on. Replaced
 * in `processAssets`; only visible if the build crashes before that
 * hook fires (or the consumer imports without any `cas()` chains
 * in the graph). */
const PLACEHOLDER_CONTENT = '/* cassida virtual — populated post-build */\n';

export class CassidaWebpackPlugin {
  constructor(private readonly options: VirtualCssOptions = {}) {}

  apply(compiler: WebpackCompiler): void {
    const virtual = new VirtualModulesPlugin({
      [VIRTUAL_MODULE_PATH]: PLACEHOLDER_CONTENT,
    });
    virtual.apply(compiler as unknown as Parameters<typeof virtual.apply>[0]);

    const compilerName = compiler.options?.name ?? null;

    // Clear THIS compiler's namespace before its loaders re-run.
    // Without this, `next dev`'s HMR loop accumulates stale rules
    // from since-deleted source files in this compiler — the IR
    // loader has no path to re-fire on a file that no longer
    // exists, so the rule never gets dropped otherwise. Crucially
    // we leave OTHER compilers' namespaces alone: the cross-
    // compiler bridge has to survive each compiler's independent
    // lifecycle (a Client rebuild must not wipe the Server-only
    // rules that back RSC-serialised classNames).
    const clearOwn = (): void => clearCompilerNamespace(compilerName);
    compiler.hooks.beforeRun?.tap?.('CassidaWebpackPlugin', clearOwn);
    compiler.hooks.watchRun?.tap?.('CassidaWebpackPlugin', clearOwn);

    // Single source of truth: rewrite the virtual module's content
    // exactly once per compilation, at `processAssets` stage
    // `PRE_PROCESS` (`-1000`). All IR-loader passes for this
    // compilation have completed by this stage, so `store.allRules()`
    // is complete across every namespace — the merge in `allRules()`
    // is what carries Server-only rules into the Client bundle.
    compiler.hooks.thisCompilation.tap(
      'CassidaWebpackPlugin',
      (compilation) => {
        const { Compilation } = (compilation.compiler as { webpack: WebpackRuntime }).webpack;
        compilation.hooks.processAssets.tap(
          {
            name: 'CassidaWebpackPlugin',
            stage: Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
          },
          () => {
            const seen = Array.from(allRules());
            const content =
              seen.length === 0
                ? PLACEHOLDER_CONTENT
                : buildVirtualCss(this.options);
            virtual.writeModule(VIRTUAL_MODULE_PATH, content);

            // Real race detection. The v0.8.0 heads-up triggered
            // when `seen.length === 0`, which produces false
            // positives on legitimately empty fixtures (test apps,
            // pages with no cas() chains). The actual race signature
            // is: ANOTHER compiler has written rules into its
            // namespace before mine fired, but my graph didn't see
            // any of its work flow back through the bridge — i.e.
            // its lastWrittenAt is recent and non-null, yet I'm
            // reading zero rules from its namespace because its
            // namespace was cleared between its write and my read.
            //
            // In practice Next.js sequences its Server / Client
            // compilations enough that the race is rare; the probe
            // is here so when it does fire we get a precise signal
            // instead of the previous best-effort heuristic.
            if (
              process.env.NODE_ENV === 'production' &&
              !process.env.CASSIDA_QUIET_RACE_WARNING
            ) {
              const stale = detectStaleBridge(compilerName);
              if (stale !== null) {
                process.stderr.write(
                  '[cassida] CassidaWebpackPlugin: detected cross-compiler ' +
                    `bridge gap — compiler '${stale.peer}' last wrote rules ` +
                    `at ${new Date(stale.peerWrittenAt).toISOString()} but ` +
                    `compiler '${stale.self}' read zero rules from its ` +
                    'namespace at processAssets. Server-only styles may not ' +
                    'reach the bundle. Set CASSIDA_QUIET_RACE_WARNING=1 to ' +
                    'silence.\n',
                );
              }
            }
          },
        );
      },
    );
  }
}

interface StaleBridgeReport {
  readonly self: string;
  readonly peer: string;
  readonly peerWrittenAt: number;
}

/**
 * Walk every known namespace looking for a peer compiler that
 * recently wrote rules but currently has none in the store. That's
 * the cross-compiler race: peer wrote, peer's namespace got cleared,
 * we read zero. Returns the first peer that fits the pattern, or
 * `null` if everything checks out.
 *
 * Self's own namespace is excluded — if we wrote zero rules that's
 * a legitimately empty source set, not a race.
 */
function detectStaleBridge(
  selfName: string | null,
): StaleBridgeReport | null {
  const selfKey = selfName ?? '__cassida_default__';
  for (const peer of knownCompilerNames()) {
    if (peer === selfKey) continue;
    const peerWrittenAt = lastWrittenAtForCompiler(peer);
    if (peerWrittenAt === null) continue;
    const peerRuleCount = countIterable(allRulesForCompiler(peer));
    if (peerRuleCount === 0) {
      return { self: selfKey, peer, peerWrittenAt };
    }
  }
  return null;
}

function countIterable<T>(it: Iterable<T>): number {
  let n = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of it) n++;
  return n;
}

// Structural subset of `webpack.Compiler` — full webpack types are
// pulled by Next.js at the consumer side; inlining what we touch
// keeps `@cassida/next-plugin` free of a hard `webpack` dep.
interface WebpackCompiler {
  readonly options?: { readonly name?: string };
  readonly hooks: {
    readonly thisCompilation: WebpackSyncHook<[WebpackCompilation]>;
    readonly beforeRun?: WebpackSyncHook<[WebpackCompiler]>;
    readonly watchRun?: WebpackSyncHook<[WebpackCompiler]>;
  };
}

interface WebpackCompilation {
  readonly compiler: { webpack: WebpackRuntime };
  readonly hooks: {
    readonly processAssets: WebpackHook<{ name: string; stage: number }, []>;
  };
}

interface WebpackRuntime {
  readonly Compilation: { readonly PROCESS_ASSETS_STAGE_PRE_PROCESS: number };
}

interface WebpackSyncHook<TArgs extends readonly unknown[]> {
  tap(name: string, fn: (...args: TArgs) => void): void;
}

interface WebpackHook<TTap, TArgs extends readonly unknown[]> {
  tap(tap: string | TTap, fn: (...args: TArgs) => void): void;
}
