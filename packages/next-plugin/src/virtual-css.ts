/**
 * Aggregates every `CompiledRule` currently registered in the store
 * into a single CSS bundle. The `withCassida()` wiring exposes this
 * as a virtual module so the Next.js consumer can
 * `import '@cassida/next-plugin/virtual.css'` (or the wrapper
 * injects it automatically into the app entry).
 */

import { CssEmitter, type CssEmitterOptions, type ResolvedCassConfig } from '@cassida/compiler';
import { postProcessLightningCss, type Targets } from '@cassida/compiler/internal';

import { allRules } from './store.js';

/**
 * Options for `buildVirtualCss`. The base `CssEmitterOptions`
 * (`layer`, `mediaSort`) control emit shape; the optional `resolved`
 * + `filename` + `targets` triple enables the lightningcss
 * post-processing pass when `resolved.css.lightningcss.enabled` is
 * true. When `resolved` is absent, lightningcss is skipped —
 * preserves backward compatibility for callers that only construct
 * a `VirtualCssOptions` with the basic emitter fields.
 */
export interface VirtualCssOptions extends CssEmitterOptions {
  readonly resolved?: ResolvedCassConfig;
  readonly filename?: string;
  readonly targets?: Targets | null;
}

/**
 * Build the current CSS bundle as a single string. Walks every
 * compiled rule the loader has accumulated so far and feeds them
 * through `CssEmitter`. Re-running this on every webpack invalidation
 * is cheap — the emitter's internal dedup means rules don't double-
 * write even if multiple files register the same canonical bag.
 *
 * When `resolved.css.lightningcss.enabled` is true and a `filename`
 * is supplied, the emitted CSS is post-processed by lightningcss for
 * vendor prefixing and (optional) minification. The `@layer cas`
 * wrapper and `@property` rules survive the pass; lightningcss 1.28+
 * understands both natively.
 */
export function buildVirtualCss(options: VirtualCssOptions = {}): string {
  const emitter = new CssEmitter(options);
  for (const rule of allRules()) emitter.add(rule);
  const css = emitter.emit();
  if (
    css === '' ||
    options.resolved === undefined ||
    options.filename === undefined ||
    !options.resolved.css.lightningcss.enabled
  ) {
    return css;
  }
  return postProcessLightningCss(css, options.filename, options.resolved, options.targets ?? null);
}
