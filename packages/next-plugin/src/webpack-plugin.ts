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

import { allRules, subscribe } from './store.js';
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

    // The IR loader calls `setRulesForFile` once per Cassida-bearing
    // module the graph visits. If we re-built and re-wrote the
    // virtual CSS on every one of those events, a project with N
    // styled files would see N redundant `buildVirtualCss()` calls
    // per compilation. `isCompiling` gates the subscription-driven
    // path so the active compilation does the single canonical
    // rewrite at `processAssets`; between-compilation updates (the
    // rare "external watcher edited a source" case) still fire
    // through the live subscription.
    let isCompiling = false;

    const writeFromStore = (force = false): void => {
      if (isCompiling && !force) return;
      // Build CSS only when there's something to emit; otherwise
      // keep the placeholder so a totally Cassida-free build still
      // resolves the import without surprises.
      const seen = Array.from(allRules());
      const content =
        seen.length === 0 ? PLACEHOLDER_CONTENT : buildVirtualCss(this.options);
      virtual.writeModule(VIRTUAL_MODULE_PATH, content);
    };

    compiler.hooks.compile.tap('CassidaWebpackPlugin', () => {
      isCompiling = true;
    });
    compiler.hooks.done.tap('CassidaWebpackPlugin', () => {
      isCompiling = false;
    });

    // Pass 1: per-compilation rewrite via `processAssets`. Stage
    // `PRE_PROCESS` (`-1000`) runs after all `module.build()` calls
    // finish but before CSS minimisers (`OPTIMIZE` = 100), HTML
    // emission, and asset hash finalisation. `force = true` here
    // bypasses the in-compilation guard — this is the canonical
    // rewrite of the compilation.
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
            writeFromStore(true);
          },
        );
      },
    );

    // Pass 2: dev HMR — between-compilation store updates re-write
    // the virtual content. The subscription lifecycle is anchored
    // on the watcher's run/close hooks so a `next dev` reload
    // doesn't leak listeners.
    let unsubscribe: (() => void) | undefined;
    compiler.hooks.watchRun.tap('CassidaWebpackPlugin', () => {
      unsubscribe?.();
      unsubscribe = subscribe(() => writeFromStore());
    });
    compiler.hooks.watchClose.tap('CassidaWebpackPlugin', () => {
      unsubscribe?.();
      unsubscribe = undefined;
    });
  }
}

// Structural subset of `webpack.Compiler` — full webpack types are
// pulled by Next.js at the consumer side; inlining what we touch
// keeps `@cassida/next-plugin` free of a hard `webpack` dep.
interface WebpackCompiler {
  readonly hooks: {
    readonly thisCompilation: WebpackSyncHook<[WebpackCompilation]>;
    readonly watchRun: WebpackSyncHook<[WebpackCompiler]>;
    readonly watchClose: WebpackSyncHook<[]>;
    readonly compile: WebpackSyncHook<[]>;
    readonly done: WebpackSyncHook<[unknown]>;
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
