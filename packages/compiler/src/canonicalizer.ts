import {
  DYNAMIC_PLACEHOLDER,
  isDynamic,
  type DynamicArg,
  type Op,
  type PropertyBag,
} from './types.js';
import type { Registry } from './registry.js';

/**
 * Result of LIFO-collapsing an `Op[]` chain.
 *
 * `bag` carries CSS-property keys mapped to either their formatted static
 * value or a `DYNAMIC_PLACEHOLDER` token (for dynamic ops). The placeholder
 * is positionless on purpose: two chains with the same property structure
 * but different dynamic source values share the same canonical key — and
 * therefore the same className, the same `@layer` rule, and the same CSS
 * variable name. Each call site supplies its own value via inline style.
 *
 * `slotByProperty` records, for every CSS property whose final (post-LIFO)
 * value is dynamic, the parser-supplied `sourceId` so `compileOps` can
 * stitch the slot back to the AST expression that produced it.
 */
export interface CollapsedChain {
  readonly bag: PropertyBag;
  readonly slotByProperty: Readonly<Record<string, string>>;
}

export class Canonicalizer {
  constructor(private readonly registry: Registry) {}

  collapse(ops: readonly Op[]): CollapsedChain {
    const bag: Record<string, string> = {};
    const slots: Record<string, string> = {};

    for (const op of ops) {
      const entry = this.registry[op.method];
      if (!entry) {
        throw new Error(
          `[fss] unknown method "${op.method}". Add it to the registry or check for typos.`,
        );
      }

      const dynamics = op.args.filter(isDynamic) as readonly DynamicArg[];

      if (dynamics.length === 0) {
        // All literal — format normally. A static write also clears any
        // dynamic slot for the same property left by an earlier op.
        bag[entry.property] = entry.format(...op.args);
        delete slots[entry.property];
        continue;
      }

      // Phase 1 limitation: only single-arg, fully-dynamic ops are
      // promoted to CSS variables. Mixed (literal + dynamic) and
      // multi-arg dynamic ops are not statically expressible without a
      // runtime call to the format function — the parser bails on these
      // before reaching the canonicalizer; this throw is defensive.
      if (op.args.length !== 1 || dynamics.length !== 1) {
        throw new Error(
          `[fss] mixed/multi-dynamic args are not supported in this phase; method "${op.method}"`,
        );
      }

      bag[entry.property] = DYNAMIC_PLACEHOLDER;
      slots[entry.property] = dynamics[0]!.id;
    }

    return { bag, slotByProperty: slots };
  }

  canonicalKey(bag: PropertyBag): string {
    const keys = Object.keys(bag).sort();
    const pairs = keys.map((k) => [k, bag[k]!] as const);
    return JSON.stringify(pairs);
  }
}
