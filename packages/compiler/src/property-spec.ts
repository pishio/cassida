import type * as CSS from 'csstype';

/**
 * Strongly-typed canonical method spec.
 *
 * This is the single source of truth from which:
 *
 *   1. `defaultRegistry`            — runtime lookup (type-erased)
 *   2. `CassChain` method signatures — compile-time API (typed via csstype)
 *   3. `defaultPropertyMeta`        — CSS-property → metadata lookup
 *      used by the emitter to decide `@property` rule emission
 *
 * are all derived. Adding a property here automatically updates them.
 *
 * Per-method `format` carries the typed argument signature; consumers extract
 * it via `Parameters<typeof canonicalSpec[K]['format']>` (cheap mapped type,
 * no template-literal recursion). Length-typed methods take `(n, unit?)` for
 * ergonomic chaining; passthrough methods use csstype's `Property.X` so that
 * IDE autocomplete surfaces real CSS values (`'red'`, `'flex'`, `'absolute'`).
 *
 * `animatable: true` marks a property as a candidate for `@property`
 * emission *when* its value is dynamic. It does not affect static-value
 * compilation. Continuous-interpolation properties (lengths, colors,
 * numbers) are typically true; enum-valued properties (display, position,
 * cursor, ...) are typically false.
 */

const length = (n: unknown, unit: unknown = 'px'): string => {
  if (typeof n === 'number') {
    const u = typeof unit === 'string' ? unit : 'px';
    return n === 0 ? '0' : `${n}${u}`;
  }
  if (typeof n === 'string') return n;
  throw new TypeError(`[cassida] expected number | string for length, got ${typeof n}`);
};

const passthrough = (v: unknown): string => {
  if (v == null) throw new TypeError('[cassida] value cannot be null/undefined');
  return String(v);
};

/** Length-typed input: number (becomes `{n}{unit}`, default `px`) or any CSS string (`'auto'`, `'100%'`, `'10em'`). */
type LenArg = number | (string & {});

type RawSpec = {
  readonly property: string;
  readonly syntax?: string;
  readonly initialValue?: string;
  readonly animatable: boolean;
  /** Family ID if this entry is a shorthand (e.g. `'padding'`). */
  readonly shorthandFamily?: string;
  /** Family ID if this entry is a longhand (e.g. `'padding'`). */
  readonly longhandFamily?: string;
  /**
   * Longhands this entry expands to. Present on multi-property entries
   * like `px` / `py` / `mx` / `my` that map one chain method to several
   * CSS declarations. When set, `format` returns a `Record<string,
   * string>` whose keys MUST match `properties` element-for-element.
   */
  readonly properties?: readonly string[];
  readonly format: (...args: never[]) => string | Record<string, string>;
};

export const canonicalSpec = {
  // colors — typed via csstype for IDE autocomplete of named colors / hex / rgb()
  color: {
    property: 'color',
    syntax: '<color>',
    initialValue: 'transparent',
    animatable: true,
    format: (v: CSS.Property.Color): string => passthrough(v),
  },
  backgroundColor: {
    property: 'background-color',
    syntax: '<color>',
    initialValue: 'transparent',
    animatable: true,
    format: (v: CSS.Property.BackgroundColor): string => passthrough(v),
  },
  borderColor: {
    property: 'border-color',
    syntax: '<color>',
    initialValue: 'transparent',
    animatable: true,
    format: (v: CSS.Property.BorderColor): string => passthrough(v),
  },

  // margin family — shorthand + longhands. The shorthand is allowed
  // because Canonicalizer's shorthand.policy (default 'strict')
  // prevents the cascade-vs-LIFO bug by forbidding shorthand ↔
  // longhand co-occurrence within a single scope.
  margin: {
    property: 'margin',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    shorthandFamily: 'margin',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginTop: {
    property: 'margin-top',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginRight: {
    property: 'margin-right',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginBottom: {
    property: 'margin-bottom',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  marginLeft: {
    property: 'margin-left',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // padding family — shorthand + longhands.
  padding: {
    property: 'padding',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    shorthandFamily: 'padding',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingTop: {
    property: 'padding-top',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingRight: {
    property: 'padding-right',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingBottom: {
    property: 'padding-bottom',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  paddingLeft: {
    property: 'padding-left',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // Tailwind-style multi-property utilities. Each writes two physical
  // longhands of an inline / block axis. They're treated as longhands
  // of the parent shorthand family (padding / margin) by the
  // shorthand-policy guard, so `padding(8).px(4)` errors under strict
  // policy just like `padding(8).paddingLeft(4)` would.
  //
  // The `property` field is a label for diagnostics + propertyMeta
  // lookup; the actual bag writes come from the formatter's StyleBag
  // return. v1 disallows dynamic args here — pass a literal or fall
  // back to `paddingInline` / `paddingBlock` / `marginInline` /
  // `marginBlock` (single-property entries from the generated set).
  px: {
    property: 'padding-inline',
    properties: ['padding-inline-start', 'padding-inline-end'],
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): Record<string, string> => {
      const v = length(n, unit);
      return { 'padding-inline-start': v, 'padding-inline-end': v };
    },
  },
  py: {
    property: 'padding-block',
    properties: ['padding-block-start', 'padding-block-end'],
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'padding',
    format: (n: LenArg, unit?: string): Record<string, string> => {
      const v = length(n, unit);
      return { 'padding-block-start': v, 'padding-block-end': v };
    },
  },
  mx: {
    property: 'margin-inline',
    properties: ['margin-inline-start', 'margin-inline-end'],
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): Record<string, string> => {
      const v = length(n, unit);
      return { 'margin-inline-start': v, 'margin-inline-end': v };
    },
  },
  my: {
    property: 'margin-block',
    properties: ['margin-block-start', 'margin-block-end'],
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'margin',
    format: (n: LenArg, unit?: string): Record<string, string> => {
      const v = length(n, unit);
      return { 'margin-block-start': v, 'margin-block-end': v };
    },
  },

  // size — animatable lengths
  width: {
    property: 'width',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  height: {
    property: 'height',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  minWidth: {
    property: 'min-width',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  minHeight: {
    property: 'min-height',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  maxWidth: {
    property: 'max-width',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  maxHeight: {
    property: 'max-height',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // typography
  fontFamily: {
    property: 'font-family',
    animatable: false,
    format: (v: CSS.Property.FontFamily): string => passthrough(v),
  },
  fontSize: {
    property: 'font-size',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  fontWeight: {
    property: 'font-weight',
    syntax: '<number>',
    initialValue: '400',
    animatable: true,
    format: (v: CSS.Property.FontWeight): string => passthrough(v),
  },
  lineHeight: {
    property: 'line-height',
    syntax: '<number>',
    initialValue: '1',
    animatable: true,
    format: (v: CSS.Property.LineHeight<LenArg>): string => passthrough(v),
  },
  textAlign: {
    property: 'text-align',
    animatable: false,
    format: (v: CSS.Property.TextAlign): string => passthrough(v),
  },

  // layout
  display: {
    property: 'display',
    animatable: false,
    format: (v: CSS.Property.Display): string => passthrough(v),
  },
  position: {
    property: 'position',
    animatable: false,
    format: (v: CSS.Property.Position): string => passthrough(v),
  },
  // inset family — shorthand + 4 longhands (top/right/bottom/left).
  inset: {
    property: 'inset',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    shorthandFamily: 'inset',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  top: {
    property: 'top',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'inset',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  right: {
    property: 'right',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'inset',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  bottom: {
    property: 'bottom',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'inset',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  left: {
    property: 'left',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'inset',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  zIndex: {
    property: 'z-index',
    syntax: '<integer>',
    initialValue: '0',
    animatable: true,
    format: (v: CSS.Property.ZIndex): string => passthrough(v),
  },

  // flex
  flexDirection: {
    property: 'flex-direction',
    animatable: false,
    format: (v: CSS.Property.FlexDirection): string => passthrough(v),
  },
  justifyContent: {
    property: 'justify-content',
    animatable: false,
    format: (v: CSS.Property.JustifyContent): string => passthrough(v),
  },
  alignItems: {
    property: 'align-items',
    animatable: false,
    format: (v: CSS.Property.AlignItems): string => passthrough(v),
  },
  gap: {
    property: 'gap',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },

  // border
  borderRadius: {
    property: 'border-radius',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  borderWidth: {
    property: 'border-width',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  borderStyle: {
    property: 'border-style',
    animatable: false,
    format: (v: CSS.Property.BorderStyle): string => passthrough(v),
  },

  // misc
  opacity: {
    property: 'opacity',
    syntax: '<number>',
    initialValue: '1',
    animatable: true,
    format: (v: CSS.Property.Opacity): string => passthrough(v),
  },
  cursor: {
    property: 'cursor',
    animatable: false,
    format: (v: CSS.Property.Cursor): string => passthrough(v),
  },

  // ─────────────────────────────────────────────────────────────────
  // Opaque shorthands. These CSS shorthands are accepted as
  // single-property writes — the user passes the *whole* CSS string
  // (`'fade 1s ease'` for animation) and FSS does not decompose into
  // longhand subproperties.
  //
  // Crucially, FSS does NOT expose the matching longhands
  // (`animationDuration`, `transitionProperty`, `transformOrigin`,
  // etc.). That means the canonical-vs-longhand co-occurrence
  // problem can't arise — there's nothing on the chain that could
  // collide with these in the bag — so the family-tracking guard is
  // structurally unnecessary.
  //
  // `transform` is `animatable: true` (it's the most-animated CSS
  // property in modern UIs); the other two are discrete shorthands
  // that don't interpolate as a single whole.
  animation: {
    property: 'animation',
    animatable: false,
    format: (v: CSS.Property.Animation): string => passthrough(v),
  },
  transition: {
    property: 'transition',
    animatable: false,
    format: (v: CSS.Property.Transition): string => passthrough(v),
  },
  transform: {
    property: 'transform',
    syntax: '<transform-list>',
    initialValue: 'none',
    animatable: true,
    format: (v: CSS.Property.Transform): string => passthrough(v),
  },
} as const satisfies Record<string, RawSpec>;

export type CanonicalSpec = typeof canonicalSpec;
export type CanonicalMethodName = keyof CanonicalSpec;

/**
 * CSS-property → metadata reverse lookup, derived from the spec.
 * The emitter consults this when a `CompiledRule.dynamics` slot needs
 * an `@property` declaration.
 */
export interface PropertyMeta {
  readonly syntax: string | undefined;
  readonly initialValue: string | undefined;
  readonly animatable: boolean;
}

const propertyMetaTable: Record<string, PropertyMeta> = {};
for (const spec of Object.values(canonicalSpec)) {
  if (!(spec.property in propertyMetaTable)) {
    propertyMetaTable[spec.property] = {
      syntax: 'syntax' in spec ? spec.syntax : undefined,
      initialValue: 'initialValue' in spec ? spec.initialValue : undefined,
      animatable: spec.animatable,
    };
  }
  // Multi-property entries (`px` → padding-inline-start/-end, ...)
  // also seed their longhand keys, reusing the parent's metadata
  // entry. Sharing the reference is safe because PropertyMeta is
  // readonly and the longhands inherit identical syntax / animatable
  // semantics from the parent. The `'properties' in spec` check is
  // required for type narrowing — `Object.values(canonicalSpec)` has
  // a union of spec literals, only some of which declare `properties`.
  if ('properties' in spec) {
    for (const longhand of spec.properties) {
      if (!(longhand in propertyMetaTable)) {
        propertyMetaTable[longhand] = propertyMetaTable[spec.property]!;
      }
    }
  }
}
export const defaultPropertyMeta: Readonly<Record<string, PropertyMeta>> = Object.freeze(propertyMetaTable);
