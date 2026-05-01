import type * as CSS from 'csstype';

/**
 * Strongly-typed canonical method spec.
 *
 * This is the single source of truth from which:
 *
 *   1. `defaultRegistry`            — runtime lookup (type-erased)
 *   2. `FssChain` method signatures — compile-time API (typed via csstype)
 *
 * are both derived. Adding a property here automatically updates both.
 *
 * Per-method `format` carries the typed argument signature; consumers extract
 * it via `Parameters<typeof canonicalSpec[K]['format']>` (cheap mapped type,
 * no template-literal recursion). Length-typed methods take `(n, unit?)` for
 * ergonomic chaining; passthrough methods use csstype's `Property.X` so that
 * IDE autocomplete surfaces real CSS values (`'red'`, `'flex'`, `'absolute'`).
 */

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

/** Length-typed input: number (becomes `{n}{unit}`, default `px`) or any CSS string (`'auto'`, `'100%'`, `'10em'`). */
type LenArg = number | (string & {});

type RawSpec = {
  readonly property: string;
  readonly syntax?: string;
  readonly format: (...args: never[]) => string;
};

export const canonicalSpec = {
  // colors — typed via csstype for IDE autocomplete of named colors / hex / rgb()
  color: {
    property: 'color',
    syntax: '<color>',
    format: (v: CSS.Property.Color): string => passthrough(v),
  },
  backgroundColor: {
    property: 'background-color',
    syntax: '<color>',
    format: (v: CSS.Property.BackgroundColor): string => passthrough(v),
  },
  borderColor: {
    property: 'border-color',
    syntax: '<color>',
    format: (v: CSS.Property.BorderColor): string => passthrough(v),
  },

  // margin
  margin: {
    property: 'margin',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginTop: {
    property: 'margin-top',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginRight: {
    property: 'margin-right',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginBottom: {
    property: 'margin-bottom',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginLeft: {
    property: 'margin-left',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // padding
  padding: {
    property: 'padding',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingTop: {
    property: 'padding-top',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingRight: {
    property: 'padding-right',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingBottom: {
    property: 'padding-bottom',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingLeft: {
    property: 'padding-left',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // size
  width: {
    property: 'width',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  height: {
    property: 'height',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  minWidth: {
    property: 'min-width',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  minHeight: {
    property: 'min-height',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  maxWidth: {
    property: 'max-width',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  maxHeight: {
    property: 'max-height',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // typography
  fontFamily: {
    property: 'font-family',
    format: (v: CSS.Property.FontFamily): string => passthrough(v),
  },
  fontSize: {
    property: 'font-size',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  fontWeight: {
    property: 'font-weight',
    format: (v: CSS.Property.FontWeight): string => passthrough(v),
  },
  lineHeight: {
    property: 'line-height',
    format: (v: CSS.Property.LineHeight<LenArg>): string => passthrough(v),
  },
  textAlign: {
    property: 'text-align',
    format: (v: CSS.Property.TextAlign): string => passthrough(v),
  },

  // layout
  display: {
    property: 'display',
    format: (v: CSS.Property.Display): string => passthrough(v),
  },
  position: {
    property: 'position',
    format: (v: CSS.Property.Position): string => passthrough(v),
  },
  top: {
    property: 'top',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  right: {
    property: 'right',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  bottom: {
    property: 'bottom',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  left: {
    property: 'left',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  zIndex: {
    property: 'z-index',
    format: (v: CSS.Property.ZIndex): string => passthrough(v),
  },

  // flex
  flexDirection: {
    property: 'flex-direction',
    format: (v: CSS.Property.FlexDirection): string => passthrough(v),
  },
  justifyContent: {
    property: 'justify-content',
    format: (v: CSS.Property.JustifyContent): string => passthrough(v),
  },
  alignItems: {
    property: 'align-items',
    format: (v: CSS.Property.AlignItems): string => passthrough(v),
  },
  gap: {
    property: 'gap',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // border
  borderRadius: {
    property: 'border-radius',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  borderWidth: {
    property: 'border-width',
    syntax: '<length>',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  borderStyle: {
    property: 'border-style',
    format: (v: CSS.Property.BorderStyle): string => passthrough(v),
  },

  // misc
  opacity: {
    property: 'opacity',
    format: (v: CSS.Property.Opacity): string => passthrough(v),
  },
  cursor: {
    property: 'cursor',
    format: (v: CSS.Property.Cursor): string => passthrough(v),
  },
} as const satisfies Record<string, RawSpec>;

export type CanonicalSpec = typeof canonicalSpec;
export type CanonicalMethodName = keyof CanonicalSpec;
