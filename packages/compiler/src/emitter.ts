import { compile, middleware, serialize, stringify } from 'stylis';
import type { MediaSort } from './config.js';
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
  /**
   * Media-query ordering policy. See `MediaSort` for the cascade
   * semantics each direction implies. Defaults to `'mobile-first'`.
   */
  readonly mediaSort?: MediaSort;
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
 * `:hover` / `@media` and rule hoisting.
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
        `[cassida] hash collision on "${className}":\n  prev: ${previous}\n  curr: ${canonical}`,
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

    const sortMode: MediaSort = this.options.mediaSort ?? 'mobile-first';
    const nestedRules: string[] = [];
    for (const [className, tree] of this.rules.entries()) {
      const nested = treeToNestedCss(className, tree, sortMode);
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

function treeToNestedCss(
  className: string,
  tree: ScopeBag,
  sort: MediaSort,
): string | null {
  const decls = formatDeclarations(tree.bag);
  const childRules = sortedChildren(tree.children, sort)
    .map((c) => childToNestedCss(c, sort))
    .filter((s): s is string => s !== null);

  if (decls === '' && childRules.length === 0) return null;

  const declsTerminated = decls === '' ? '' : decls + ';';
  return `.${className}{${declsTerminated}${childRules.join('')}}`;
}

function childToNestedCss(node: ScopeBag, sort: MediaSort): string | null {
  if (node.scope === null) return null;

  const decls = formatDeclarations(node.bag);
  const grandchildren = sortedChildren(node.children, sort)
    .map((c) => childToNestedCss(c, sort))
    .filter((s): s is string => s !== null);

  if (decls === '' && grandchildren.length === 0) return null;

  const declsTerminated = decls === '' ? '' : decls + ';';
  const inner = declsTerminated + grandchildren.join('');

  if (node.scope.kind === 'pseudo' || node.scope.kind === 'raw') {
    return `&${node.scope.selector}{${inner}}`;
  }
  return `@media ${node.scope.query}{${inner}}`;
}

function sortedChildren(
  children: readonly ScopeBag[],
  sort: MediaSort,
): ScopeBag[] {
  return [...children].sort((a, b) => compareScopes(a.scope!, b.scope!, sort));
}

const BUCKET_PSEUDO = 0;
const BUCKET_MEDIA_MIN_WIDTH = 1;
const BUCKET_MEDIA_MAX_WIDTH = 2;
const BUCKET_MEDIA_OTHER = 3;
const BUCKET_RAW = 4;

function scopeBucket(scope: Scope): number {
  if (scope.kind === 'pseudo') return BUCKET_PSEUDO;
  if (scope.kind === 'raw') return BUCKET_RAW;
  if (parseMinWidth(scope.query) !== null) return BUCKET_MEDIA_MIN_WIDTH;
  if (parseMaxWidth(scope.query) !== null) return BUCKET_MEDIA_MAX_WIDTH;
  return BUCKET_MEDIA_OTHER;
}

function compareScopes(a: Scope, b: Scope, sort: MediaSort): number {
  const ab = scopeBucket(a);
  const bb = scopeBucket(b);
  if (ab !== bb) return ab - bb;

  if (a.kind === 'pseudo' && b.kind === 'pseudo') {
    return a.selector.localeCompare(b.selector);
  }
  if (a.kind === 'raw' && b.kind === 'raw') {
    return a.selector.localeCompare(b.selector);
  }
  if (a.kind === 'media' && b.kind === 'media') {
    if (ab === BUCKET_MEDIA_MIN_WIDTH) {
      const an = parseMinWidth(a.query)!;
      const bn = parseMinWidth(b.query)!;
      return sort === 'mobile-first' ? an - bn : bn - an;
    }
    if (ab === BUCKET_MEDIA_MAX_WIDTH) {
      const an = parseMaxWidth(a.query)!;
      const bn = parseMaxWidth(b.query)!;
      // mobile-first: larger max-width first (small overrides large via cascade)
      return sort === 'mobile-first' ? bn - an : an - bn;
    }
    return a.query.localeCompare(b.query);
  }
  return 0;
}

/**
 * Extracts the numeric value (in CSS px) for a `min-width` or `max-width`
 * predicate. Supports `px`, `em`, `rem`. `em`/`rem` are normalized at
 * 16 px so they sort sensibly relative to px values. Returns `null`
 * when the predicate is absent or its value can't be parsed.
 */
function parseMinWidth(query: string): number | null {
  return parseWidth(query, /min-width:\s*([\d.]+)\s*(px|em|rem)?/i);
}

function parseMaxWidth(query: string): number | null {
  return parseWidth(query, /max-width:\s*([\d.]+)\s*(px|em|rem)?/i);
}

function parseWidth(query: string, re: RegExp): number | null {
  const m = re.exec(query);
  if (!m) return null;
  const v = parseFloat(m[1]!);
  if (!Number.isFinite(v)) return null;
  const unit = m[2]?.toLowerCase() ?? 'px';
  if (unit === 'em' || unit === 'rem') return v * 16;
  return v;
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
 * initial-value (all three are required by the `@property` spec for
 * the descriptor to be useful).
 */
function formatPropertyBlock(slot: DynamicSlot): string | null {
  if (!slot.animatable) return null;
  if (slot.syntax === undefined || slot.initialValue === undefined) return null;
  const inherits = 'false';
  return `@property ${slot.varName}{syntax:"${slot.syntax}";inherits:${inherits};initial-value:${slot.initialValue};}`;
}
