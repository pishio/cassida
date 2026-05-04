import type { Scope, ScopeBag } from './types.js';

/**
 * A compile-time transformation that runs between `Canonicalizer.collapse`
 * (which produces a raw `ScopeBag` tree) and `canonicalKey` (which hashes
 * it). Plugins receive the tree, return a *new* tree, and the className
 * is derived from the *post-plugin* tree — so any change a plugin makes
 * shows up as a different hash. This preserves FSS's bijection: same
 * hash ⇔ same final-state CSS, regardless of which plugin pipeline
 * produced it.
 *
 * Plugins must be:
 *   - **sync**: the compile pipeline is hot and deterministic; async
 *     would push Promise overhead per JSX spread and risk
 *     non-deterministic builds.
 *   - **pure** (no side effects, no external state): the same input
 *     must always yield the same output. State you need to share
 *     between calls should live in your plugin's factory closure.
 *   - **immutable**: do NOT mutate the input tree. Return a new
 *     `ScopeBag` — the helpers in this module (`replaceScope`,
 *     `mapScopeBag`) make this ergonomic.
 */
export interface CassPlugin {
  readonly name: string;
  readonly transform: (tree: ScopeBag, ctx: PluginContext) => ScopeBag;
}

/**
 * Context handed to a plugin's transform. Currently empty; future
 * fields (resolved config, registry, source filename) will land here
 * without breaking the function signature.
 */
export interface PluginContext {
  /** The fully-resolved config — read-only. */
  readonly config: Readonly<{
    readonly layer: string | null;
    readonly importSource: string;
  }>;
}

/**
 * Run a sequence of plugins over a tree, threading the output of each
 * into the next. Returns the original tree when the plugin list is
 * empty (no allocation, no work).
 */
export function applyPlugins(
  tree: ScopeBag,
  plugins: readonly CassPlugin[] | undefined,
  ctx: PluginContext,
): ScopeBag {
  if (!plugins || plugins.length === 0) return tree;
  let acc = tree;
  for (const plugin of plugins) {
    acc = plugin.transform(acc, ctx);
  }
  return acc;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers for plugin authors
// ─────────────────────────────────────────────────────────────────────

/**
 * Recursively walk a `ScopeBag` tree and replace nodes for which
 * `visitor` returns a non-null result. The traversal is bottom-up so
 * a visitor sees its children's transformed shape, not the raw input.
 *
 * Returns a *new* tree — the input is never mutated. When `visitor`
 * returns `null` for every node, the original tree object is returned
 * (reference-equal), so plugins that don't match anything pay zero
 * allocation.
 */
export function mapScopeBag(
  tree: ScopeBag,
  visitor: (node: ScopeBag) => ScopeBag | null,
): ScopeBag {
  let childrenChanged = false;
  const newChildren: ScopeBag[] = [];
  for (const child of tree.children) {
    const transformed = mapScopeBag(child, visitor);
    if (transformed !== child) childrenChanged = true;
    newChildren.push(transformed);
  }

  const intermediate: ScopeBag = childrenChanged
    ? { ...tree, children: newChildren }
    : tree;

  const replaced = visitor(intermediate);
  return replaced ?? intermediate;
}

/**
 * Wrap `node` (a non-root scope node) inside an outer media-query
 * scope. Returns a new tree with the original node nested under the
 * `@media` scope. Useful for plugins like hover-fix that want to
 * gate an existing scope on a runtime feature query.
 *
 * The wrapped node retains its own scope; the wrapper holds no bag
 * declarations of its own — it exists purely to introduce the media
 * gate.
 */
export function wrapInMediaScope(node: ScopeBag, query: string): ScopeBag {
  if (node.scope === null) {
    throw new Error('[fss] wrapInMediaScope: cannot wrap the root node');
  }
  const mediaScope: Scope = { kind: 'media', query };
  return {
    scope: mediaScope,
    bag: {},
    slots: {},
    children: [node],
  };
}
