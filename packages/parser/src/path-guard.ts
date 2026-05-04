import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

/**
 * Path-like input for `pathAs`.
 *
 * Babel's `path.get('field')` may return `NodePath<X | null | undefined>`
 * when the AST field is itself nullable (e.g. `ReturnStatement.argument`).
 * Accepting the wider input type lets `pathAs` be the *single* point of
 * narrowing for both regular and nullable paths.
 */
type AnyNodePath = NodePath | NodePath<t.Node | null | undefined>;

/**
 * Narrows a `NodePath` by a Babel type predicate.
 *
 * The single internal `as` is type-safe: the predicate has just been
 * verified, and `NodePath<X>` is a phantom-typed wrapper (no runtime
 * difference between `NodePath<CallExpression>` and `NodePath<Identifier>`),
 * so reinterpreting the same object under a more specific type generic
 * is sound.
 *
 * Use at the boundary where a generic `NodePath` needs narrowing;
 * downstream code can then call `.get('field')` and receive a properly
 * typed sub-path with no further casts.
 */
export function pathAs<N extends t.Node>(
  path: AnyNodePath,
  predicate: (n: t.Node) => n is N,
): NodePath<N> | null {
  if (!path.node) return null;
  return predicate(path.node) ? (path as unknown as NodePath<N>) : null;
}
