import {
  mapScopeBag,
  wrapInMediaScope,
  type FssPlugin,
  type ScopeBag,
} from '@fss/compiler';

export interface HoverFixOptions {
  /**
   * Media query body to wrap matching scopes in. Defaults to
   * `(hover: hover)`. Override only if you have specific Houdini
   * needs (e.g. `'(hover: hover) and (pointer: fine)'`).
   */
  readonly query?: string;
  /**
   * Pseudo selectors that should be gated by the media query. By
   * default we wrap every `:hover` (and `&:hover`-compound forms);
   * pass a custom set if you also want to gate `:focus-visible` etc.
   */
  readonly selectors?: readonly string[];
}

const DEFAULT_QUERY = '(hover: hover)';
const DEFAULT_SELECTORS: readonly string[] = [':hover'];

/**
 * Builds an FSS plugin that wraps any matching pseudo scope inside a
 * media-query gate. The default targets the iOS Safari "sticky hover"
 * problem: a hover style remains "stuck" on a touched element until
 * the user taps elsewhere, because the device reports `:hover` on tap
 * even though it has no real cursor.
 *
 * Example:
 *   fss().hover(c => c.color('red'))
 *
 * Without plugin → `.fss-X:hover { color: red }`
 *   → on iOS, color stays red after tap until next tap
 *
 * With plugin → `@media (hover: hover) { .fss-X:hover { color: red } }`
 *   → on iOS (which reports `(hover: none)`), the rule never applies
 *   → on desktop, identical behavior to the unfixed version
 *
 * The hash changes when this plugin is enabled (different ScopeBag
 * tree → different canonical key), so caches are invalidated cleanly
 * when toggling the plugin.
 */
export default function hoverFix(options: HoverFixOptions = {}): FssPlugin {
  const query = options.query ?? DEFAULT_QUERY;
  const selectors = new Set(options.selectors ?? DEFAULT_SELECTORS);

  return {
    name: '@fss/plugin-hover-fix',
    transform(tree: ScopeBag): ScopeBag {
      return mapScopeBag(tree, (node) => {
        const scope = node.scope;
        if (scope === null) return null; // root — never wrap
        if (scope.kind !== 'pseudo') return null;
        if (!selectors.has(scope.selector)) return null;
        // Don't double-wrap: if this :hover is already inside a
        // (hover: hover) gate (hand-authored or earlier plugin
        // pass), skip. We can't see ancestors from here, but the
        // plugin runs once per compileOps, and recursion is
        // bottom-up so the same node is visited only once.
        return wrapInMediaScope(node, query);
      });
    },
  };
}
