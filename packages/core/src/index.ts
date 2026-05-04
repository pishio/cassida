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
} from '@fss/compiler';
import type * as CSS from 'csstype';

/**
 * Method shape derived from the canonical (hand-crafted) style spec.
 *
 * Each method's argument signature is extracted from the spec's typed
 * `format` function via `Parameters<...>`, so adding a property to the
 * spec automatically adds a typed method here.
 */
type ChainMethodsFromSpec<S> = {
  [K in keyof S]: S[K] extends { format: (...args: infer A) => string }
    ? (...args: A) => FssChain
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
 * `fss().color(123)` typecheck — loosening the curated typing. By
 * dropping overlapping keys, we let hand-crafted entries reign for
 * their domain and the generated set fills only the genuine gaps.
 */
type ChainMethodsFromGenerated<S, EXCLUDE extends string | number | symbol> = {
  [K in keyof S as K extends EXCLUDE ? never : K]: (
    value: string | number,
  ) => FssChain;
};

/**
 * Method set generated from the default canonical spec.
 */
export type DefaultChainMethods = ChainMethodsFromSpec<CanonicalSpec>;

/**
 * Method set generated from the mdn-data-derived spec table. Includes
 * every standard CSS property (~460 entries, vendor and non-standard
 * stripped). Hand-crafted methods of the same name override these via
 * the FssChain intersection so curated typing wins.
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
export type ScopedCallback = (chain: FssChain) => FssChain | unknown;

/**
 * Modifier methods are zero-arg shorthands for common scopes
 * (`hover`, `focus`, `before`, `darkMode`, ...) plus two arg-taking
 * generics (`media(query, cb)` and `on(selector, cb)`).
 *
 * Inside the callback, `c` is a fresh `FssChain` whose method calls
 * push ops into the modifier's sub-scope. The outer chain wraps those
 * inner ops in a `ScopedOp` and pushes it to its own ops list when the
 * callback returns.
 */
type ZeroArgModifiers = {
  [K in keyof typeof canonicalModifiers]: (cb: ScopedCallback) => FssChain;
};

export interface ChainModifiers extends ZeroArgModifiers {
  on(selector: string, cb: ScopedCallback): FssChain;
  media(query: string, cb: ScopedCallback): FssChain;
}

/**
 * Extension hook for downstream consumers.
 *
 * Users who add their own methods via `extendRegistry()` augment this
 * interface in their own `.d.ts` to surface those methods on the chain.
 *
 * ```ts
 * declare module '@fss/core' {
 *   interface FssChainExtensions {
 *     brandColor(value: 'primary' | 'secondary'): FssChain;
 *   }
 * }
 * ```
 */
export interface FssChainExtensions {}

/**
 * Terminal members read by JSX spread. `style` is a `CSS.Properties`
 * object (camelCase keys, csstype-typed values); `className` is filled
 * in only by the build-time transform — at runtime this is undefined
 * and the spread carries `style` instead.
 */
export interface FssChainTerminus {
  readonly style: Readonly<CSS.Properties>;
  readonly className?: string;
}

/**
 * Full chain type: typed canonical style methods, modifiers, user
 * extensions, and the JSX spread targets. The intersection means user
 * augmentations of `FssChainExtensions` automatically propagate.
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
export type FssChain =
  & DefaultChainMethods
  & GeneratedChainMethods
  & ChainModifiers
  & FssChainExtensions
  & FssChainTerminus;

const cssToCamel = (prop: string): string =>
  prop.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());

/**
 * Runtime `fss()` builder.
 *
 * - Production: build-time transform replaces `{...fss().a().b()}` with
 *   `{className: "fss-xxx"}` (and `style` for dynamics). This runtime
 *   is unreached for those sites.
 * - Dev / dynamic chains: spread reads the enumerable `style` getter,
 *   chain materializes as inline style. Method handles are non-enumerable
 *   so they don't leak as React props.
 */
export function fss(registry: Registry = defaultRegistry): FssChain {
  return makeChain(registry, [], true);
}

function makeChain(registry: Registry, ops: Op[], isRoot: boolean): FssChain {
  const chain = Object.create(null) as Record<string, unknown>;

  // Style methods. The runtime registry already merges hand-crafted
  // and generated entries, so this single loop covers both sources —
  // every standard CSS property gets a callable method on the chain.
  for (const method of Object.keys(registry)) {
    Object.defineProperty(chain, method, {
      enumerable: false,
      writable: false,
      configurable: false,
      value: (...args: unknown[]): FssChain => {
        ops.push({ method, args });
        return chain as unknown as FssChain;
      },
    });
  }

  // Zero-arg modifiers (hover, focus, before, darkMode, ...).
  for (const [name, scope] of Object.entries(canonicalModifiers)) {
    Object.defineProperty(chain, name, {
      enumerable: false,
      writable: false,
      configurable: false,
      value: (cb: ScopedCallback): FssChain => {
        const innerOps: Op[] = [];
        cb(makeChain(registry, innerOps, false));
        ops.push({ scope, ops: innerOps });
        return chain as unknown as FssChain;
      },
    });
  }

  // Arg-taking modifiers.
  Object.defineProperty(chain, 'media', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (query: string, cb: ScopedCallback): FssChain => {
      const innerOps: Op[] = [];
      cb(makeChain(registry, innerOps, false));
      const scope: Scope = { kind: 'media', query };
      ops.push({ scope, ops: innerOps });
      return chain as unknown as FssChain;
    },
  });

  Object.defineProperty(chain, 'on', {
    enumerable: false,
    writable: false,
    configurable: false,
    value: (selector: string, cb: ScopedCallback): FssChain => {
      const innerOps: Op[] = [];
      cb(makeChain(registry, innerOps, false));
      const scope: Scope = selector.trim().startsWith('@media')
        ? { kind: 'media', query: selector.replace(/^@media\s*/, '') }
        : selector.startsWith(':') || selector.startsWith('::')
        ? { kind: 'pseudo', selector }
        : { kind: 'raw', selector };
      ops.push({ scope, ops: innerOps });
      return chain as unknown as FssChain;
    },
  });

  // Only the root chain exposes `style` to JSX spread. Inner chains
  // accumulate ops for the outer; spreading them would leak the inner
  // bag.
  if (isRoot) {
    Object.defineProperty(chain, 'style', {
      enumerable: true,
      configurable: false,
      get(): Readonly<CSS.Properties> {
        const { tree } = compileOps(ops, { registry });
        const style: Record<string, string> = {};
        for (const k of Object.keys(tree.bag)) {
          style[cssToCamel(k)] = tree.bag[k]!;
        }
        return Object.freeze(style) as Readonly<CSS.Properties>;
      },
    });
  }

  return chain as unknown as FssChain;
}

export { canonicalSpec };
export type {
  CanonicalSpec,
  CanonicalMethodName,
  Op,
  Registry,
} from '@fss/compiler';
