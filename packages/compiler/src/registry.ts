import { canonicalSpec } from './property-spec.js';

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

/**
 * Canonical method set, derived from `canonicalSpec`. The format functions
 * carry strict csstype-based parameter types in the spec; here they're
 * stored under the type-erased `Formatter` shape because the runtime
 * lookup path receives `unknown[]` from the parser.
 */
export const defaultCanonicals: Registry = Object.freeze(
  Object.fromEntries(
    Object.entries(canonicalSpec).map(([name, spec]) => {
      const entry: RegistryEntry = {
        property: spec.property,
        format: spec.format as unknown as Formatter,
        animatable: spec.animatable,
        ...('syntax' in spec && spec.syntax !== undefined ? { syntax: spec.syntax } : {}),
        ...('initialValue' in spec && spec.initialValue !== undefined
          ? { initialValue: spec.initialValue }
          : {}),
        ...('shorthandFamily' in spec && spec.shorthandFamily !== undefined
          ? { shorthandFamily: spec.shorthandFamily }
          : {}),
        ...('longhandFamily' in spec && spec.longhandFamily !== undefined
          ? { longhandFamily: spec.longhandFamily }
          : {}),
      };
      return [name, entry];
    }),
  ),
);

/**
 * Optional shorthands. Aliases are pure typing-sugar: each one resolves
 * to the *same RegistryEntry reference* as its canonical, so behavior is
 * identical and `mt(10).marginTop(20)` collapses correctly to a single
 * `margin-top` declaration via LIFO.
 */
export const defaultAliases: AliasMap = Object.freeze({
  bg: 'backgroundColor',
  background: 'backgroundColor',
  mt: 'marginTop',
  mr: 'marginRight',
  mb: 'marginBottom',
  ml: 'marginLeft',
  pt: 'paddingTop',
  pr: 'paddingRight',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  font: 'fontFamily',
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
