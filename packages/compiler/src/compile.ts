import type { Op, CompiledRule } from './types.js';
import type { Registry } from './registry.js';
import { Canonicalizer } from './canonicalizer.js';
import { hash, type HashOptions } from './hasher.js';

export interface CompileOptions extends HashOptions {
  readonly registry: Registry;
}

/**
 * Pure: an Op[] chain in, a deterministic CompiledRule out.
 * No I/O, no shared state. Cross-call deduplication is the emitter's job.
 */
export function compileOps(ops: readonly Op[], options: CompileOptions): CompiledRule {
  const canon = new Canonicalizer(options.registry);
  const bag = canon.collapse(ops);
  const canonical = canon.canonicalKey(bag);
  const className = hash(canonical, options);
  return { className, bag, canonical };
}
