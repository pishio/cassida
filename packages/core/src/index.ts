import {
  canonicalSpec,
  compileOps,
  defaultRegistry,
  type CanonicalSpec,
  type Op,
  type Registry,
} from '@fss/compiler';
import type * as CSS from 'csstype';

/**
 * Method shape derived from the canonical spec table.
 *
 * Each method's argument signature is extracted from the spec's typed
 * `format` function via `Parameters<...>`, so adding a property to the
 * spec automatically adds a typed method here. The mapped type is shallow
 * (one `infer` per key, no recursion); TS-server cost stays flat.
 */
type ChainMethodsFromSpec<S> = {
  [K in keyof S]: S[K] extends { format: (...args: infer A) => string }
    ? (...args: A) => FssChain
    : never;
};

/**
 * Method set generated from the default canonical spec. This is the
 * baseline surface for `fss()` chains.
 */
export type DefaultChainMethods = ChainMethodsFromSpec<CanonicalSpec>;

/**
 * Extension hook for downstream consumers.
 *
 * Users who add their own methods via `extendRegistry()` augment this
 * interface in their own `.d.ts` to surface those methods on the chain
 * with full type-checking — no plugin generic propagation required.
 *
 * ```ts
 * // app/fss.d.ts
 * declare module '@fss/core' {
 *   interface FssChainExtensions {
 *     brandColor(value: 'primary' | 'secondary'): FssChain;
 *   }
 * }
 * ```
 */
export interface FssChainExtensions {}

/**
 * Terminal members read by JSX spread. `style` is a `CSS.Properties` object
 * (camelCase keys, csstype-typed values); `className` is filled in only by
 * the build-time transform — at runtime this is always undefined and the
 * spread carries `style` instead.
 */
export interface FssChainTerminus {
  readonly style: Readonly<CSS.Properties>;
  readonly className?: string;
}

/**
 * Full chain type: typed canonical methods, user extensions, and the JSX
 * spread targets. The intersection means user augmentations of
 * `FssChainExtensions` automatically propagate to every chain.
 */
export type FssChain = DefaultChainMethods & FssChainExtensions & FssChainTerminus;

const cssToCamel = (prop: string): string =>
  prop.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());

/**
 * Runtime `fss()` builder.
 *
 * - Production: build-time transform replaces `{...fss().a().b()}` with
 *   `{className: "fss-xxx"}`. This runtime is unreached for those sites.
 * - Dev / dynamic chains: spread reads the enumerable `style` getter,
 *   chain materializes as inline style. Method handles are non-enumerable
 *   so `color`, `marginTop`, etc. never leak as React props.
 */
export function fss(registry: Registry = defaultRegistry): FssChain {
  const ops: Op[] = [];
  const chain = Object.create(null) as Record<string, unknown>;

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

  Object.defineProperty(chain, 'style', {
    enumerable: true,
    configurable: false,
    get(): Readonly<CSS.Properties> {
      const { bag } = compileOps(ops, { registry });
      const style: Record<string, string> = {};
      for (const k of Object.keys(bag)) {
        style[cssToCamel(k)] = bag[k]!;
      }
      return Object.freeze(style) as Readonly<CSS.Properties>;
    },
  });

  return chain as unknown as FssChain;
}

export { canonicalSpec };
export type { CanonicalSpec, CanonicalMethodName, Op, Registry } from '@fss/compiler';
