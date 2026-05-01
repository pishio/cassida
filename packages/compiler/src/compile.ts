import {
  DYNAMIC_PLACEHOLDER,
  type CompiledRule,
  type DynamicSlot,
  type Op,
} from './types.js';
import type { Registry } from './registry.js';
import { Canonicalizer } from './canonicalizer.js';
import { hash, type HashOptions } from './hasher.js';
import { defaultPropertyMeta, type PropertyMeta } from './property-spec.js';

export interface CompileOptions extends HashOptions {
  readonly registry: Registry;
  /**
   * Override the property → metadata table used to enrich dynamic slots
   * with `animatable` / `syntax` / `initialValue`. Defaults to the
   * canonical spec's own metadata; only override when extending the
   * registry with custom properties that need their own `@property`
   * descriptors.
   */
  readonly propertyMeta?: Readonly<Record<string, PropertyMeta>>;
}

/**
 * Pure: an `Op[]` chain in, a deterministic `CompiledRule` out.
 * No I/O, no shared state. Cross-call deduplication is the emitter's job.
 *
 * For dynamic chains, the canonical key uses placeholders rather than
 * concrete values, so the resulting `className` depends only on the
 * *shape* of the bag. Each dynamic slot lands in `dynamics` with a fresh
 * `--<className>-<prop>` variable name; the parser uses these to populate
 * the element's inline style.
 */
export function compileOps(ops: readonly Op[], options: CompileOptions): CompiledRule {
  const canon = new Canonicalizer(options.registry);
  const { bag: rawBag, slotByProperty } = canon.collapse(ops);
  const canonical = canon.canonicalKey(rawBag);
  const className = hash(canonical, options);

  const meta = options.propertyMeta ?? defaultPropertyMeta;

  const emitBag: Record<string, string> = {};
  const dynamics: DynamicSlot[] = [];

  for (const prop of Object.keys(rawBag).sort()) {
    const val = rawBag[prop]!;
    if (val === DYNAMIC_PLACEHOLDER) {
      const varName = `--${className}-${prop}`;
      emitBag[prop] = `var(${varName})`;
      const m = meta[prop];
      dynamics.push({
        property: prop,
        varName,
        sourceId: slotByProperty[prop]!,
        animatable: m?.animatable ?? false,
        syntax: m?.syntax,
        initialValue: m?.initialValue,
      });
    } else {
      emitBag[prop] = val;
    }
  }

  return {
    className,
    bag: Object.freeze(emitBag),
    canonical,
    dynamics: Object.freeze(dynamics),
  };
}
