import {
  canonicalModifiers,
  canonicalSpec,
  compileOps,
  defaultRegistry,
  generatedPropertySpecs,
  type CanonicalSpec,
  type GeneratedSpecMap,
  type Op,
  type Registry,
  type Scope,
} from '@cassida/compiler';
import type * as CSS from 'csstype';

/**
 * Method shape derived from the canonical (hand-crafted) style spec.
 *
 * Each method's argument signature is extracted from the spec's typed
 * `format` function via `Parameters<...>`, so adding a property to the
 * spec automatically adds a typed method here.
 *
 * The format return type is widened to `string | Record<string, string>`
 * to accommodate multi-property entries (e.g. `px` / `py`) whose
 * formatters emit a bag of longhand declarations rather than a single
 * string.
 */
type ChainMethodsFromSpec<S> = {
  [K in keyof S]: S[K] extends {
    format: (...args: infer A) => string | Record<string, string>;
  }
    ? (...args: A) => CassChain
    : never;
};

/**
 * Method shape for the auto-generated mdn-data spec set, with keys
 * already covered by the hand-crafted canonical spec excluded.
 *
 * Why exclude: TypeScript's method-intersection forms an overloaded
 * call signature whose accepted args is the *union* of each branch's
 * args. If we declared `color` in BOTH a typed (csstype) and a
 * permissive (string | number) form, the intersection would let
 * `cas().color(123)` typecheck — loosening the curated typing. By
 * dropping overlapping keys, we let hand-crafted entries reign for
 * their domain and the generated set fills only the genuine gaps.
 */
type ChainMethodsFromGenerated<S, EXCLUDE extends string | number | symbol> = {
  [K in keyof S as K extends EXCLUDE ? never : K]: (
    value: string | number,
  ) => CassChain;
};

/**
 * Method set generated from the default canonical spec.
 */
export type DefaultChainMethods = ChainMethodsFromSpec<CanonicalSpec>;

/**
 * Method set generated from the mdn-data-derived spec table. Includes
 * every standard CSS property (~460 entries, vendor and non-standard
 * stripped). Hand-crafted methods of the same name override these via
 * the CassChain intersection so curated typing wins.
 */
export type GeneratedChainMethods = ChainMethodsFromGenerated<
  GeneratedSpecMap,
  keyof CanonicalSpec
>;

/**
 * Callback signature for modifier methods. The argument is a fresh
 * scoped chain whose ops accumulate into the modifier's sub-scope.
 * Returning the chain is conventional but not required (return value
 * is ignored).
 */
export type ScopedCallback = (chain: CassChain) => CassChain | unknown;

/**
 * Modifier methods are zero-arg shorthands for common scopes
 * (`hover`, `focus`, `before`, `darkMode`, ...) plus two arg-taking
 * generics (`media(query, cb)` and `on(selector, cb)`).
 *
 * Inside the callback, `c` is a fresh `CassChain` whose method calls
 * push ops into the modifier's sub-scope. The outer chain wraps those
 * inner ops in a `ScopedOp` and pushes it to its own ops list when the
 * callback returns.
 */
type ZeroArgModifiers = {
  [K in keyof typeof canonicalModifiers]: (cb: ScopedCallback) => CassChain;
};

export interface ChainModifiers extends ZeroArgModifiers {
  on(selector: string, cb: ScopedCallback): CassChain;
  media(query: string, cb: ScopedCallback): CassChain;
}

/**
 * Chain-internal branching. Replaces the more verbose JSX-level
 * ternary spread `{...(cond ? cas().X() : cas().Y())}` with a fluent
 * shape that keeps the conditional logic inside the chain:
 *
 *   ```tsx
 *   <div
 *     {...cas()
 *       .padding(8)
 *       .cond(active, c => c.bg('blue'), c => c.bg('gray'))
 *       .color('red')
 *       .props}
 *   />
 *   ```
 *
 * At build time, the parser materialises the Cartesian product of all
 * `.cond()` decisions into N classes — each leaf carries the full
 * pre/post-cond ops plus the branch's inner ops — and emits a nested
 * ternary `className=` (and `style=`, when any branch is dynamic).
 *
 * At runtime, `test` is evaluated immediately and the picked branch's
 * inner ops are spliced into the linear ops list, so the runtime
 * chain compiles to the same hash as the matching build-time leaf.
 *
 * The second callback is optional. When omitted, the falsy branch
 * contributes no ops — equivalent to `cond && cas().X()` in JSX-level
 * shorthand.
 */
export interface ChainCondMethod {
  cond(test: unknown, truthy: ScopedCallback, falsy?: ScopedCallback): CassChain;
}

/**
 * Escape-hatch chain method for properties outside FSS's safe surface
 * (CSS shorthands, vendor prefixes, custom properties like `--brand-*`).
 *
 * Bypasses the registry, the shorthand-policy guard, and family
 * tracking. Numeric values are NOT auto-unitized — the user is
 * expected to pass a fully-formed CSS value string. Pairs naturally
 * with `cas.unsafe(...)` for preset injection.
 *
 * `keyof CSS.PropertiesHyphen` provides IDE autocomplete for standard
 * kebab-case property names; `(string & {})` preserves that
 * autocomplete while still accepting any other string (for custom
 * properties or browser experiments).
 */
export interface ChainSetMethod {
  set(
    key: keyof CSS.PropertiesHyphen | (string & {}),
    value: string | number,
  ): CassChain;
}

/**
 * Extension hook for downstream consumers.
 *
 * Users who add their own methods via `extendRegistry()` augment this
 * interface in their own `.d.ts` to surface those methods on the chain.
 *
 * ```ts
 * declare module '@cassida/core' {
 *   interface CassChainExtensions {
 *     brandColor(value: 'primary' | 'secondary'): CassChain;
 *   }
 * }
 * ```
 */
export interface CassChainExtensions {}

/**
 * Output shape of a finalized chain — the *implementation* side of
 * `cas()`. Spread into a JSX element via the `.props` terminator:
 *
 *   ```tsx
 *   <div {...cas().padding(8).color('red').props} />
 *   ```
 *
 * Why a terminator rather than spreading the chain object directly:
 * the chain carries ~460 method handles named after CSS properties,
 * some of which collide with HTML attribute names (`translate`,
 * `disabled`, `hidden`, …). React's JSX typings reject the
 * resulting union, so the chain isn't JSX-spreadable on its own.
 * `.props` strips everything except the two attributes JSX actually
 * needs, restoring type-correctness without sacrificing chain
 * autocomplete.
 */
export interface CassChainProps {
  readonly className: string;
  readonly style: Readonly<CSS.Properties>;
}

/**
 * Terminal members of the chain. Surfaces `.props` for type-correct
 * JSX spread. The build-time parser also recognizes spreads of the
 * bare chain (`{...cas()...}`) for backward compatibility, but the
 * type system intentionally hides the chain's method surface from
 * JSX — direct spread is a type error from v0.3 onward.
 */
export interface CassChainTerminus {
  readonly props: CassChainProps;
}

/**
 * Full chain type: typed canonical style methods, modifiers, user
 * extensions, and the JSX spread targets. The intersection means user
 * augmentations of `CassChainExtensions` automatically propagate.
 */
/**
 * Full chain type. Order of intersection matters: later items in the
 * union DO NOT override earlier ones in TypeScript's intersection
 * resolution, but properties of the same key WIDEN to a function
 * signature compatible with both. We therefore put the *typed* hand-
 * crafted methods first (so call sites see their precise signatures
 * for autocomplete) and the permissive generated set after, so
 * gap-filling methods exist but don't tighten / loosen the curated
 * ones beyond what they already declare.
 */
export type CassChain =
  & DefaultChainMethods
  & GeneratedChainMethods
  & ChainModifiers
  & ChainCondMethod
  & ChainSetMethod
  & CassChainExtensions
  & CassChainTerminus;

const cssToCamel = (prop: string): string =>
  prop.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());

/**
 * CSS shorthands intentionally absent from the FSS canonical surface.
 * Keys here are rejected from `SafePreset` (the `cas(preset)` arg type)
 * — users wanting these values must explicitly route through
 * `cas.unsafe(...)`, mirroring Rust's `unsafe` block contract.
 */
type BlacklistedSafeKeys =
  | 'background'
  | 'font'
  | 'border'
  | 'flex'
  | 'grid'
  | 'all'
  | 'mask'
  | 'transition'
  | 'animation'
  | 'listStyle'
  | 'textDecoration'
  | 'placeItems'
  | 'placeContent'
  | 'placeSelf'
  | 'columns'
  | 'columnRule'
  | 'overflow'
  | 'gridArea'
  | 'gridTemplate';

/**
 * Strictly-typed preset shape for the safe `cas(preset)` overload.
 * csstype-typed CSS values, blacklisted shorthands removed at the
 * type level so they don't autocomplete and can't be written.
 */
export type SafePreset = Partial<Omit<CSS.Properties, BlacklistedSafeKeys>>;

/**
 * Permissive preset shape for `cas.unsafe(preset)`. Accepts any
 * string key; intended for blacklisted shorthands, vendor-prefixed
 * properties, and CSS custom properties (`--foo`). The contract is
 * "you're past the safety guarantees, write raw CSS at your own
 * discretion".
 */
export interface UnsafePreset {
  readonly [key: string]: string | number | undefined;
}

const camelToKebab = (s: string): string => {
  if (s.includes('-')) return s;
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
};

/**
 * Runtime `cas()` builder.
 *
 * - Production: build-time transform replaces `{...cas().a().b()}` with
 *   `{className: "fss-xxx"}` (and `style` for dynamics). This runtime
 *   is unreached for those sites.
 * - Dev / dynamic chains: spread reads the enumerable `style` getter,
 *   chain materializes as inline style. Method handles are non-enumerable
 *   so they don't leak as React props.
 *
 * Overloads:
 *   - `cas()` — empty chain
 *   - `cas(preset)` — start from a typed preset (safe; blacklisted
 *     shorthands are excluded from the type and routed through
 *     `cas.unsafe`)
 *   - `cas.unsafe(preset)` — bypass the safety net; preset can include
 *     blacklisted shorthands, vendor properties, and CSS custom props
 */
export interface CassBuilder {
  (): CassChain;
  (preset: SafePreset): CassChain;
  /**
   * Escape hatch for properties outside FSS's safe surface (CSS
   * shorthands like `background`, vendor-prefixed, custom `--foo`).
   * Bypasses registry validation, shorthand-policy, and family
   * tracking — the user takes responsibility for the resulting CSS.
   */
  readonly unsafe: (preset: UnsafePreset) => CassChain;
}

function casCall(preset?: SafePreset): CassChain {
  const ops: Op[] = [];
  if (preset) {
    for (const [key, val] of Object.entries(preset)) {
      if (val === null || val === undefined) continue;
      ops.push({ method: key, args: [val] });
    }
  }
  return makeChain(defaultRegistry, ops, true);
}

function casUnsafe(preset: UnsafePreset): CassChain {
  const ops: Op[] = [];
  for (const [key, val] of Object.entries(preset)) {
    if (val === null || val === undefined) continue;
    ops.push({ property: camelToKebab(key), value: String(val) });
  }
  return makeChain(defaultRegistry, ops, true);
}

/**
 * Cassida's chain entry point.
 *
 * Three names refer to the *same* implementation:
 *   - `cas`     — primary, brand-aligned, 3-letter (matches the
 *                 muscle memory of FSS's `cas()` predecessor)
 *   - `css`     — backronym "Cassida Single Style" — for those who
 *                 prefer the CSS-native naming. Note: this collides
 *                 with `css` from emotion / vanilla-extract; if you
 *                 use those alongside Cassida, prefer `cas` or alias
 *                 explicitly: `import { css as cs } from '@cassida/core'`.
 *   - `cassida` — long form for explicit code styles
 */
export const cas: CassBuilder = Object.assign(casCall, {
  unsafe: casUnsafe,
}) as CassBuilder;

export { cas as css };
export { cas as cassida };
export default cas;

function makeChain(registry: Registry, ops: Op[], isRoot: boolean): CassChain {
  const chain = Object.create(null) as Record<string, unknown>;

  // Style methods. The runtime registry already merges hand-crafted
  // and generated entries, so this single loop covers both sources —
  // every standard CSS property gets a callable method on the chain.
  for (const method of Object.keys(registry)) {
    Object.defineProperty(chain, method, {
      enumerable: false,
      writable: false,
      configurable: false,
      value: (...args: unknown[]): CassChain => {
        ops.push({ method, args });
        return chain as unknown as CassChain;
      },
    });
  }

  // Zero-arg modifiers (hover, focus, before, darkMode, ...).
  for (const [name, scope] of Object.entries(canonicalModifiers)) {
    Object.defineProperty(chain, name, {
      enumerable: false,
      writable: false,
      configurable: false,
      value: (cb: ScopedCallback): CassChain => {
        const innerOps: Op[] = [];
        cb(makeChain(registry, innerOps, false));
        ops.push({ scope, ops: innerOps });
        return chain as unknown as CassChain;
      },
    });
  }

  // Arg-taking modifiers.
  Object.defineProperty(chain, 'media', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (query: string, cb: ScopedCallback): CassChain => {
      const innerOps: Op[] = [];
      cb(makeChain(registry, innerOps, false));
      const scope: Scope = { kind: 'media', query };
      ops.push({ scope, ops: innerOps });
      return chain as unknown as CassChain;
    },
  });

  Object.defineProperty(chain, 'on', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (selector: string, cb: ScopedCallback): CassChain => {
      const innerOps: Op[] = [];
      cb(makeChain(registry, innerOps, false));
      const scope: Scope = selector.trim().startsWith('@media')
        ? { kind: 'media', query: selector.replace(/^@media\s*/, '') }
        : selector.startsWith(':') || selector.startsWith('::')
        ? { kind: 'pseudo', selector }
        : { kind: 'raw', selector };
      ops.push({ scope, ops: innerOps });
      return chain as unknown as CassChain;
    },
  });

  // `.cond(test, truthy, falsy?)` — chain-internal branching. The
  // runtime resolves `test` immediately and inlines the picked
  // branch's ops into the main list, so a chain that goes through a
  // cond compiles to the same hash as the matching build-time
  // Cartesian leaf. The falsy callback is optional; omitting it means
  // "no ops on the false side" — semantically `cond && cas().X()`.
  //
  // No CondOp is recorded: the chain shape after cond is
  // indistinguishable from "the user called the branch's methods
  // directly". That keeps hash bijection between runtime (single
  // chosen branch) and build time (all branches enumerated).
  Object.defineProperty(chain, 'cond', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (
      test: unknown,
      truthy: ScopedCallback,
      falsy?: ScopedCallback,
    ): CassChain => {
      const branch = test ? truthy : falsy;
      if (branch) {
        const innerOps: Op[] = [];
        branch(makeChain(registry, innerOps, false));
        for (const op of innerOps) ops.push(op);
      }
      return chain as unknown as CassChain;
    },
  });

  // Escape hatch — direct CSS property write that bypasses the
  // registry. Pairs with `cas.unsafe(preset)`. camelCase keys are
  // converted to kebab-case so `set('paddingTop', '10px')` and
  // `set('padding-top', '10px')` produce the same bag (and therefore
  // the same className) — matching `paddingTop(10)` exactly when the
  // value is unit-included.
  Object.defineProperty(chain, 'set', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (key: string, value: string | number): CassChain => {
      ops.push({ property: camelToKebab(key), value: String(value) });
      return chain as unknown as CassChain;
    },
  });

  // The `.props` terminator — type-correct JSX spread target. Returns
  // a frozen `{ className, style }` derived from the same `compileOps`
  // pipeline the build-time parser uses, so dev-mode (parser-bypassed)
  // and prod-mode outputs match byte-for-byte for the same chain.
  // Non-enumerable so that `{...chain}` without `.props` doesn't
  // accidentally spread a literal `{props: {...}}`.
  //
  // Defined on every chain (root and inner) rather than only the root
  // because `CassChain` is the same type the modifier callback param
  // (`.hover(c => ...)`) is typed as. If `.props` only existed on the
  // root, `c.props` in callback bodies would typecheck but be
  // `undefined` at runtime. Inner-chain `.props` reflects only the
  // inner scope's ops — semantically odd to spread into JSX, but
  // never throws and never lies about types.
  //
  // Memoized by `ops.length`: every chain method push grows ops by
  // one, so a length match means the bag is unchanged and the
  // previous result is still authoritative. Repeated `.props`
  // reads on the same finalized chain (common in renders with
  // memo'd children) skip the entire canonicalize pass.
  let cachedProps: CassChainProps | null = null;
  let cachedOpsLength = -1;
  const buildProps = (): CassChainProps => {
    if (cachedProps !== null && ops.length === cachedOpsLength) return cachedProps;
    const result = compileOps(ops, { registry });
    const style: Record<string, string> = {};
    for (const k of Object.keys(result.tree.bag)) {
      // CSS custom properties (`--foo`) must stay kebab-case in the
      // React `style` object — React treats them as raw CSS variable
      // names rather than camelCased property identifiers. The
      // canonical-spec longhands are kebab-case and get camelized,
      // but `set('--foo', ...)` writes go through unchanged.
      const outKey = k.startsWith('--') ? k : cssToCamel(k);
      style[outKey] = result.tree.bag[k]!;
    }
    cachedProps = Object.freeze({
      className: result.className,
      style: Object.freeze(style) as Readonly<CSS.Properties>,
    });
    cachedOpsLength = ops.length;
    return cachedProps;
  };

  Object.defineProperty(chain, 'props', {
    enumerable: false,
    configurable: false,
    get: buildProps,
  });

  // Legacy direct-spread support on the root only — read-only style.
  // Will be removed in v1.0 alongside the parser's tolerance for
  // bare-chain spreads. The type already excludes it from v0.3.
  if (isRoot) {
    Object.defineProperty(chain, 'style', {
      enumerable: true,
      configurable: false,
      get(): Readonly<CSS.Properties> {
        return buildProps().style;
      },
    });
  }

  return chain as unknown as CassChain;
}

export { canonicalSpec };
export type {
  CanonicalSpec,
  CanonicalMethodName,
  Op,
  Registry,
} from '@cassida/compiler';
