import browserslist from 'browserslist';
import { browserslistToTargets, transform as lightningTransform } from 'lightningcss';
import type { Targets } from 'lightningcss';
import type { ResolvedCassConfig } from './config.js';

/**
 * Re-exported lightningcss `Targets` so callers don't need to pin
 * lightningcss themselves to type a value coming out of `resolveTargets`.
 */
export type { Targets } from 'lightningcss';

/**
 * Run the emitted CSS through lightningcss for vendor-prefixing and
 * optional minification.
 *
 * `@property` rules are preserved through this pass — lightningcss
 * supports the Houdini descriptor natively. We additionally split the
 * input so emitter-emitted property declarations are processed in the
 * same pass as the `@layer` block; they share a single document.
 *
 * Lives in `@cassida/compiler/internal` (this file) so the vite-plugin
 * and next-plugin can share the implementation without each pinning
 * lightningcss independently. `lightningcss` is an optional peer
 * dependency of `@cassida/compiler`; callers are expected to install
 * it themselves.
 */
export function postProcessLightningCss(
  css: string,
  filename: string,
  resolved: ResolvedCassConfig,
  targets: Targets | null,
): string {
  const result = lightningTransform({
    filename,
    code: Buffer.from(css, 'utf-8'),
    minify: resolved.css.lightningcss.minify,
    ...(targets ? { targets } : {}),
  });
  return Buffer.from(result.code).toString('utf-8');
}

/**
 * Resolve a `Targets` object from the user's config, or fall back to
 * auto-discovering a browserslist query from the project root
 * (`.browserslistrc`, `package.json#browserslist`, or environment
 * defaults). Returning `null` lets lightningcss apply its own default.
 *
 * The `'defaults'` literal in `defaultConfig` is treated as "no
 * explicit override given, please auto-discover" — only when the user
 * actually puts a different string in the config (or the auto-
 * discovery picks up a project file) do we set explicit targets.
 *
 * `browserslist` is an optional peer dependency of `@cassida/compiler`;
 * if the auto-discovery throws (no project file, no environment
 * defaults) we swallow the error and return `null`.
 */
export function resolveTargets(configTargets: string, root: string): Targets | null {
  if (configTargets !== 'defaults') {
    const queries = browserslist(configTargets);
    return browserslistToTargets(queries);
  }
  try {
    const queries = browserslist(undefined, { path: root });
    if (queries.length === 0) return null;
    return browserslistToTargets(queries);
  } catch {
    return null;
  }
}
