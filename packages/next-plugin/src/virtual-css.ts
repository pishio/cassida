/**
 * Aggregates every `CompiledRule` currently registered in the store
 * into a single CSS bundle. The `withCassida()` wiring exposes this
 * as a virtual module so the Next.js consumer can
 * `import '@cassida/next-plugin/virtual.css'` (or the wrapper
 * injects it automatically into the app entry).
 */

import { CssEmitter, type CssEmitterOptions } from '@cassida/compiler';

import { allRules } from './store.js';

export interface VirtualCssOptions extends CssEmitterOptions {}

/**
 * Build the current CSS bundle as a single string. Walks every
 * compiled rule the loader has accumulated so far and feeds them
 * through `CssEmitter`. Re-running this on every webpack invalidation
 * is cheap — the emitter's internal dedup means rules don't double-
 * write even if multiple files register the same canonical bag.
 */
export function buildVirtualCss(options: VirtualCssOptions = {}): string {
  const emitter = new CssEmitter(options);
  for (const rule of allRules()) emitter.add(rule);
  return emitter.emit();
}
