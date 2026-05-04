import {
  DYNAMIC_PLACEHOLDER,
  isDynamic,
  isMethodOp,
  isRawOp,
  isScopedOp,
  type DynamicArg,
  type Op,
  type Scope,
  type ScopeBag,
} from './types.js';
import type { Registry, RegistryEntry } from './registry.js';
import type { ShorthandPolicy } from './config.js';

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
  constructor(
    private readonly registry: Registry,
    private readonly policy: ShorthandPolicy = 'strict',
  ) {}

  collapse(ops: readonly Op[], scope: Scope | null = null): ScopeBag {
    const bag: Record<string, string> = {};
    const slots: Record<string, string> = {};
    const childOpsByKey = new Map<string, { scope: Scope; ops: Op[] }>();
    // Per-scope tracking for shorthand ↔ longhand co-occurrence.
    // Recursion into ScopedOps creates a fresh `collapse` invocation
    // with its own local `seenShorthand` / `seenLonghand`, so the
    // `media`/`hover`/`on` scope automatically reset the constraint.
    const seenShorthand = new Map<string, string>();
    const seenLonghand = new Map<string, string>();

    for (const op of ops) {
      if (isMethodOp(op)) {
        const entry = this.registry[op.method];
        if (!entry) {
          throw new Error(
            `[fss] unknown method "${op.method}". Add it to the registry or check for typos.`,
          );
        }

        this.checkShorthandPolicy(op.method, entry, seenShorthand, seenLonghand);

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

      if (isRawOp(op)) {
        // RawOps bypass the registry entirely. They sit in the bag as
        // pre-formatted CSS declarations. Shorthand-policy and family
        // tracking deliberately do NOT apply — the user already opted
        // out of the safety net by routing through `fss.unsafe`.
        bag[op.property] = op.value;
        delete slots[op.property];
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
   * Apply the configured shorthand-policy check. Throws when the user
   * mixes shorthand and longhand of the same family within a single
   * scope in a way the policy forbids. The error message names both
   * methods and points at the three escape hatches: modifier callback,
   * looser `policy` config, or sticking to one form.
   */
  private checkShorthandPolicy(
    methodName: string,
    entry: RegistryEntry,
    seenShorthand: Map<string, string>,
    seenLonghand: Map<string, string>,
  ): void {
    if (this.policy === 'lenient') {
      // No-op, but still record so downstream code can introspect if needed.
      if (entry.shorthandFamily) seenShorthand.set(entry.shorthandFamily, methodName);
      if (entry.longhandFamily) seenLonghand.set(entry.longhandFamily, methodName);
      return;
    }

    // longhand → shorthand check (strict only — the bug-prone direction).
    if (entry.shorthandFamily) {
      const family = entry.shorthandFamily;
      const conflicting = seenLonghand.get(family);
      if (this.policy === 'strict' && conflicting !== undefined) {
        throw new Error(this.policyError('shorthand', methodName, conflicting, family));
      }
      seenShorthand.set(family, methodName);
    }

    // shorthand → longhand check (always — both 'strict' and 'shorthand-first').
    if (entry.longhandFamily) {
      const family = entry.longhandFamily;
      const conflicting = seenShorthand.get(family);
      if (conflicting !== undefined) {
        throw new Error(this.policyError('longhand', methodName, conflicting, family));
      }
      seenLonghand.set(family, methodName);
    }
  }

  private policyError(
    incomingKind: 'shorthand' | 'longhand',
    incomingMethod: string,
    earlierMethod: string,
    family: string,
  ): string {
    const prior = incomingKind === 'shorthand' ? 'longhand' : 'shorthand';
    return (
      `[fss] ${incomingKind} "${incomingMethod}" cannot follow ${prior} "${earlierMethod}" ` +
      `in the same scope (family: "${family}", policy: "${this.policy}"). ` +
      `Resolve via one of:\n` +
      `  • Use a modifier callback (.media(...), .hover(...), .on(...)) to scope them separately.\n` +
      `  • Set "shorthand.policy" to "shorthand-first" or "lenient" in fss.config.json.\n` +
      `  • Stick to a single form (only shorthand, or only longhands) in this scope.`
    );
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
