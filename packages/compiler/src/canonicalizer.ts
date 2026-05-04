import {
  DYNAMIC_PLACEHOLDER,
  isDynamic,
  isMethodOp,
  isScopedOp,
  type DynamicArg,
  type Op,
  type Scope,
  type ScopeBag,
} from './types.js';
import type { Registry } from './registry.js';

/**
 * Walks an `Op[]` chain, LIFO-collapsing each scope's declarations and
 * recursing into nested scoped sub-chains. The output is a deterministic
 * `ScopeBag` tree: the root has `scope: null` and owns "base"
 * declarations; each child carries its modifier (`:hover`, `@media (...)`,
 * raw selector) plus its own bag and further children.
 *
 * Multiple scoped ops at the same scope key (e.g. two `.hover(...)`
 * calls in the same chain) are merged: their inner ops are concatenated,
 * then re-collapsed inside the merged scope. This matches the user's
 * intuition that "`.hover()` adds, doesn't replace" while still
 * applying property-level LIFO inside the merged scope.
 */
export class Canonicalizer {
  constructor(private readonly registry: Registry) {}

  collapse(ops: readonly Op[], scope: Scope | null = null): ScopeBag {
    const bag: Record<string, string> = {};
    const slots: Record<string, string> = {};
    const childOpsByKey = new Map<string, { scope: Scope; ops: Op[] }>();

    for (const op of ops) {
      if (isMethodOp(op)) {
        const entry = this.registry[op.method];
        if (!entry) {
          throw new Error(
            `[fss] unknown method "${op.method}". Add it to the registry or check for typos.`,
          );
        }

        const dynamics = op.args.filter(isDynamic) as readonly DynamicArg[];

        if (dynamics.length === 0) {
          bag[entry.property] = entry.format(...op.args);
          delete slots[entry.property];
          continue;
        }

        if (op.args.length !== 1 || dynamics.length !== 1) {
          throw new Error(
            `[fss] mixed/multi-dynamic args are not supported in this phase; method "${op.method}"`,
          );
        }

        bag[entry.property] = DYNAMIC_PLACEHOLDER;
        slots[entry.property] = dynamics[0]!.id;
        continue;
      }

      if (isScopedOp(op)) {
        const key = scopeKey(op.scope);
        const existing = childOpsByKey.get(key);
        if (existing) {
          existing.ops.push(...op.ops);
        } else {
          childOpsByKey.set(key, { scope: op.scope, ops: [...op.ops] });
        }
        continue;
      }
    }

    const children: ScopeBag[] = [];
    for (const { scope: childScope, ops: childOps } of childOpsByKey.values()) {
      children.push(this.collapse(childOps, childScope));
    }

    return {
      scope,
      bag,
      slots,
      children,
    };
  }

  /**
   * Deterministic key derived from a scope tree.
   *
   * For static-only chains (no modifiers, no nested scopes) the format
   * matches Phase 1 exactly — sorted entry pairs — so existing class
   * hashes are preserved across the Phase 2 upgrade. Trees with any
   * nested scope use the structured form, which encodes the full
   * sorted scope-tree shape.
   */
  canonicalKey(tree: ScopeBag): string {
    if (tree.scope === null && tree.children.length === 0) {
      const keys = Object.keys(tree.bag).sort();
      return JSON.stringify(keys.map((k) => [k, tree.bag[k]!]));
    }
    return JSON.stringify(serialize(tree));
  }
}

interface SerializedNode {
  readonly s: SerializedScope | null;
  readonly b: ReadonlyArray<readonly [string, string]>;
  readonly c: readonly SerializedNode[];
}

type SerializedScope =
  | { readonly k: 'pseudo'; readonly v: string }
  | { readonly k: 'media'; readonly v: string }
  | { readonly k: 'raw'; readonly v: string };

function serialize(node: ScopeBag): SerializedNode {
  const bag: Array<readonly [string, string]> = Object.keys(node.bag)
    .sort()
    .map((k) => [k, node.bag[k]!] as const);
  const sortedChildren = [...node.children].sort((a, b) =>
    scopeOrderKey(a.scope!).localeCompare(scopeOrderKey(b.scope!)),
  );
  return {
    s: serializeScope(node.scope),
    b: bag,
    c: sortedChildren.map(serialize),
  };
}

function serializeScope(scope: Scope | null): SerializedScope | null {
  if (scope === null) return null;
  if (scope.kind === 'pseudo') return { k: 'pseudo', v: scope.selector };
  if (scope.kind === 'media') return { k: 'media', v: scope.query };
  return { k: 'raw', v: scope.selector };
}

/**
 * Stable string used to (a) identify same-scope ops in `collapse`, and
 * (b) sort sibling children deterministically in `canonicalKey`.
 *
 * Pseudo scopes sort before media scopes before raw scopes, with
 * lexicographic order within each group. This is purely a
 * canonicalization device — emission ordering for output CSS is
 * decided by the emitter (which uses the same prefix to keep `:hover`
 * rules before `@media` rules in the output).
 */
function scopeKey(scope: Scope): string {
  return scopeOrderKey(scope);
}

function scopeOrderKey(scope: Scope): string {
  if (scope.kind === 'pseudo') return `0${scope.selector}`;
  if (scope.kind === 'media') return `1${scope.query}`;
  return `2${scope.selector}`;
}
