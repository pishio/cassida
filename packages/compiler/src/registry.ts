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
}

export type Registry = Readonly<Record<string, RegistryEntry>>;
export type AliasMap = Readonly<Record<string, string>>;

const length = (n: unknown, unit: unknown = 'px'): string => {
  if (typeof n === 'number') {
    const u = typeof unit === 'string' ? unit : 'px';
    return n === 0 ? '0' : `${n}${u}`;
  }
  if (typeof n === 'string') return n;
  throw new TypeError(`[fss] expected number | string for length, got ${typeof n}`);
};

const passthrough = (v: unknown): string => {
  if (v == null) throw new TypeError('[fss] value cannot be null/undefined');
  return String(v);
};

const lengthEntry = (property: string): RegistryEntry => ({
  property,
  format: (n, u) => length(n, u),
  syntax: '<length>',
});

const colorEntry = (property: string): RegistryEntry => ({
  property,
  format: (v) => passthrough(v),
  syntax: '<color>',
});

const rawEntry = (property: string): RegistryEntry => ({
  property,
  format: (v) => passthrough(v),
});

/**
 * Canonical method set: long-form, CSS-aligned names only.
 * This is the documented surface and the form `compileOps` outputs in errors.
 */
export const defaultCanonicals: Registry = Object.freeze({
  // colors
  color: colorEntry('color'),
  backgroundColor: colorEntry('background-color'),
  borderColor: colorEntry('border-color'),

  // margin
  margin: lengthEntry('margin'),
  marginTop: lengthEntry('margin-top'),
  marginRight: lengthEntry('margin-right'),
  marginBottom: lengthEntry('margin-bottom'),
  marginLeft: lengthEntry('margin-left'),

  // padding
  padding: lengthEntry('padding'),
  paddingTop: lengthEntry('padding-top'),
  paddingRight: lengthEntry('padding-right'),
  paddingBottom: lengthEntry('padding-bottom'),
  paddingLeft: lengthEntry('padding-left'),

  // size
  width: lengthEntry('width'),
  height: lengthEntry('height'),
  minWidth: lengthEntry('min-width'),
  minHeight: lengthEntry('min-height'),
  maxWidth: lengthEntry('max-width'),
  maxHeight: lengthEntry('max-height'),

  // typography
  fontFamily: rawEntry('font-family'),
  fontSize: lengthEntry('font-size'),
  fontWeight: rawEntry('font-weight'),
  lineHeight: rawEntry('line-height'),
  textAlign: rawEntry('text-align'),

  // layout
  display: rawEntry('display'),
  position: rawEntry('position'),
  top: lengthEntry('top'),
  right: lengthEntry('right'),
  bottom: lengthEntry('bottom'),
  left: lengthEntry('left'),
  zIndex: rawEntry('z-index'),

  // flex
  flexDirection: rawEntry('flex-direction'),
  justifyContent: rawEntry('justify-content'),
  alignItems: rawEntry('align-items'),
  gap: lengthEntry('gap'),

  // border
  borderRadius: lengthEntry('border-radius'),
  borderWidth: lengthEntry('border-width'),
  borderStyle: rawEntry('border-style'),

  // misc
  opacity: rawEntry('opacity'),
  cursor: rawEntry('cursor'),
});

/**
 * Optional shorthands. Aliases are pure typing-sugar: each one resolves
 * to the *same RegistryEntry reference* as its canonical, so behavior is
 * identical and `mt(10).marginTop(20)` collapses correctly to a single
 * `margin-top` declaration via LIFO.
 *
 * Aliases never appear as the source of truth in errors or output; the
 * canonical is always the documented form.
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
 * The runtime registry: canonicals + default aliases, flattened.
 * Lookup is O(1); aliases and canonicals are indistinguishable at the
 * point of use. Use `defaultCanonicals` and `defaultAliases` directly
 * if you need to know which is which (docs, codegen, etc.).
 */
export const defaultRegistry: Registry = expandAliases(defaultCanonicals, defaultAliases);

/**
 * Returns a frozen registry that overlays `additions` on top of `base`.
 * Later additions win on key conflict.
 */
export function extendRegistry(base: Registry, additions: Registry): Registry {
  return Object.freeze({ ...base, ...additions });
}
