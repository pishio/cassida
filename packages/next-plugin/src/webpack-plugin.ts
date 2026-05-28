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
 * For dev / HMR: `compiler.hooks.watchRun` subscribes to
 * `store.subscribe()`, so a between-compilation store update (rare,
 * usually from an external watcher) re-writes the virtual module's
 * content and `webpack-virtual-modules` propagates the change as a
 * file-change event through webpack's watcher. Next.js's CSS HMR
 * picks it up — no `module.hot.accept` needed on the consumer side.
 */

import { fileURLToPath } from 'node:url';

import VirtualModulesPlugin from 'webpack-virtual-modules';

import { allRules } from './store.js';
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

    // Single source of truth: rewrite the virtual module's content
    // exactly once per compilation, at `processAssets` stage
    // `PRE_PROCESS` (`-1000`). All IR-loader passes for this
    // compilation have completed by this stage, so `store.allRules()`
    // is complete. We deliberately don't subscribe to store updates
    // between compilations — in Next.js's parallel Server / Client
    // compilations the store is a shared singleton, and a
    // subscription-driven write would race with whichever compiler
    // is mid-build. The HMR loop kicks a fresh compilation on every
    // source edit anyway, so this hook covers dev too.
    //
    // Phase 1.x: the multi-compiler race remains — the Client
    // compiler's `processAssets` may fire before the Server
    // compiler's loaders have finished populating the store with
    // Server-only rules. Mitigation needs a webpack child-compiler
    // architecture and is out of scope for Phase 1.
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
          },
        );
      },
    );
  }
}

// Structural subset of `webpack.Compiler` — full webpack types are
// pulled by Next.js at the consumer side; inlining what we touch
// keeps `@cassida/next-plugin` free of a hard `webpack` dep.
interface WebpackCompiler {
  readonly hooks: {
    readonly thisCompilation: WebpackSyncHook<[WebpackCompilation]>;
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
