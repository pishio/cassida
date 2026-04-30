/**
 * A single method call captured from a `fss()` chain.
 * The parser (Babel/SWC) emits these from JSX; tests can hand-craft them.
 */
export interface Op {
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * Canonical, post-LIFO property map. Keys are CSS property names
 * (`margin-top`, not `marginTop`); values are CSS-ready strings.
 */
export type PropertyBag = Readonly<Record<string, string>>;

/**
 * Result of compiling an `Op[]` chain.
 * `canonical` is the deterministic key from which `className` was derived;
 * the emitter uses it to detect hash collisions across files.
 */
export interface CompiledRule {
  readonly className: string;
  readonly bag: PropertyBag;
  readonly canonical: string;
}
