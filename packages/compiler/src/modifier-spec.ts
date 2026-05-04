import type { Scope } from './types.js';

/**
 * Canonical zero-arg modifier methods. Each shorthand resolves to a
 * fixed `Scope` and is invoked as `chain.<method>(c => ...)`.
 *
 * The chain runtime in `@fss/core` injects a method on `FssChain` for
 * each entry here; the parser detects them by name (just like canonical
 * style methods). The arg-taking modifiers `media(query, cb)` and
 * `on(selector, cb)` are special-cased and not in this table.
 */
export const canonicalModifiers = {
  // user-interaction states
  hover: { kind: 'pseudo', selector: ':hover' },
  focus: { kind: 'pseudo', selector: ':focus' },
  focusVisible: { kind: 'pseudo', selector: ':focus-visible' },
  focusWithin: { kind: 'pseudo', selector: ':focus-within' },
  active: { kind: 'pseudo', selector: ':active' },

  // form states
  disabled: { kind: 'pseudo', selector: ':disabled' },
  checked: { kind: 'pseudo', selector: ':checked' },
  required: { kind: 'pseudo', selector: ':required' },
  invalid: { kind: 'pseudo', selector: ':invalid' },

  // structural
  firstChild: { kind: 'pseudo', selector: ':first-child' },
  lastChild: { kind: 'pseudo', selector: ':last-child' },
  empty: { kind: 'pseudo', selector: ':empty' },

  // pseudo-elements
  before: { kind: 'pseudo', selector: '::before' },
  after: { kind: 'pseudo', selector: '::after' },
  placeholder: { kind: 'pseudo', selector: '::placeholder' },
  selection: { kind: 'pseudo', selector: '::selection' },

  // common media presets
  darkMode: { kind: 'media', query: '(prefers-color-scheme: dark)' },
  reduceMotion: { kind: 'media', query: '(prefers-reduced-motion: reduce)' },
  print: { kind: 'media', query: 'print' },
} as const satisfies Record<string, Scope>;

export type CanonicalModifierName = keyof typeof canonicalModifiers;

/**
 * The two arg-taking modifiers. Names listed here so the parser and
 * runtime treat them uniformly: each takes `(arg: string, cb)`.
 */
export const argModifiers = {
  media: 'media',
  on: 'raw',
} as const satisfies Record<string, Scope['kind']>;

export type ArgModifierName = keyof typeof argModifiers;

/**
 * Returns true if `name` is any kind of modifier method (zero-arg or
 * arg-taking). The parser uses this to decide whether to recurse into
 * a callback argument.
 */
export function isModifierMethod(name: string): boolean {
  return name in canonicalModifiers || name in argModifiers;
}
