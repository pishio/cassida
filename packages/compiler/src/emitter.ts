import type { CompiledRule, DynamicSlot, PropertyBag } from './types.js';

export interface CssEmitterOptions {
  /**
   * `@layer` name for the wrapping cascade layer.
   *   - omitted / undefined → `'fss'`
   *   - explicit `null`     → no `@layer` wrap (rules are emitted bare)
   */
  readonly layer?: string | null;
}

/**
 * Stateful collector for compiled rules.
 *
 * Cross-call dedup happens here: identical canonical bags produce the
 * same `className` and the rule is stored once. A different canonical
 * mapping to the same className surfaces as a hash collision error.
 *
 * `@property` rules accumulate alongside class rules: every animatable
 * dynamic slot contributes one `@property` block, deduplicated by var
 * name. They are emitted *outside* the `@layer` wrap because `@property`
 * is invalid inside a `@layer` block.
 */
export class CssEmitter {
  private readonly rules = new Map<string, string>();
  private readonly seen = new Map<string, string>();
  private readonly properties = new Map<string, string>(); // varName → @property rule body
  private readonly options: CssEmitterOptions;

  constructor(options: CssEmitterOptions = {}) {
    this.options = options;
  }

  add(rule: CompiledRule): string {
    const { className, canonical, bag, dynamics } = rule;
    const previous = this.seen.get(className);
    if (previous !== undefined && previous !== canonical) {
      throw new Error(
        `[fss] hash collision on "${className}":\n  prev: ${previous}\n  curr: ${canonical}`,
      );
    }
    this.seen.set(className, canonical);
    if (!this.rules.has(className)) {
      this.rules.set(className, formatDeclarations(bag));
    }
    for (const slot of dynamics) {
      const block = formatPropertyBlock(slot);
      if (block !== null && !this.properties.has(slot.varName)) {
        this.properties.set(slot.varName, block);
      }
    }
    return className;
  }

  emit(): string {
    if (this.rules.size === 0 && this.properties.size === 0) return '';

    const propertyBlocks = [...this.properties.values()].join('');

    if (this.rules.size === 0) {
      return propertyBlocks;
    }

    const ruleBody = [...this.rules.entries()]
      .map(([cls, decl]) => `.${cls}{${decl}}`)
      .join('');

    const layerBlock =
      this.options.layer === null
        ? ruleBody
        : `@layer ${this.options.layer ?? 'fss'}{${ruleBody}}`;

    return propertyBlocks + layerBlock;
  }

  classNames(): readonly string[] {
    return [...this.rules.keys()];
  }

  size(): number {
    return this.rules.size;
  }

  propertyCount(): number {
    return this.properties.size;
  }
}

function formatDeclarations(bag: PropertyBag): string {
  return Object.keys(bag)
    .sort()
    .map((k) => `${k}:${bag[k]!}`)
    .join(';');
}

/**
 * Returns the `@property` block string for a dynamic slot, or `null` if
 * the slot is non-animatable, has no syntax descriptor, or has no
 * initial-value (all three are required by the `@property` spec for the
 * descriptor to be useful).
 */
function formatPropertyBlock(slot: DynamicSlot): string | null {
  if (!slot.animatable) return null;
  if (slot.syntax === undefined || slot.initialValue === undefined) return null;
  const inherits = 'false';
  return `@property ${slot.varName}{syntax:"${slot.syntax}";inherits:${inherits};initial-value:${slot.initialValue};}`;
}
