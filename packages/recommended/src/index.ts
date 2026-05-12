import hoverFix, {
  type HoverFixOptions,
} from '@cassida/plugin-hover-fix';
import {
  conditionalSpread,
  type ConditionalSpreadOptions,
} from '@cassida/plugin-conditional';
import type { CassPlugin } from '@cassida/compiler';
import type { CassParserPlugin } from '@cassida/parser';

/**
 * Per-plugin options. `false` disables the plugin entirely; an
 * options object passes through to the plugin's own factory.
 * Omitting a field opts into the plugin with default options.
 */
export interface RecommendedOptions {
  readonly hoverFix?: false | HoverFixOptions;
  readonly conditional?: false | ConditionalSpreadOptions;
}

/**
 * Return value: the curated bundle of CSS-level and AST-level
 * plugins, ready to spread into `cassida(...)` options.
 *
 * Shape matches what `@cassida/vite-plugin` expects so callers can
 * splat it directly:
 *
 *   ```ts
 *   cassida(recommended())
 *   cassida({ ...recommended(), include: /\.[jt]sx$/ })
 *   ```
 */
export interface RecommendedBundle {
  readonly plugins: readonly CassPlugin[];
  readonly parserPlugins: readonly CassParserPlugin[];
}

/**
 * Curated bundle of Cassida plugins. The maintainers' default-on
 * set:
 *
 *   - `@cassida/plugin-hover-fix` — wraps `:hover` scopes in
 *     `@media (hover: hover)` so iOS Safari doesn't get stuck on
 *     touch-triggered hovers
 *   - `@cassida/plugin-conditional` — lifts
 *     `{...(cond ? cas().X() : cas().Y())}` and
 *     `{...(cond && cas().X())}` spreads from runtime fallback
 *     into the build-time class table
 *
 * Each plugin can be disabled or reconfigured via `options`:
 *
 *   ```ts
 *   recommended()                            // both enabled, default config
 *   recommended({ hoverFix: false })         // only conditional
 *   recommended({ conditional: { shortCircuit: false } })  // tweak one
 *   ```
 *
 * Plugin sets are versioned alongside `@cassida/recommended` itself,
 * so upgrading the bundle is a single dep bump — no need to track
 * each plugin's release separately.
 */
export function recommended(options: RecommendedOptions = {}): RecommendedBundle {
  const plugins: CassPlugin[] = [];
  const parserPlugins: CassParserPlugin[] = [];

  if (options.hoverFix !== false) {
    // `|| {}` instead of `typeof === 'object'` — `typeof null` is
    // `'object'` in JS, so the type-guard form would pass `null`
    // straight into the factory and crash on property access.
    plugins.push(hoverFix(options.hoverFix || {}));
  }
  if (options.conditional !== false) {
    parserPlugins.push(conditionalSpread(options.conditional || {}));
  }

  return { plugins, parserPlugins };
}

// Re-export the individual factories so users can compose their own
// bundles when they want a non-default set without dropping back to
// importing each plugin package by hand.
export { hoverFix, conditionalSpread };
export type { HoverFixOptions, ConditionalSpreadOptions };
