export type Formatter = (...args: readonly unknown[]) => string;

export interface RegistryEntry {
  readonly property: string;
  readonly format: Formatter;
  readonly syntax?: string;
  readonly initialValue?: string;
  readonly inherits?: boolean;
}

export type Registry = Readonly<Record<string, RegistryEntry>>;

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

export const defaultRegistry: Registry = Object.freeze({
  // colors
  color: colorEntry('color'),
  background: colorEntry('background-color'),
  bg: colorEntry('background-color'),
  backgroundColor: colorEntry('background-color'),
  borderColor: colorEntry('border-color'),

  // margin
  margin: lengthEntry('margin'),
  marginTop: lengthEntry('margin-top'),
  marginRight: lengthEntry('margin-right'),
  marginBottom: lengthEntry('margin-bottom'),
  marginLeft: lengthEntry('margin-left'),
  mt: lengthEntry('margin-top'),
  mr: lengthEntry('margin-right'),
  mb: lengthEntry('margin-bottom'),
  ml: lengthEntry('margin-left'),

  // padding
  padding: lengthEntry('padding'),
  paddingTop: lengthEntry('padding-top'),
  paddingRight: lengthEntry('padding-right'),
  paddingBottom: lengthEntry('padding-bottom'),
  paddingLeft: lengthEntry('padding-left'),
  pt: lengthEntry('padding-top'),
  pr: lengthEntry('padding-right'),
  pb: lengthEntry('padding-bottom'),
  pl: lengthEntry('padding-left'),

  // size
  width: lengthEntry('width'),
  height: lengthEntry('height'),
  minWidth: lengthEntry('min-width'),
  minHeight: lengthEntry('min-height'),
  maxWidth: lengthEntry('max-width'),
  maxHeight: lengthEntry('max-height'),

  // typography
  font: rawEntry('font-family'),
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
 * Returns a frozen registry that overlays `additions` on top of `base`.
 * Later additions win on key conflict.
 */
export function extendRegistry(base: Registry, additions: Registry): Registry {
  return Object.freeze({ ...base, ...additions });
}
