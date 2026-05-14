import { canonicalSpec } from './property-spec.js';
import {
  generatedPropertySpecs,
  type GeneratedSpec,
} from './generated-property-specs.js';

/**
 * Multi-property formatters return a bag of `{ 'css-prop': 'value' }`
 * pairs. Each entry is written into the ScopeBag as if it were a
 * standalone declaration, so LIFO collapse works at the *property*
 * level — `px(8).paddingInlineStart(4)` ends up with
 * `padding-inline-start: 4px; padding-inline-end: 8px;` because the
 * px call wrote both halves and the explicit longhand then overrode
 * one of them.
 */
export type StyleBag = Readonly<Record<string, string>>;

export type Formatter = (...args: readonly unknown[]) => string | StyleBag;

export interface RegistryEntry {
  /**
   * Primary CSS property name. For single-property entries this is the
   * key the formatter's return value is bound to in the bag. For
   * multi-property entries (those with `properties` set), it's a label
   * — the formatter's StyleBag carries the actual writes. The label
   * still doubles as the lookup key for shorthand-policy family
   * metadata and as a stable name for diagnostics.
   */
  readonly property: string;
  /**
   * Longhands this entry expands to when invoked. Set on multi-property
   * entries like `px` (expands to `padding-inline-start` + `-end`).
   * Absent on single-property entries.
   *
   * Drives two behaviors in the canonicalizer:
   *   1. LIFO collapse: each named longhand is treated as an
   *      independent slot, so a later single-property write to one of
   *      them overrides just that half.
   *   2. Dynamic-arg bail: v1 does not support dynamic values on
   *      multi-property entries (one slot id can't span N longhands
   *      coherently). The canonicalizer throws with a hint.
   */
  readonly properties?: readonly string[];
  readonly format: Formatter;
  /**
   * Optional `@property` syntax descriptor. Stored as metadata only;
   * the emitter consults this when (and only when) a value gets promoted
   * to a CSS custom property (e.g. for a dynamic value or an animated one).
   * Static literal usages do not produce an `@property` rule.
   */
  readonly syntax?: string;
  readonly initialValue?: string;
  readonly inherits?: boolean;
  /**
   * Whether this property is a meaningful candidate for `@property`
   * emission *when its value is dynamic*. Continuous-interpolation
   * properties (lengths, colors, numbers) are typically true; enum-valued
   * properties (display, position, ...) are typically false.
   */
  readonly animatable?: boolean;
  /**
   * If this entry IS a CSS shorthand that covers a family of longhands,
   * the family identifier (e.g. `'padding'`, `'margin'`, `'inset'`).
   * Used by the Canonicalizer's `shorthand.policy` check to detect
   * shorthand ↔ longhand co-occurrence within a single scope.
   */
  readonly shorthandFamily?: string;
  /**
   * If this entry IS a longhand of a shorthand family, the family
   * identifier. Mirrors `shorthandFamily` from the other side.
   *
   * Multi-property entries (`px`, `py`, ...) can still set this — they
   * behave as a longhand-of-family with respect to the policy check
   * (`padding(...).px(...)` errors under strict policy just like
   * `padding(...).paddingLeft(...)` does).
   */
  readonly longhandFamily?: string;
}

export type Registry = Readonly<Record<string, RegistryEntry>>;
export type AliasMap = Readonly<Record<string, string>>;

/** Format function for entries derived from mdn-data. */
const passthroughFormat: Formatter = (v: unknown): string => {
  if (v === null || v === undefined) {
    throw new TypeError('[cassida] generated property received null/undefined value');
  }
  return String(v);
};

function buildGeneratedEntries(
  generated: Readonly<Record<string, GeneratedSpec>>,
): Registry {
  const out: Record<string, RegistryEntry> = {};
  for (const [name, spec] of Object.entries(generated)) {
    out[name] = {
      property: spec.property,
      format: passthroughFormat,
      animatable: spec.animatable,
      ...(spec.syntax !== undefined ? { syntax: spec.syntax } : {}),
      ...(spec.initialValue !== undefined ? { initialValue: spec.initialValue } : {}),
      ...(spec.inherits !== undefined ? { inherits: spec.inherits } : {}),
    };
  }
  return Object.freeze(out);
}

function buildHandCraftedEntries(
  spec: typeof canonicalSpec,
): Registry {
  const out: Record<string, RegistryEntry> = {};
  for (const [name, entry] of Object.entries(spec)) {
    const built: RegistryEntry = {
      property: entry.property,
      format: entry.format as unknown as Formatter,
      animatable: entry.animatable,
      ...('properties' in entry && entry.properties !== undefined
        ? { properties: entry.properties }
        : {}),
      ...('syntax' in entry && entry.syntax !== undefined ? { syntax: entry.syntax } : {}),
      ...('initialValue' in entry && entry.initialValue !== undefined
        ? { initialValue: entry.initialValue }
        : {}),
      ...('shorthandFamily' in entry && entry.shorthandFamily !== undefined
        ? { shorthandFamily: entry.shorthandFamily }
        : {}),
      ...('longhandFamily' in entry && entry.longhandFamily !== undefined
        ? { longhandFamily: entry.longhandFamily }
        : {}),
    };
    out[name] = built;
  }
  return Object.freeze(out);
}

/**
 * Canonical method set: hand-crafted entries (typed via csstype, with
 * family metadata for shorthand-policy) layered ON TOP OF the
 * generated mdn-data set. When a method exists in both, the
 * hand-crafted entry wins — its typed format function and family
 * metadata are preserved while the generated version contributes only
 * to the gap-filling.
 *
 * Result: every standard CSS property has a callable method, and the
 * curated subset retains its csstype-driven IDE autocomplete +
 * shorthand-policy guarding.
 */
const generatedEntries = buildGeneratedEntries(generatedPropertySpecs);
const handCraftedEntries = buildHandCraftedEntries(canonicalSpec);
export const defaultCanonicals: Registry = Object.freeze({
  ...generatedEntries,
  ...handCraftedEntries,
});

/**
 * Optional shorthands. Aliases are pure typing-sugar: each one resolves
 * to the *same RegistryEntry reference* as its canonical, so behavior is
 * identical and `mt(10).marginTop(20)` collapses correctly to a single
 * `margin-top` declaration via LIFO.
 */
/**
 * Optional shorthand aliases.
 *
 * Removed (intentionally absent): `background` and `font`. Both names
 * refer to *real* CSS shorthands (writing many subproperties at once
 * with implicit reset of the rest), and offering them as aliases for
 * `backgroundColor` / `fontFamily` would silently lie about CSS
 * semantics. Users wanting the actual CSS shorthand can route through
 * `fss.unsafe({ background: '...' })`.
 */
export const defaultAliases: AliasMap = Object.freeze({
  bg: 'backgroundColor',
  mt: 'marginTop',
  mr: 'marginRight',
  mb: 'marginBottom',
  ml: 'marginLeft',
  pt: 'paddingTop',
  pr: 'paddingRight',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
});

/**
 * Returns a frozen registry where every alias key points to the *same*
 * RegistryEntry reference as its canonical target.
 */
export function expandAliases(canonicals: Registry, aliases: AliasMap): Registry {
  const out: Record<string, RegistryEntry> = { ...canonicals };
  for (const [alias, target] of Object.entries(aliases)) {
    const entry = canonicals[target];
    if (!entry) {
      throw new Error(
        `[cassida] alias "${alias}" points to unknown canonical "${target}"`,
      );
    }
    if (alias in canonicals) {
      throw new Error(
        `[cassida] alias "${alias}" shadows a canonical method of the same name`,
      );
    }
    out[alias] = entry;
  }
  return Object.freeze(out);
}

/**
 * The runtime registry: canonicals + default aliases, flattened. Lookup
 * is O(1); aliases and canonicals are indistinguishable at the point of
 * use. Use `defaultCanonicals` and `defaultAliases` directly if you need
 * to know which is which (docs, codegen, etc.).
 */
export const defaultRegistry: Registry = expandAliases(defaultCanonicals, defaultAliases);

/**
 * Returns a frozen registry that overlays `additions` on top of `base`.
 * Later additions win on key conflict.
 */
export function extendRegistry(base: Registry, additions: Registry): Registry {
  return Object.freeze({ ...base, ...additions });
}
