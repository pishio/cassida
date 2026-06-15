import type { ResolvedCassConfig } from '@cassida/compiler';
import type { VirtualCssOptions } from './virtual-css.js';

/**
 * Assemble the `VirtualCssOptions` handed to `CassidaWebpackPlugin`
 * from the resolved config. Mirrors the fields `@cassida/vite-plugin`
 * passes to `CssEmitter` (`layer` / `mediaSort` / `mode`) plus the
 * `resolved` config the plugin needs for the lightningcss pass.
 *
 * Kept as a pure function (in its own module, not on the package's
 * public `exports` map) so the propagation is unit-testable without
 * standing up a webpack compilation — driving the real `withCassida`
 * webpack hook would eagerly resolve the IR-loader / wasm paths, which
 * is not feasible from a unit test.
 */
export function resolveWebpackPluginOptions(
  resolved: ResolvedCassConfig,
  layer: string | null,
): VirtualCssOptions {
  return {
    layer,
    mediaSort: resolved.media.sort,
    mode: resolved.css.mode,
    resolved,
  };
}
