import {
  compileOps,
  defaultRegistry,
  type Op,
  type Registry,
} from '@fss/compiler';

/**
 * Runtime `fss()` chain.
 *
 * - In production, the build-time transform replaces `{...fss().foo()...}`
 *   spread expressions with a static `{className: "fss-xxx"}` object, and
 *   this runtime is never reached for the rewritten call sites.
 * - In dev, or when an argument is non-literal (e.g. `fss().color(theme.fg)`)
 *   so the parser cannot statically resolve the chain, the chain object is
 *   spread directly into JSX. The spread reads the enumerable `style`
 *   getter and the chain materializes as inline style. This keeps the
 *   Single-Class principle for static chains while keeping dynamic chains
 *   functional without a class explosion.
 *
 * Method handles (`color`, `marginTop`, ...) are non-enumerable so they
 * never leak into the spread; only `style` (and, when set by the
 * transform, `className`) are.
 */
export interface FssChain {
  readonly style: Readonly<Record<string, string>>;
  readonly [method: string]: unknown;
}

const cssToCamel = (prop: string): string =>
  prop.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());

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
        return chain as FssChain;
      },
    });
  }

  Object.defineProperty(chain, 'style', {
    enumerable: true,
    configurable: false,
    get(): Readonly<Record<string, string>> {
      const { bag } = compileOps(ops, { registry });
      const style: Record<string, string> = {};
      for (const k of Object.keys(bag)) {
        style[cssToCamel(k)] = bag[k]!;
      }
      return Object.freeze(style);
    },
  });

  return chain as FssChain;
}

export type { Op, Registry } from '@fss/compiler';
