/**
 * Public type for built-in macros and `defineMacro` consumers.
 *
 * A macro is a tiny `CassPlugin` specialisation: it fires when the
 * post-collapse `bag` of the root scope contains a particular
 * property (optionally matching a particular value), and fills in
 * one or more default values for *other* properties — provided the
 * user did not already write them explicitly.
 *
 * "Explicit user values win" is implemented by checking, for each
 * `fillProperty`, whether the bag already has any value at all for
 * that key. Macros never override existing writes; they only fill in
 * gaps.
 *
 * Modifier scopes (`:hover`, `@media`, ...) are intentionally NOT
 * touched in the initial version. A `position('sticky')` written
 * inside `.hover(c => c.position('sticky'))` does not get an
 * automatic `top: 0` — only the root scope receives macro fills.
 * The `scope: 'all'` option is reserved for a future expansion that
 * walks every node in the tree.
 */
export interface MacroDefinition {
  /** Human-readable identifier — used to disable specific macros via `config.macros.disable`. */
  readonly name: string;

  /**
   * The trigger pattern. When the root `ScopeBag`'s `bag` contains
   * this property (and, if `triggerValue` is set, that exact value),
   * the macro fires.
   */
  readonly trigger: { readonly property: string; readonly value?: string };

  /**
   * Properties this macro will fill in. Each entry's `property` is
   * checked against the existing bag; only properties that are NOT
   * already present are written. `value` is the default to write.
   *
   * Multiple fills run as a unit: the macro succeeds atomically
   * (every absent fill is added) or partially (each independent
   * fill is decided on its own — there is no "all or nothing").
   */
  readonly fills: readonly { readonly property: string; readonly value: string }[];

  /**
   * Currently fixed at `'root'`. Reserved for future expansion to
   * walk modifier scopes as well. The runtime ignores `'all'` for
   * now; emit no error so future versions can introduce it without
   * a breaking change.
   */
  readonly scope?: 'root' | 'all';

  /**
   * Anti-trigger: when ANY of these properties is already in the
   * bag, the macro skips entirely. Useful for the `position: sticky`
   * → `top: 0` case where any of `top` / `right` / `bottom` / `left`
   * being explicitly set should suppress the macro.
   */
  readonly skipIfAnyPresent?: readonly string[];
}
