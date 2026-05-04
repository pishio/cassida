import { compile, middleware, serialize, stringify } from 'stylis';
import type {
  CompiledRule,
  DynamicSlot,
  PropertyBag,
  Scope,
  ScopeBag,
} from './types.js';

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
 * Cross-call dedup: identical canonical bags produce the same className
 * and the rule is stored once. A different canonical mapping to the
 * same className surfaces as a hash collision error.
 *
 * Emission walks each stored `ScopeBag` tree, builds a nested CSS
 * string with `&` for parent-relative selectors, then runs the whole
 * thing through stylis to flatten — stylis natively handles nested
 * `:hover` / `@media` and rule hoisting, so we never write a flattener
 * ourselves.
 *
 * `@property` rules accumulate alongside class rules (deduplicated by
 * var name) and are emitted *outside* the `@layer` wrap, because
 * `@property` is invalid inside a `@layer` block.
 */
export class CssEmitter {
  private readonly rules = new Map<string, ScopeBag>();
  private readonly seen = new Map<string, string>();
  private readonly properties = new Map<string, string>();
  private readonly options: CssEmitterOptions;

  constructor(options: CssEmitterOptions = {}) {
    this.options = options;
  }

  add(rule: CompiledRule): string {
    const { className, canonical, tree, dynamics } = rule;
    const previous = this.seen.get(className);
    if (previous !== undefined && previous !== canonical) {
      throw new Error(
        `[fss] hash collision on "${className}":\n  prev: ${previous}\n  curr: ${canonical}`,
      );
    }
    this.seen.set(className, canonical);
    if (!this.rules.has(className)) {
      this.rules.set(className, tree);
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

    const nestedRules: string[] = [];
    for (const [className, tree] of this.rules.entries()) {
      const nested = treeToNestedCss(className, tree);
      if (nested !== null) nestedRules.push(nested);
    }

    if (nestedRules.length === 0) return propertyBlocks;

    const flat = serialize(compile(nestedRules.join('')), middleware([stringify]));

    const layerBlock =
      this.options.layer === null
        ? flat
        : `@layer ${this.options.layer ?? 'fss'}{${flat}}`;

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

/**
 * Render the full rule (including nested scopes) as a nested CSS string
 * suitable for stylis input. The root node owns the `.<className>`
 * selector; child nodes use `&<pseudo>` or `@media <query>` and stylis
 * resolves them to flat top-level rules.
 *
 * Children are sorted: pseudo before media before raw, lexicographic
 * within each kind. This gives deterministic output and keeps state
 * rules adjacent to the base in the flat result.
 */
function treeToNestedCss(className: string, tree: ScopeBag): string | null {
  const decls = formatDeclarations(tree.bag);
  const childRules = sortedChildren(tree.children).map(childToNestedCss).filter((s): s is string => s !== null);

  if (decls === '' && childRules.length === 0) return null;

  const declsTerminated = decls === '' ? '' : decls + ';';
  return `.${className}{${declsTerminated}${childRules.join('')}}`;
}

function childToNestedCss(node: ScopeBag): string | null {
  if (node.scope === null) return null;

  const decls = formatDeclarations(node.bag);
  const grandchildren = sortedChildren(node.children)
    .map(childToNestedCss)
    .filter((s): s is string => s !== null);

  if (decls === '' && grandchildren.length === 0) return null;

  const declsTerminated = decls === '' ? '' : decls + ';';
  const inner = declsTerminated + grandchildren.join('');

  if (node.scope.kind === 'pseudo' || node.scope.kind === 'raw') {
    return `&${node.scope.selector}{${inner}}`;
  }
  return `@media ${node.scope.query}{${inner}}`;
}

function sortedChildren(children: readonly ScopeBag[]): ScopeBag[] {
  return [...children].sort((a, b) =>
    scopeEmitOrderKey(a.scope!).localeCompare(scopeEmitOrderKey(b.scope!)),
  );
}

function scopeEmitOrderKey(scope: Scope): string {
  if (scope.kind === 'pseudo') return `0${scope.selector}`;
  if (scope.kind === 'media') return `1${scope.query}`;
  return `2${scope.selector}`;
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
