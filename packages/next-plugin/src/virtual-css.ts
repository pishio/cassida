/**
 * Aggregates every `CompiledRule` registered against a single webpack
 * `Compiler` into a CSS bundle. Called from `CassidaWebpackPlugin`
 * at `processAssets` time, once per compilation; the `compiler` key
 * (parent of the compilation) keeps Server-compiler and
 * Client-compiler bundles strictly separate so they can't race.
 */

import { CssEmitter, type CssEmitterOptions } from '@cassida/compiler';

import { allRules } from './store.js';

export interface VirtualCssOptions extends CssEmitterOptions {}

/**
 * Build the current CSS bundle as a single string by walking the
 * `compiler`'s file → rules bag. The emitter's internal dedup
 * means duplicate canonical bags don't double-write even if the
 * same chain appears in many files.
 */
export function buildVirtualCss(
  compiler: object,
  options: VirtualCssOptions = {},
): string {
  const emitter = new CssEmitter(options);
  for (const rule of allRules(compiler)) emitter.add(rule);
  return emitter.emit();
}
