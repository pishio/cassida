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
    longhandFamily: 'border',
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
  // `font` is the mega-shorthand: `<font-style> <font-variant> <font-weight>
  // <font-stretch> <font-size>[/<line-height>] <font-family>`. CSS resets
  // every unspecified subproperty to its initial value, so co-occurring
  // it with a longhand inside one scope is a silent footgun — the
  // shorthand-policy family guard makes that an error under 'strict'.
  // Passthrough format: the user already knows what they mean by `font`;
  // FSS doesn't try to assemble it from pieces.
  font: {
    property: 'font',
    animatable: false,
    shorthandFamily: 'font',
    format: (v: CSS.Property.Font): string => passthrough(v),
  },
  fontFamily: {
    property: 'font-family',
    animatable: false,
    longhandFamily: 'font',
    format: (v: CSS.Property.FontFamily): string => passthrough(v),
  },
  fontSize: {
    property: 'font-size',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'font',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  fontWeight: {
    property: 'font-weight',
    syntax: '<number>',
    initialValue: '400',
    animatable: true,
    longhandFamily: 'font',
    format: (v: CSS.Property.FontWeight): string => passthrough(v),
  },
  // `font` shorthand also resets `font-style` / `font-variant` /
  // `font-stretch` per CSS spec. Hand-curated entries with
  // `longhandFamily: 'font'` so the shorthand-policy guard catches
  // co-occurrence with the shorthand (matching `fontFamily` /
  // `fontSize` / `fontWeight` / `lineHeight`).
  fontStyle: {
    property: 'font-style',
    animatable: false,
    longhandFamily: 'font',
    format: (v: CSS.Property.FontStyle): string => passthrough(v),
  },
  fontVariant: {
    property: 'font-variant',
    animatable: false,
    longhandFamily: 'font',
    format: (v: CSS.Property.FontVariant): string => passthrough(v),
  },
  fontStretch: {
    property: 'font-stretch',
    animatable: true,
    longhandFamily: 'font',
    format: (v: CSS.Property.FontStretch): string => passthrough(v),
  },
  lineHeight: {
    property: 'line-height',
    syntax: '<number>',
    initialValue: '1',
    animatable: true,
    longhandFamily: 'font',
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
  // `flex` is the `<flex-grow> <flex-shrink> <flex-basis>` shorthand.
  // CSS resolves a single number argument to `<n> 1 0%` (`flex: 1` ⇒
  // `flex: 1 1 0%`), so a numeric overload could either pre-expand
  // or pass through to the browser. We pass through: the browser's
  // resolution is well-defined and identical across engines, and
  // emitting the user's literal preserves diagnostic readability in
  // devtools (`flex: 1` reads exactly like the source). Callers
  // wanting the explicit triple can pass the string themselves.
  //
  // `flex-direction` is NOT a longhand of the `flex` shorthand
  // (different family — the shorthand handles `flex-grow` /
  // `flex-shrink` / `flex-basis`), so it sits outside the family
  // guard and continues to co-occur freely.
  flex: {
    property: 'flex',
    animatable: false,
    shorthandFamily: 'flex',
    format: (v: CSS.Property.Flex<LenArg>): string => passthrough(v),
  },
  flexGrow: {
    property: 'flex-grow',
    syntax: '<number>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'flex',
    format: (v: CSS.Property.FlexGrow): string => passthrough(v),
  },
  flexShrink: {
    property: 'flex-shrink',
    syntax: '<number>',
    initialValue: '1',
    animatable: true,
    longhandFamily: 'flex',
    format: (v: CSS.Property.FlexShrink): string => passthrough(v),
  },
  flexBasis: {
    property: 'flex-basis',
    syntax: '<length>',
    initialValue: 'auto',
    animatable: true,
    longhandFamily: 'flex',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
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

  // border family — shorthand + three top-level longhands. The CSS
  // `border` shorthand is `<line-width> || <line-style> || <color>`
  // and resets the four-side longhands plus `border-image` to their
  // initial values. The shorthand-policy guard prevents mixing
  // `border` with `borderWidth` / `borderStyle` / `borderColor` (and
  // `borderColor` above, which already declares family).
  //
  // Note: the per-side shorthands (`border-top`, `border-right`, ...)
  // from `generated-property-specs.ts` are not wired into this family.
  // CSS treats `border` followed by `border-top` as a deliberate
  // override (`border` resets the per-side longhands, then `border-top`
  // sets just the top), and the LIFO bag captures that intent without
  // ambiguity.
  // `animatable: false` for the shorthand itself: `@property` only
  // accepts a restricted syntax grammar (`<length>`, `<color>`,
  // `<image>`, etc., or `*`), not the `<line-width> || <line-style>
  // || <color>` alternation. Marking the shorthand `animatable: true`
  // would emit an `@property` declaration with an invalid `syntax`
  // descriptor, which the CSS parser silently drops — taking the
  // dynamic-value interpolation path with it. The longhands
  // (`borderWidth`, `borderColor`) keep `animatable: true` because
  // each one's syntax is `@property`-valid in isolation.
  border: {
    property: 'border',
    animatable: false,
    shorthandFamily: 'border',
    // Drop the `<LenArg>` generic — the csstype generic widens the input
    // union to include `number`, but `passthrough(v)` returns `String(v)`
    // which would emit `border: 1` (invalid CSS). The shorthand grammar
    // requires a string like `'1px solid red'` — the longhand
    // `borderWidth(1)` is the path for numeric input.
    format: (v: CSS.Property.Border): string => passthrough(v),
  },
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
    longhandFamily: 'border',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  borderStyle: {
    property: 'border-style',
    animatable: false,
    longhandFamily: 'border',
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
  // `outline` is parallel to `border` (`<width> || <style> || <color>`)
  // and resets the three longhands. The hand-crafted entry replaces
  // the generated string-typed one so callers get csstype autocomplete
  // (`'1px solid red'`) and the shorthand-policy guard fires on
  // `outline ↔ outlineWidth / outlineStyle / outlineColor` mixes.
  //
  // `animatable: false` for the same reason as `border`: the
  // shorthand syntax is `@property`-invalid alternation.
  outline: {
    property: 'outline',
    animatable: false,
    shorthandFamily: 'outline',
    // Drop the `<LenArg>` generic — the csstype generic widens the input
    // union to include `number`, but `passthrough(v)` returns `String(v)`
    // which would emit `outline: 1` (invalid CSS). The shorthand grammar
    // requires a string like `'1px solid red'` — the longhand
    // `outlineWidth(1)` is the path for numeric input.
    format: (v: CSS.Property.Outline): string => passthrough(v),
  },
  // Outline longhands promoted from the generated set so their
  // `longhandFamily: 'outline'` registration activates the family
  // guard (`outline ↔ outlineWidth / outlineStyle / outlineColor`).
  outlineWidth: {
    property: 'outline-width',
    syntax: '<length>',
    initialValue: '0',
    animatable: true,
    longhandFamily: 'outline',
    format: (n: LenArg, unit?: string): string => length(n, unit),
  },
  outlineStyle: {
    property: 'outline-style',
    animatable: false,
    longhandFamily: 'outline',
    format: (v: CSS.Property.OutlineStyle): string => passthrough(v),
  },
  outlineColor: {
    property: 'outline-color',
    syntax: '<color>',
    initialValue: 'transparent',
    animatable: true,
    longhandFamily: 'outline',
    format: (v: CSS.Property.OutlineColor): string => passthrough(v),
  },
  // `grid` is the mega-shorthand for the explicit + implicit grid
  // (`grid-template-rows`, `grid-template-columns`, `grid-template-areas`,
  // `grid-auto-rows`, `grid-auto-columns`, `grid-auto-flow`). It resets
  // every unspecified subproperty to `initial`, so the family guard
  // exists for the same reason as `font` and `border`: silently losing
  // a longhand value is the bug the shorthand-policy is designed to
  // catch.
  //
  // The longhands live in the generated set and don't carry
  // `longhandFamily: 'grid'`, and `checkShorthandPolicy` only fires
  // on shorthand-vs-longhand pairs (not shorthand-vs-shorthand), so
  // today's guard is effectively inactive for grid mixes — the
  // `shorthandFamily: 'grid'` declaration here is forward-looking,
  // ready to activate once `gridTemplateColumns` / `gridTemplateRows`
  // / etc. are promoted into the hand-crafted set with
  // `longhandFamily: 'grid'`. Tracked in the backlog.
  grid: {
    property: 'grid',
    animatable: false,
    shorthandFamily: 'grid',
    format: (v: CSS.Property.Grid): string => passthrough(v),
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
