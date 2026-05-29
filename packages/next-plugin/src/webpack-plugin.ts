/**
 * `CassidaWebpackPlugin` — exposes the aggregated `@layer cas` CSS
 * as a webpack-virtual module at the stable physical path of the
 * package's `virtual.css`. The consumer imports
 * `'@cassida/next-plugin/virtual.css'` from `app/layout.tsx` (or any
 * Server / Client Component) and Next.js's standard CSS pipeline
 * handles bundling, minification, chunking, and HMR.
 *
 * Lifecycle per compilation:
 *
 *   1. `compiler.hooks.thisCompilation` — seed the placeholder so
 *      the module resolver finds the virtual.css module when the
 *      graph is being built (the consumer's import resolves before
 *      any IR-loader pass has populated the store).
 *   2. `compilation.hooks.processAssets` at
 *      `PROCESS_ASSETS_STAGE_PRE_PROCESS` — every JSX file has
 *      passed through the `enforce: 'post'` IR loader by this stage
 *      and the loader has written this compilation's rules to its
 *      per-compilation bag. We drain that bag via
 *      `buildVirtualCss(compilation, ...)` and overwrite the
 *      virtual content before CSS minifiers / chunkers run.
 *
 * Multi-compiler safety: in Next.js's parallel Server / Client
 * compilations the per-compilation `Compilation` object keys the
 * store, so Server- and Client-compiler writes never collide and
 * the previous v0.8.0 race (Client `processAssets` firing before
 * Server loaders complete) is structurally impossible. Each
 * compilation only sees rules written by its own loader passes.
 *
 * The v0.8.0 `CASSIDA_QUIET_RACE_WARNING` env var is now a no-op —
 * the race telemetry it muted no longer fires.
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
            const seen = Array.from(allRules(compilation));
            const content =
              seen.length === 0
                ? PLACEHOLDER_CONTENT
                : buildVirtualCss(compilation, this.options);
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
