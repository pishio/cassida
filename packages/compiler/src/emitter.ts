import type { CompiledRule, PropertyBag } from './types.js';

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
 * mapping to the same className surfaces as a hash collision error
 * (this should be vanishingly rare with 32-bit hex, but loud > silent).
 */
export class CssEmitter {
  private readonly rules = new Map<string, string>();
  private readonly seen = new Map<string, string>();
  private readonly options: CssEmitterOptions;

  constructor(options: CssEmitterOptions = {}) {
    this.options = options;
  }

  add(rule: CompiledRule): string {
    const { className, canonical, bag } = rule;
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
    return className;
  }

  emit(): string {
    if (this.rules.size === 0) return '';
    const body = [...this.rules.entries()]
      .map(([cls, decl]) => `.${cls}{${decl}}`)
      .join('');
    if (this.options.layer === null) return body;
    const layer = this.options.layer ?? 'fss';
    return `@layer ${layer}{${body}}`;
  }

  classNames(): readonly string[] {
    return [...this.rules.keys()];
  }

  size(): number {
    return this.rules.size;
  }
}

function formatDeclarations(bag: PropertyBag): string {
  return Object.keys(bag)
    .sort()
    .map((k) => `${k}:${bag[k]!}`)
    .join(';');
}
