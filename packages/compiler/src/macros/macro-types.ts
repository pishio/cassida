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
 * fill's `property`, whether the bag already has any value at all
 * for that key. Macros never override existing writes; they only
 * fill in gaps.
 *
 * Macros fire on the **root scope only**. Modifier scopes (`:hover`,
 * `@media`, ...) are intentionally not visited. A `position('sticky')`
 * written inside `.hover(c => c.position('sticky'))` does not get an
 * automatic `top: 0`. The runtime currently exposes no opt-in for
 * traversing modifier scopes; if that turns out to be useful, a
 * future major adds the surface as an explicit field (it is not
 * declared here today so consumers cannot set a value that the
 * compiler silently ignores).
 */
export interface MacroDefinition {
  /** Human-readable identifier — used to disable specific macros via `config.macros.disable`. */
  readonly name: string;

  /**
   * The trigger pattern.
   *
   *   - `property` only: macro fires whenever the bag has any value
   *     for `property`, regardless of what it is.
   *   - `property` + `value`: macro fires only when the bag's value
   *     for `property` is exactly `value` (string-equal).
   */
  readonly trigger: { readonly property: string; readonly value?: string };

  /**
   * Properties this macro will fill in. Each entry's `property` is
   * checked against the existing bag; only properties that are NOT
   * already present are written. `value` is the default to write
   * as a complete CSS value string (no auto-unitisation).
   *
   * Each fill is decided independently: a fill whose property is
   * already in the bag is dropped, while a fill whose property is
   * absent is added. There is no "all or nothing".
   */
  readonly fills: readonly { readonly property: string; readonly value: string }[];

  /**
   * Anti-trigger: when ANY of these properties is already in the
   * bag, the macro skips entirely. Useful for the
   * `position: sticky` → `top: 0` case where any of
   * `top` / `right` / `bottom` / `left` (and their logical-property
   * equivalents `inset-block-*` / `inset-inline-*`) being set should
   * suppress the macro.
   *
   * Cassida's typed `cas()` surface blacklists `inset` as a shorthand;
   * the `inset*` entries here matter only when consumers reach the
   * macro target through `cas.unsafe({ inset: '...' })`.
   */
  readonly skipIfAnyPresent?: readonly string[];

  /**
   * Skip the macro when the trigger property's value matches any of
   * these strings. Useful for opting out of CSS-wide keywords
   * (`auto` / `none` / `unset` / `initial` / `inherit` / `revert` /
   * `revert-layer`) that semantically mean "this property has no
   * effect" — there is no point filling defaults for a no-op.
   *
   * `trigger.value` (above) is exact-match for fire-when-equal;
   * `skipIfTriggerValueIn` is exact-match for skip-when-equal. The
   * two compose: fire only when `trigger.value` matches AND the
   * value is not in `skipIfTriggerValueIn`.
   */
  readonly skipIfTriggerValueIn?: readonly string[];
}
