import type { Op, PropertyBag } from './types.js';
import type { Registry } from './registry.js';

/**
 * Walks an Op[] chain in order; later writes overwrite earlier ones (LIFO collapse).
 * The output bag is then canonicalized into a deterministic string key for hashing,
 * so that semantically identical inputs always produce the same hash regardless
 * of the call sequence that built them.
 */
export class Canonicalizer {
  constructor(private readonly registry: Registry) {}

  collapse(ops: readonly Op[]): PropertyBag {
    const bag: Record<string, string> = {};
    for (const op of ops) {
      const entry = this.registry[op.method];
      if (!entry) {
        throw new Error(
          `[fss] unknown method "${op.method}". Add it to the registry or check for typos.`,
        );
      }
      bag[entry.property] = entry.format(...op.args);
    }
    return bag;
  }

  canonicalKey(bag: PropertyBag): string {
    const keys = Object.keys(bag).sort();
    const pairs = keys.map((k) => [k, bag[k]!] as const);
    return JSON.stringify(pairs);
  }
}
