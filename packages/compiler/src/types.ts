/**
 * Marker for arguments the parser could not statically evaluate. The
 * parser stashes the original AST node behind `id`; the compiler treats
 * these as opaque placeholders for canonical-key purposes and wires the
 * surviving slot into the resulting `CompiledRule.dynamics` list.
 */
export const DYNAMIC_TAG = '__fss_dynamic__';

export interface DynamicArg {
  readonly [DYNAMIC_TAG]: true;
  readonly id: string;
}

export function isDynamic(v: unknown): v is DynamicArg {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { [DYNAMIC_TAG]?: unknown })[DYNAMIC_TAG] === true
  );
}

/**
 * Sentinel value placed in a property bag for slots whose value is
 * dynamic. The choice of ` ` makes accidental collision with a
 * real CSS string impossible.
 */
export const DYNAMIC_PLACEHOLDER = ' <FSS_DYN> ';

/**
 * A method call captured from a `cas()` chain, e.g. `color('red')`.
 */
export interface MethodOp {
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * A scope-introducing call (`hover(c => ...)`, `media(q, c => ...)`,
 * `on(sel, c => ...)`). Inner ops are collected from the callback's
 * fresh chain and nested under this scope.
 */
export interface ScopedOp {
  readonly scope: Scope;
  readonly ops: readonly Op[];
}

/**
 * A direct CSS property write that bypasses the registry — emitted
 * by `fss.unsafe(preset)` for keys outside the safe canonical set.
 *
 * `property` is a kebab-case CSS property name; `value` is a fully
 * formatted CSS value string. Shorthand-policy guards do not apply
 * to RawOps (they are intentionally outside the safety net — that's
 * what "unsafe" means).
 */
export interface RawOp {
  readonly property: string;
  readonly value: string;
}

/**
 * Discriminated union of chain ops. Use `isMethodOp` / `isScopedOp` /
 * `isRawOp` to narrow at consumption sites.
 */
export type Op = MethodOp | ScopedOp | RawOp;

export function isMethodOp(op: Op): op is MethodOp {
  return 'method' in op;
}

export function isScopedOp(op: Op): op is ScopedOp {
  return 'scope' in op && 'ops' in op;
}

export function isRawOp(op: Op): op is RawOp {
  return 'property' in op && 'value' in op;
}

/**
 * One scoping layer in a chain. The Canonicalizer turns these into
 * nested rule selectors (`& :hover { ... }`, `@media (...) { ... }`).
 *
 * - `pseudo`: ":hover", ":focus", "::before", etc. — always prefixed by `&`.
 * - `media`:  the parenthesized query body, sans `@media`.
 * - `raw`:    arbitrary CSS selector text appended after `&` (e.g.
 *             `[data-loading="true"]`, `> *`). Use sparingly.
 */
export type Scope =
  | { readonly kind: 'pseudo'; readonly selector: string }
  | { readonly kind: 'media'; readonly query: string }
  | { readonly kind: 'raw'; readonly selector: string };

/**
 * Canonical, post-LIFO property map. Keys are CSS property names
 * (`margin-top`, not `marginTop`); values are CSS-ready strings or
 * the dynamic placeholder.
 */
export type PropertyBag = Readonly<Record<string, string>>;

/**
 * Recursive scope-tree produced by `Canonicalizer.collapse`.
 *
 * Each node owns the declarations *directly* applied at its scope
 * (e.g. the base node owns un-modified declarations; a `:hover` child
 * owns declarations written inside `.hover(c => ...)`).
 *
 * The hash is computed over the entire tree, so two structurally
 * identical chains share a class regardless of textual differences in
 * the source.
 */
export interface ScopeBag {
  /** `null` for the root (base scope); `Scope` for any nested layer. */
  readonly scope: Scope | null;
  readonly bag: PropertyBag;
  readonly slots: Readonly<Record<string, string>>;
  readonly children: readonly ScopeBag[];
}

/**
 * One dynamic slot in a compiled rule. The CSS rule emits
 * `<property>: var(<varName>)`; the parser injects the source AST node
 * as the value of `<varName>` in the element's inline style.
 *
 * `scopePath` describes where in the scope tree this slot lives; it is
 * informational only (the var name already encodes uniqueness via the
 * className hash).
 */
export interface DynamicSlot {
  readonly property: string;
  readonly varName: string;
  readonly sourceId: string;
  readonly animatable: boolean;
  readonly syntax: string | undefined;
  readonly initialValue: string | undefined;
  readonly scopePath: readonly Scope[];
}

/**
 * Result of compiling an `Op[]` chain.
 *
 * - `canonical` is the deterministic key from which `className` was
 *   derived (placeholders for dynamics, sorted scope-tree shape).
 * - `tree` is CSS-emission-ready: dynamic entries already substituted
 *   with `var(--<className>-<scope>-<prop>)`. The emitter walks the
 *   tree, builds nested CSS, and runs it through stylis.
 * - `dynamics` lists every dynamic slot in source order; the parser
 *   maps each `sourceId` back to its AST expression to populate the
 *   inline style attribute.
 */
export interface CompiledRule {
  readonly className: string;
  readonly tree: ScopeBag;
  readonly canonical: string;
  readonly dynamics: readonly DynamicSlot[];
}
