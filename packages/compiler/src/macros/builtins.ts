import type { CassPlugin } from '../plugin.js';
import { defineMacro } from './define-macro.js';

/**
 * `.zIndex(n)` written without an explicit `position` defaults to
 * `position: relative`. z-index is a no-op against statically-positioned
 * ancestors — the chain reads as "I want to stack this element," and
 * the user almost never intends `position: static` in that context.
 *
 * Explicit `position` values (`absolute`, `fixed`, `sticky`, `static`,
 * `relative`) all suppress the macro — the user's intent wins.
 */
export const zIndexMacro: CassPlugin = defineMacro({
  name: 'zIndex',
  trigger: { property: 'z-index' },
  fills: [{ property: 'position', value: 'relative' }],
});

/**
 * `.transform(...)` written without an explicit `will-change` defaults
 * to `will-change: transform`. Hints the browser to promote the element
 * to its own compositor layer, avoiding the first-frame jank that can
 * appear when a transform fires for the first time on a previously
 * un-promoted element.
 *
 * `will-change` is intentionally a coarse hint — `auto` is a valid
 * user opt-out that suppresses the macro.
 */
export const transformMacro: CassPlugin = defineMacro({
  name: 'transform',
  trigger: { property: 'transform' },
  fills: [{ property: 'will-change', value: 'transform' }],
});

/**
 * `.position('sticky')` requires at least one of `top` / `right` /
 * `bottom` / `left` to actually stick. The macro fills `top: 0` only
 * when none of the four is set — `position('sticky').bottom(10)` is
 * a legitimate "stick to the bottom" pattern and the macro must not
 * collide with it.
 */
export const positionStickyMacro: CassPlugin = defineMacro({
  name: 'positionSticky',
  trigger: { property: 'position', value: 'sticky' },
  fills: [{ property: 'top', value: '0' }],
  skipIfAnyPresent: ['top', 'right', 'bottom', 'left'],
});

/**
 * The ordered list of macros bundled with `@cassida/compiler`. Each
 * entry is independently disable-able through
 * `cassida.config.json` → `{ macros: { disable: [...] } }`.
 *
 * The plugin pipeline runs macros first (in this order), then user
 * plugins, then canonical hashing.
 */
export const defaultMacros: readonly CassPlugin[] = Object.freeze([
  zIndexMacro,
  transformMacro,
  positionStickyMacro,
]);
