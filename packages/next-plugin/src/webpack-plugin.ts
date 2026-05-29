/**
 * `CassidaWebpackPlugin` — exposes the aggregated `@layer cas` CSS
 * as a webpack-virtual module at the stable path
 * `node_modules/@cassida/next-plugin/virtual.css`. The consumer
 * imports `'@cassida/next-plugin/virtual.css'` from `app/layout.tsx`
 * (or any Server / Client Component) and Next.js's standard CSS
 * pipeline handles the file like any other CSS import — bundling,
 * minification, chunking, and HMR all come along for free.
 *
 * # Two passes per compilation
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
 * # Multi-compiler bridge (the important part)
 *
 * Next.js's App Router runs four parallel webpack compilers: Client,
 * Server, Edge, Middleware. `CassidaWebpackPlugin` is installed in
 * every one of them. The rule store (`./store.ts`) is a deliberate
 * module-singleton shared across all four — see that file's top
 * comment for the full rationale.
 *
 * The browser-facing stylesheet is whichever asset Next.js converts
 * into `<link rel="stylesheet" href="...static/css/...">`. Next.js
 * sources those links from the Client compiler's CSS assets. So when
 * the Client compiler's `processAssets` runs, `allRules()` returns
 * the UNION of rules registered by every compiler — including
 * Server-only Server Components that never entered the Client graph.
 * That's the bridge.
 *
 * # The empty-store case is normal
 *
 * `seen.length === 0` is NOT a race indicator. Real cases:
 *
 *   - Edge / Middleware compilers whose graphs only touch
 *     `middleware.ts` and contain no `cas()` chains at all.
 *   - The Client compiler in an app where every styled element is a
 *     Server Component (all rules registered by the Server compiler,
 *     none directly by Client). The bridge merges them on read, so
 *     this isn't actually empty by the time `processAssets` runs in
 *     practice, but a strictly-ordered scheduler could land Client
 *     ahead of Server. Even then the resulting `virtual.css` is
 *     empty in the Client bundle but Next.js's separate CSS pipeline
 *     still emits a stylesheet — and the next compilation (HMR /
 *     subsequent build pass) fills it.
 *   - Fixtures with no styling at all (the initial scaffolding case).
 *
 * A previous heuristic stderr warning gated on `seen.length === 0 &&
 * NODE_ENV === 'production'` is removed: it produced false positives
 * in every Edge / Middleware build and never caught a real failure
 * mode. Use `DEBUG=cassida:store` and `DEBUG=cassida:plugin` instead
 * to see the actual read / write sequence if you suspect a problem.
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

/**
 * DEBUG-namespace gate. See `store.ts` for the rationale on the
 * substring match. `DEBUG=cassida:*` enables both `cassida:store`
 * and `cassida:plugin`.
 */
function pluginTraceEnabled(): boolean {
  const dbg = process.env.DEBUG;
  return typeof dbg === 'string' && dbg.includes('cassida:plugin');
}

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
    // returns the cross-compiler union (see ./store.ts).
    //
    // We deliberately don't subscribe to store updates between
    // compilations — Next.js HMR kicks a fresh compilation on every
    // source edit anyway, so this hook covers dev too. A
    // subscription-driven write would also race with parallel
    // compilers mid-build.
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

            // Lightweight per-compilation trace. Compiler name is
            // structural-typed `string | undefined` because we don't
            // strong-type the Compiler interface; reading via `any`
            // cast keeps the trace path free of webpack types. Off
            // by default (zero overhead unless DEBUG matches).
            if (pluginTraceEnabled()) {
              const compilerName =
                (compiler as unknown as { options?: { name?: string } })
                  .options?.name ?? '<unnamed>';
              process.stderr.write(
                `[cassida:plugin] processAssets compiler=${compilerName} rules=${seen.length}\n`,
              );
            }
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
