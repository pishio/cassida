import { canonicalSpec } from './property-spec.js';
import {
  generatedPropertySpecs,
  type GeneratedSpec,
} from './generated-property-specs.js';

export type Formatter = (...args: readonly unknown[]) => string;

export interface RegistryEntry {
  readonly property: string;
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
   */
  readonly longhandFamily?: string;
}

export type Registry = Readonly<Record<string, RegistryEntry>>;
export type AliasMap = Readonly<Record<string, string>>;

/** Format function for entries derived from mdn-data. */
const passthroughFormat: Formatter = (v: unknown): string => {
  if (v === null || v === undefined) {
    throw new TypeError('[fss] generated property received null/undefined value');
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
        `[fss] alias "${alias}" points to unknown canonical "${target}"`,
      );
    }
    if (alias in canonicals) {
      throw new Error(
        `[fss] alias "${alias}" shadows a canonical method of the same name`,
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
