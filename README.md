<!--
  Cassida — One element, one class. Compiled, not cascaded.
-->

# Cassida

[![@cassida/core](https://img.shields.io/npm/v/%40cassida%2Fcore?label=%40cassida%2Fcore&color=2ea44f)](https://www.npmjs.com/package/@cassida/core)
[![@cassida/vite-plugin](https://img.shields.io/npm/v/%40cassida%2Fvite-plugin?label=%40cassida%2Fvite-plugin&color=2ea44f)](https://www.npmjs.com/package/@cassida/vite-plugin)
[![@cassida/recommended](https://img.shields.io/npm/v/%40cassida%2Frecommended?label=%40cassida%2Frecommended&color=2ea44f)](https://www.npmjs.com/package/@cassida/recommended)
[![@cassida/plugin-hover-fix](https://img.shields.io/npm/v/%40cassida%2Fplugin-hover-fix?label=%40cassida%2Fplugin-hover-fix&color=2ea44f)](https://www.npmjs.com/package/@cassida/plugin-hover-fix)
[![@cassida/plugin-conditional](https://img.shields.io/npm/v/%40cassida%2Fplugin-conditional?label=%40cassida%2Fplugin-conditional&color=2ea44f)](https://www.npmjs.com/package/@cassida/plugin-conditional)
[![@cassida/plugin-global-css](https://img.shields.io/npm/v/%40cassida%2Fplugin-global-css?label=%40cassida%2Fplugin-global-css&color=2ea44f)](https://www.npmjs.com/package/@cassida/plugin-global-css)
[![@cassida/plugin-print](https://img.shields.io/npm/v/%40cassida%2Fplugin-print?label=%40cassida%2Fplugin-print&color=2ea44f)](https://www.npmjs.com/package/@cassida/plugin-print)
[![license MIT](https://img.shields.io/npm/l/%40cassida%2Fcore?color=blue)](./LICENSE)

> **One element, one class — compiled, not cascaded.**

A build-time CSS-in-JS compiler. Cassida collapses every styling chain to **exactly one class per element** via LIFO resolution at build time; the browser never computes specificity for Cassida-generated rules. Every `:hover`, `@media`, and nested rule sits inside a single `@layer cas` cascade layer with one stable class hash.

```tsx
import { cas } from '@cassida/core';

<button {...cas()
  .padding(12).backgroundColor('#1a73e8').color('white')
  .hover(c => c.backgroundColor('#1557b0'))
  .focus(c => c.backgroundColor('#0e3f87'))
  .props} />
```

becomes:

```tsx
<button className="cas-3702b738" />
```
```css
@layer cas {
  .cas-3702b738 {
    background-color: #1a73e8; color: #fff; padding: 12px;
  }
  .cas-3702b738:hover  { background-color: #1557b0 }
  .cas-3702b738:focus  { background-color: #0e3f87 }
}
```

No runtime. No specificity computation. No utility-class composition. Just one element, one class, the entire surface of CSS.

> Cassida is a *functional style sheet (FSS)* — a CSS-in-JS paradigm that collapses chains to a deterministic single class at compile time, named after the [Cassidinae](https://en.wikipedia.org/wiki/Cassidinae) (tortoise-beetle) subfamily and Latin *cassis* (shield). One element, one shield, no cascade.

## Status

**v0.7.0** — TypeScript path-alias resolution in cross-file static evaluation. `import { theme } from '@/tokens'` now folds at build time, with the Vite plugin auto-discovering `compilerOptions.paths` from `tsconfig.json` (including `extends` chains anchored per-config). New API surface: a `pathAliases` option on the parser's `TransformOptions`, the Vite plugin, and the standalone `loadTsconfigPaths(projectRoot)` helper. Closes the last `🚧` row on the roadmap.

**v0.6.0** — clears the two `[Limitations]` rows from v0.4.0. `.cond()` inside modifier scopes (`.hover(c => c.cond(active, t, f))`) now lifts to a build-time Cartesian instead of bailing to runtime, including mixed-depth cases where the inner cond lives in only one branch of an outer cond. Dynamic args on multi-property utilities (`cas().px(theme.spacing)` + `.py` / `.mx` / `.my`) now compile too — each longhand becomes its own CSS variable bound to the same source expression, and `@property` descriptors emit on both halves. No new packages; no breaking changes — chains that worked before still work, chains that bailed now produce single static classes.

**v0.5.0** — `@cassida/plugin-print` joins the workspace: a `printPreflight()` factory returning a CSS string of conservative `@media print` defaults (ink-saving black-on-white, external link URL expansion with break-word wrapping, abbreviation expansion, media width clamp covering `img`/`svg`/`video`/`canvas`, page-break hygiene for `pre`/`blockquote`/`tr`/headings, `thead`/`tfoot` repetition across page boundaries). Designed to be served through `@cassida/plugin-global-css` (added in v0.4) so the print rules live alongside Cassida's `@layer cas` output with cascade-layer-aware overrides — no `!important` anywhere.

**v0.4.0** — production-readiness sprint. Four substantive additions:

- **Conditional branching in two shapes.** `@cassida/plugin-conditional` lifts `{...(cond ? cas().X() : cas().Y())}` and short-circuit `{...(cond && cas().X())}` JSX spreads from the runtime path into the build-time class table; dynamic-slot branches like `cond ? cas().color(theme.fg) : cas().color(theme.muted)` now compile too (each branch becomes its own class with a parallel `style={...}` ternary). The new `.cond(test, truthy, falsy?)` chain method keeps the branching inline: `cas().padding(8).cond(active, c => c.bg('blue'), c => c.bg('gray')).color('red')` materializes a Cartesian product of leaves with one nested `className` ternary, no JSX-level duplication of outer methods.
- **Multi-property utilities.** Hand-crafted `px`, `py`, `mx`, `my` chain methods on `@cassida/core` write multiple longhands per call (`padding-inline-start` + `padding-inline-end`, etc.) with per-longhand LIFO collapse, full shorthand-policy guard, and dedup.
- **`@cassida/plugin-global-css`.** First-party Vite plugin for serving preflight / `body { ... }` / `*, ::before, ::after { ... }` rules through a virtual module, wrapped in a configurable `@layer` so it composes with Cassida's single-class output.
- **`@cassida/recommended`** stays as the one-line opt-in for the maintainers' default-on plugin bundle (hover-fix + conditional spreads).

Earlier surface stays: `.props` terminator from v0.3 (separates chain methods from JSX prop typings — strict `tsc --noEmit` passes), cross-file static evaluation from v0.2 (design tokens defined in a separate module or `.json` file fold into static class hashes at build time), packaging hardening from v0.1.1 (`sideEffects: false`, pure-JS hasher, `exports` map). The feature set is covered by 312 unit tests across 9 packages, plus an end-to-end CI smoke test that builds a real consumer against the tarballs on Vite 5 / 6 / 7 and Bun — including `tsc --noEmit` against the consumer for every Vite leg.

The API is stable across the documented surface but versions are 0.x; expect breaking changes between minor versions until 1.0.

```bash
pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin @cassida/recommended
```

`@cassida/recommended` bundles the maintainers' default-on plugin set (hover-fix + conditional spreads); the underlying plugin packages come along as transitive deps. Drop `@cassida/plugin-global-css` in for preflight / reset CSS. See [Quick start](#quick-start) for the `vite.config.ts` shape.

## Table of contents

- [Quick start](#quick-start)
- [Why Cassida](#why-cassida)
- [The Single Class Principle](#the-single-class-principle)
- [Feature tour](#feature-tour)
- [Configuration](#configuration)
- [Common pitfalls](#common-pitfalls)
- [Packages](#packages)
- [Architecture](#architecture)
- [Plugin authoring](#plugin-authoring)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Quick start

```bash
pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin @cassida/recommended
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';
import { recommended } from '@cassida/recommended';

export default defineConfig({
  plugins: [cassida(recommended()), react()],
});
```

`@cassida/recommended` opts in to the maintainers' default-on plugin set with one import:

- **`@cassida/plugin-hover-fix`** — gates `:hover` rules in `@media (hover: hover)` so iOS Safari doesn't get stuck on touch-triggered hovers.
- **`@cassida/plugin-conditional`** — lifts `{...(cond ? cas().X() : cas().Y()).props}` and `{...(cond && cas().X()).props}` JSX spreads from runtime fallback into the build-time class table.

To run lean, pass `cassida()` directly (skipping plugins). To customize, pass per-plugin options: `recommended({ hoverFix: false })`, `recommended({ conditional: { shortCircuit: false } })`. See the [Plugins section](#plugins) for details.

`App.tsx`:

```tsx
import { cas } from '@cassida/core';

export default function App() {
  return (
    <main {...cas().padding(24).maxWidth(720).props}>
      <h1 {...cas().color('crimson').fontSize(28).props}>Hello, Cassida.</h1>
    </main>
  );
}
```

That's it. Open DevTools: each element has exactly one `cas-xxxxxxxx` class, and every rule lives inside `@layer cas`.

`cas` is the canonical name; `css` and `cassida` are aliases for the same function — pick whichever reads best in your codebase. (Note: `css` collides with `emotion` / `vanilla-extract`; if you use those alongside Cassida, prefer `cas` or alias explicitly.)

### The `.props` terminator

Every chain ends with `.props`, which yields a `{ className, style }` JSX-spreadable shape:

```tsx
<div {...cas().padding(8).color('red').props} />
//                                     ^^^^^ required terminator
```

Why a terminator instead of spreading the chain directly? The chain object carries ~460 method handles named after CSS properties, and a handful of those names collide with HTML attributes (`translate`, `disabled`, `hidden`, …). React's JSX typings reject the resulting union. `.props` strips everything except the two attributes JSX actually needs, restoring type-correctness without losing chain autocomplete.

The build-time parser recognizes both `{...chain.props}` and the legacy `{...chain}` form (the latter is a type error from v0.3 onward but still produces a working bundle so v0.2 codebases keep running while they migrate).

## Why Cassida

There are roughly two camps in CSS-in-JS today:

1. **Runtime libraries** (styled-components, emotion): elegant ergonomics, but variable names become a fog you have to maintain — `StyledButtonBase`, `StyledButtonBaseWithIcon`, `StyledButtonBaseWithIconLarge` — and the JS bundle ships a CSS engine.
2. **Atomic CSS** (Tailwind): no runtime, but every element accumulates a forest of utility classes — `class="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded"` — and the browser still does the cascade work to assemble them.

Cassida picks a third path:

- **No runtime fog.** The build replaces `{...cas().a().b().props}` with `className="cas-XXXXXXXX"`. Production bundles contain *zero* `cas(` calls.
- **No utility-class explosion.** Each element gets *one* class. Conflicts resolve at compile time via LIFO (`cas().color('red').color('blue')` → only blue survives, red is never written to the CSS).
- **Honest types.** Every standard CSS property is callable as a typed method (csstype-driven autocomplete on the curated set, mdn-data-derived for the long tail). Blacklisted shorthands (`background`, `font`) require an explicit `cas.unsafe(...)` opt-in.
- **Pluggable opinions.** Browser-bug fixes and platform conventions live in `@cassida/plugin-*` packages, never in the core. The hash reflects post-plugin output, so caches invalidate cleanly when plugins change.

If a different CSS-in-JS already fits, Cassida probably isn't a migration win. It's for teams that want to commit to "one element, one class" as a system property.

## The Single Class Principle

Cassida's central guarantee: **each element receives exactly one Cassida class, and that class encodes the element's complete final styling state**.

This is enforced by three properties of the compile pipeline:

### 1. LIFO collapse at build time

```ts
cas().color('red').color('green').color('blue')
//      ^^^^^^^^^^^ never reach the CSS — eliminated by the canonicalizer
```

```css
@layer cas { .cas-XXXXXXXX { color: blue } }
```

The browser doesn't need to choose between three `color` declarations because the compiler already chose. Source order is the authority; the latest write wins.

### 2. Bijection (1 hash ↔ 1 CSS reality)

The class hash is derived from the *canonical bag* — a sorted, normalized representation of the final declarations *and* their nested scopes (`:hover`, `@media`, ...). Same bag everywhere produces the same hash; different bag produces different hash. Two elements with structurally identical chains share the same class across the entire bundle, even across files.

```ts
// File A
<div {...cas().color('crimson').padding(12).props} />
// File B
<div {...cas().padding(12).color('crimson').props} />
// → both compile to .cas-AAAAAAAA (same bag, source order doesn't matter for hash)
```

### 3. Compile-time conflict guarding

Cassida actively prevents the cascade-vs-LIFO pitfall that bites you when shorthand and longhand of the same family co-occur in one scope:

```ts
cas().padding(10).paddingTop(20)
// ❌ build error (default policy 'strict'):
//   [cassida] longhand "paddingTop" cannot follow shorthand "padding"
//   in the same scope (family: "padding", policy: "strict").
//   Resolve via one of:
//     • Use a modifier callback (.media(...), .hover(...), .on(...))
//     • Set "shorthand.policy" to "shorthand-first" or "lenient"
//     • Stick to a single form in this scope
```

Why error and not silently emit two declarations? Because CSS source order would then determine which wins — but Cassida's emitter sorts declarations alphabetically for stable hashing, so the cascade outcome wouldn't match the chain-order LIFO the user wrote. We make the conflict explicit.

`shorthand.policy` is configurable: `'strict'` (both directions banned), `'shorthand-first'` (only shorthand→longhand banned), or `'lenient'` (no checking). See [Configuration](#configuration).

### Multi-property utilities — `.px()`, `.py()`, `.mx()`, `.my()`

For Tailwind-style ergonomics on the inline / block axes, Cassida ships four hand-crafted multi-property methods:

```ts
cas().px(8)
// → padding-inline-start: 8px; padding-inline-end: 8px
cas().px(8).paddingInlineStart('4px')
// → padding-inline-start: 4px; padding-inline-end: 8px   (per-longhand LIFO)
```

Each writes *two* CSS declarations under a single chain call. They participate in the same hashing, dedup, and shorthand-policy machinery as single-property methods: `padding(8).px(4)` errors under default policy because `px` is registered as a `padding`-family longhand. v0.4 keeps dynamic args restricted to single-property entries — pass a literal here, or use `.paddingInline(...)` / `.paddingBlock(...)` (single-property, from the generated set) for dynamic values.

The canonical surface stays minimal: four entries, two axes × two box-model properties. Tailwind-equivalent presets (`text-sm`, `gap-4`, …) belong in a future `@cassida/preset-utilities` package.

### Conditional branches — `.cond(test, truthy, falsy?)`

For "this class or that class depending on a flag" patterns, keep the branching inside the chain:

```tsx
<button
  {...cas()
    .padding(8)
    .cond(
      active,
      c => c.bg('blue').color('white'),
      c => c.bg('gray').color('#333'),
    )
    .borderRadius(6)
    .props}
/>
```

At build time each branch materializes its own `cas-XXXXXXXX` class (the outer `padding` / `borderRadius` are shared across both leaves), and the JSX `className` becomes `active ? "cas-AAA" : "cas-BBB"`. Branches that carry dynamic values (`c.color(theme.fg)`) emit a parallel branch-conditional `style={...}` ternary that mirrors the className shape. The runtime evaluates the test and inlines the chosen branch's ops, landing on the same hash as the matching build-time leaf.

Single-arg form `cas().cond(active, c => c.bg('blue'))` is the chain-internal version of `active && cas().bg('blue').props` — falsy branch carries no extra ops.

Multiple `.cond()`s in one chain materialize the Cartesian product; the cap is 32 leaves (five nested conds). `.cond()` inside a modifier scope (`.hover(c => c.cond(...))`) is lifted to build time too — the Cartesian expansion descends through scoped ops, so a cond nested inside `.hover` / `.focus` / `.media(...)` produces one class per branch with the same `className` ternary. Mixed-depth cases (a cond inside only one branch of an outer cond) emit a partial ternary on the side that has the inner cond, a direct class on the other side.

## Feature tour

### Modifiers — `:hover`, `:focus`, `@media`, ...

```ts
cas().backgroundColor('#fff')
  .hover(c => c.backgroundColor('#eee'))
  .focus(c => c.outlineWidth(2))
  .media('(min-width: 768px)', c => c.padding(24))
  .on(':visited', c => c.color('purple'))
```

20+ canonical modifiers built in (`hover`, `focus`, `focusVisible`, `active`, `disabled`, `checked`, `before`, `after`, `placeholder`, `darkMode`, ...). Anything else can be reached via `.on(selector, ...)`.

Inside a callback, `c` is a fresh chain whose ops accumulate into the modifier's sub-scope; the outer chain wraps them when the callback returns. Nest as deeply as you need:

```ts
cas().hover(c =>
  c.media('(min-width: 768px)', c2 =>
    c2.color('red')))
// → .cas-X:hover { color: red }  (only at >=768px)
```

### Function composition — same-file mixins

Pure functions over chains compose via plain calls:

```ts
const withCard = (c: CassChain) =>
  c.padding(16).borderRadius(8).backgroundColor('#fff');

const withInteractive = (c: CassChain) =>
  c.cursor('pointer')
    .transition('transform .15s ease-out')
    .hover(h => h.transform('translateY(-1px)'));

<button {...withInteractive(withCard(cas())).fontSize(14)} />
```

The build-time parser walks `withCard`'s body, splices the ops into the input chain, and produces a single class for the merged surface. Phase 6c-2 supports same-file `const` arrow functions and `function` declarations with one `CassChain` param. Mixin composition across files is a separate concern from value-level cross-file evaluation (covered below).

### Constant injection — `cas(preset)`

Receive a static design token object and continue from there:

```ts
const card = { padding: 12, borderRadius: 8, backgroundColor: '#fff' } as const;

<div {...cas(card).marginTop(16).color('#222').props} />
//          ^^^^ same hash whether `card` is in this file or imported
```

For local `const` bindings Cassida uses Babel's `path.evaluate()`. For imports, see *Cross-file design tokens* below — values defined in another module are folded at build time.

### Cross-file design tokens

Values defined in a separate module are resolved at build time so design tokens drive *static* class hashing instead of runtime inline styles:

```ts
// theme.ts
export const theme = {
  brand: { primary: '#3b82f6', onPrimary: '#ffffff' },
  spacing: { sm: 8, md: 16, lg: 24 },
  radius: 6,
} as const;

// component.tsx
import { theme } from './theme';

<button
  {...cas()
    .padding(theme.spacing.md)
    .backgroundColor(theme.brand.primary)
    .color(theme.brand.onPrimary)
    .borderRadius(theme.radius)
    .props}
/>
```

The chain compiles to a single class — `padding:16px;background-color:#3b82f6;color:#fff;border-radius:6px;`. No CSS variables, no inline styles, no runtime cost.

**What's resolved**

- Literal values (string / number / boolean / null), object & array literals
- Member access on the above (`theme.brand.primary`, `theme["spacing"]["md"]`)
- Identifiers resolved through local `const`, named / default / namespace imports
- Re-exports (`export { x } from './y'`, `export * from './y'`)
- Directory imports (`./theme` → `./theme/index.ts`)
- Destructured exports (`export const { primary } = palette`, including renames and nested patterns)
- TypeScript `as const`, `satisfies`, parenthesized expressions
- JSON imports (`import tokens from './tokens.json'`) — top-level keys become named exports
- TypeScript path aliases (`@/tokens`, `~components/Button`) — `tsconfig.json`'s `compilerOptions.paths` is auto-discovered by the Vite plugin (with `extends` chains anchored per-config). Override or disable with the plugin's `pathAliases` option; standalone parser consumers pass `pathAliases` to `transform()` or call `loadTsconfigPaths(projectRoot)` directly.

**What stays dynamic** (chain bails to inline style or CSS variable):

- Function-call results, including `Object.freeze(...)`
- Template literals with substitutions (`` `hsl(${hue}deg ...)` ``)
- Bare-package specifiers (`from 'some-theme-pkg'`) — design tokens are user-owned files; walking `node_modules` would be an eval-by-AST footgun. A future opt-in option will whitelist trusted theme packages.

`@cassida/parser` exposes `createModuleCache()` so a Vite build can amortize parsing across many files. The vite-plugin wires this in automatically; no config required for typical projects.

### Dynamic values — auto CSS variables

When an argument is non-literal, Cassida promotes the property to a CSS custom property without breaking the Single Class:

```ts
function ThemedBox({ accent }: { accent: string }) {
  return <div {...cas().color(accent).padding(16).props} />;
}
```

Compiles to:

```tsx
<div className="cas-XXXXXXXX" style={{ '--cas-XXXXXXXX-color': accent }} />
```
```css
@property --cas-XXXXXXXX-color { syntax: "<color>"; inherits: false; initial-value: transparent }
@layer cas {
  .cas-XXXXXXXX { color: var(--cas-XXXXXXXX-color); padding: 16px }
}
```

The hash is computed from the *shape* of the bag, not from the dynamic value, so `cas().color(themeA)` and `cas().color(themeB)` collapse to the same class — each element supplies its own value via inline style. `@property` rules are emitted automatically for animatable properties (color, length, opacity, transform, ...) so the value participates correctly in CSS Animations and Transitions.

### Escape hatches — `cas.unsafe()` and `.set()`

For CSS shorthands that Cassida deliberately rejects from its safe surface (`background`, `font`, `border`, ...) and for vendor-prefixed or custom CSS properties:

```ts
// Preset object that includes a blacklisted shorthand
<div {...cas.unsafe({ background: 'linear-gradient(...)' }).marginTop(16).props} />

// Direct CSS property write inside a chain
cas()
  .set('--brand-scale', 1.5)
  .set('-webkit-tap-highlight-color', 'transparent')
  .padding(12)
```

Both bypass the registry, the shorthand-policy guard, and family tracking. The escape is named explicitly so accidental misuse stands out at the call site. (Numeric values are *not* auto-unitized in `set` — pass full CSS values like `'10px'`.)

### Plugins

Cassida has two plugin layers, each operating at a different stage of the build:

| Layer | Stage | Use case | Example |
|---|---|---|---|
| **CSS plugins** | post-canonicalize, on `ScopeBag` tree | Mutate the rule structure (wrap scopes, expand pseudo-classes, prefix vendor properties) | `@cassida/plugin-hover-fix` |
| **Parser plugins** | pre-canonicalize, on Babel AST | Recognize non-default JSX-spread shapes that the chain walker doesn't claim | `@cassida/plugin-conditional` |
| **Vite-level plugins** | Vite's own plugin pipeline | Serve out-of-band stylesheets (preflight, resets, print) Cassida itself never emits | `@cassida/plugin-global-css` |

The fastest opt-in is `@cassida/recommended`, which bundles the maintainers' default-on set behind a single import:

```ts
// vite.config.ts
import cassida from '@cassida/vite-plugin';
import { recommended } from '@cassida/recommended';

export default defineConfig({
  plugins: [cassida(recommended()), react()],
});
```

#### `@cassida/plugin-hover-fix`

Wraps every `:hover` scope in `@media (hover: hover)` so iOS Safari's sticky-hover artifact never fires:

```css
/* without plugin */
.cas-X:hover { color: red }
/* with hoverFix */
@media (hover: hover) { .cas-X:hover { color: red } }
```

#### `@cassida/plugin-conditional`

Lifts `{...(cond ? cas().X() : cas().Y())}` and `{...(cond && cas().X())}` JSX spreads from runtime fallback into the build-time class table — each branch becomes its own `cas-XXXXXXXX` and the spread is rewritten to a ternary `className` expression:

```tsx
// before
<button {...(highlight ? cas().shadowXl() : cas().shadowMd()).props} />

// after build
<button className={highlight ? "cas-XXXXXXXX" : "cas-YYYYYYYY"} />
```

Both branches register independent CSS rules, so they participate in the standard dedup pipeline (a branch that matches a sibling bare-chain elsewhere shares the same hash). Dynamic-slot branches are supported too: `cond ? cas().color(theme.fg) : cas().color(theme.muted)` compiles each branch to its own class (with CSS-variable bindings) and emits a parallel `style={cond ? {...} : void 0}` ternary alongside the className one — the entire chain stays on the build-time path.

#### `@cassida/plugin-global-css`

Vite plugin that serves arbitrary global CSS — preflight, resets, body / tag-selector rules — through a virtual module, wrapped in a configurable `@layer` so it cooperates with Cassida's single-class output. Cassida's chains always emit exactly one class per element; this plugin fills the gap for rules like `body { ... }` or `*, ::before, ::after { ... }` without introducing a second styling system.

```ts
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import preflight from './preflight.css?raw';

cassidaGlobalCss({ css: preflight, layer: 'base' });
// then in main.tsx:
import 'virtual:cassida-global.css';
```

Defaults to `@layer base` so Cassida's classes in `@layer cas` win the cascade declaration `@layer base, cas;` without specificity bumps. Pass `layer: null` to skip the wrap, or `virtualId` to mount multiple instances (e.g. one for preflight, one for print).

#### `@cassida/plugin-print`

Conservative `@media print` defaults for any printable page. `printPreflight()` returns a CSS string with page-break hygiene for `pre` / `blockquote` / `tr` / `img`, black-on-white text (no shadows, no backgrounds), `widows`/`orphans` thresholds for body text, `display: table-header-group` on `thead` so printed tables repeat their header row, and external link URLs appended after the anchor text (`a[href]::after`). Adapted from HTML5 Boilerplate's print subset; rules are deliberately conservative so site-specific decisions (hiding `nav` / `footer`, brand fonts) stay in user code.

The factory returns a string and ships no delivery of its own — pair with `@cassida/plugin-global-css`:

```ts
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { printPreflight } from '@cassida/plugin-print';

cassidaGlobalCss({
  css: printPreflight(),
  layer: 'base',
  virtualId: 'virtual:cassida-print.css',
});
// then in main.tsx:
import 'virtual:cassida-print.css';
```

#### Custom composition

For projects that want a subset, skip `recommended` and import the factories directly — they're re-exported from `@cassida/recommended` for convenience:

```ts
import { hoverFix, conditionalSpread } from '@cassida/recommended';

cassida({
  plugins: [hoverFix({ query: '(hover: hover) and (pointer: fine)' })],
  parserPlugins: [conditionalSpread({ shortCircuit: false })],
});
```

Plugins run between collapse and hash (CSS) or before walk (parser), so flipping a plugin on or off changes hashes and invalidates browser caches cleanly. See [Plugin authoring](#plugin-authoring) for the contract.

### Mobile-first media sort

Source-order doesn't matter — the emitter sorts width-based queries deterministically:

```ts
cas()
  .media('(min-width: 1024px)', c => c.fontSize(24))
  .media('(min-width: 480px)',  c => c.fontSize(16))  // ← out of order, fine
  .media('(min-width: 768px)',  c => c.fontSize(20))
```

Output:

```css
@media (min-width: 480px)  { .cas-X { font-size: 16px } }
@media (min-width: 768px)  { .cas-X { font-size: 20px } }
@media (min-width: 1024px) { .cas-X { font-size: 24px } }
```

Mobile-first by default (configurable to desktop-first). em/rem are normalized at 16 px so they sort correctly relative to px. Non-width queries (`print`, `prefers-color-scheme`, ...) sort alphabetically and follow width-based ones.

### lightningcss postprocessing

Enable `css.lightningcss.enabled` in the config and the emitter pipes its output through [lightningcss](https://lightningcss.dev) for autoprefixing, minification, and target-aware downleveling. Browserslist is auto-discovered from `.browserslistrc` / `package.json#browserslist`; `css.lightningcss.targets` overrides if set. `@property` blocks survive untouched.

## Configuration

Place `cassida.config.json` at the project root:

```jsonc
{
  "$schema": "./node_modules/@cassida/compiler/config.schema.json",

  "layer": "cas",                 // @layer name; null disables wrapping
  "importSource": "@cassida/core",

  "hash": {
    "prefix": "cas-",
    "length": 8                   // 4–40; collisions throw (loud > silent)
  },

  "media": {
    "sort": "mobile-first"        // | "desktop-first"
  },

  "shorthand": {
    "policy": "strict"            // | "shorthand-first" | "lenient"
  },

  "css": {
    "mode": "rule-per-class",     // | "shared-by-declaration" (Phase 4+, recognized)
    "lightningcss": {
      "enabled": false,
      "minify": true,
      "targets": "defaults"        // browserslist string; auto-discovered if omitted
    }
  }
}
```

The schema is enforced by Zod. Unknown keys, out-of-range values, and invalid enums fail the build with a precise error pointing to the file path:

```
[cassida] invalid configuration in /proj/cassida.config.json:
  - hash.length: Number must be greater than or equal to 4
  - <root>: Unrecognized key(s) in object: 'badField'
```

Plugin options in `vite.config.ts` go through the same validator. Plugin instances themselves (functions) live in inline options only — they're not JSON-serializable.

## Common pitfalls

### "shorthand cannot follow longhand" / vice versa

```ts
cas().padding(10).paddingTop(20)
// → build error
```

Why: Cassida's emitter sorts declarations alphabetically inside a rule; CSS cascade then picks `padding-top` because it's lexicographically later than `padding`. But chain-order LIFO would have `padding` win. To prevent the silent disagreement, `shorthand.policy: 'strict'` (default) bans the co-occurrence in both directions. Three escape hatches:

1. Use a modifier scope: `cas().padding(10).media('(min-width: 768px)', c => c.paddingTop(20))`
2. Switch policy: `"shorthand": { "policy": "shorthand-first" }` allows longhand→shorthand
3. Pick one form: longhands only OR the shorthand alone

### `cas({ background: 'red' })` is rejected

`background` is a real CSS shorthand (writes color, image, position, repeat, ...); aliasing it as a single-property write would lie about CSS. The safe `cas(preset)` type rejects it. Use:

```ts
<div {...cas.unsafe({ background: 'linear-gradient(...)' }).props} />
```

Same applies to `font`, `border`, `flex`, `grid`, `transition`, `animation`, etc. All are reachable via `cas.unsafe` or `.set('background', '...')`.

### Non-literal arguments don't cause an error

```ts
function Box({ tone }: { tone: string }) {
  return <div {...cas().color(tone).props} />;
}
```

This compiles fine — `tone` becomes a CSS variable, the className is computed from the chain's *shape*. The hash is stable across builds even when `tone` is wired to user input or random state. If the value is statically evaluable at build time — `THEME.primary` from a local const, or `theme.brand.primary` imported from another module via the [cross-file evaluator](#cross-file-design-tokens) — it's inlined as a literal instead of becoming a variable.

### `Math.random()` in a chain

```ts
cas().opacity(Math.random())
```

Babel's `path.evaluate()` returns `confident: false` for `Math.random()`, so the value falls through to the dynamic-CSS-variable path. Critically, the hash is derived from the chain's *structure* (here: `opacity` is dynamic), not the runtime value — so the build is deterministic across runs.

## Packages

| Package | Purpose |
|---|---|
| [`@cassida/core`](./packages/core)        | Runtime `cas()` chain builder. Replaced at build time for static chains. |
| [`@cassida/compiler`](./packages/compiler)    | Pure compile-time core: registry, canonicalizer, hasher, emitter, plugin pipeline. |
| [`@cassida/parser`](./packages/parser)      | Babel-based AST transform. Detects chains in JSX spread and rewrites them. Hosts the parser-plugin extension point (`CassParserPlugin`). |
| [`@cassida/vite-plugin`](./packages/vite-plugin) | Vite integration. Per-file virtual CSS module + lightningcss postprocess. |
| [`@cassida/recommended`](./packages/recommended) | Curated bundle factory. One-line opt-in for the maintainers' default plugin set. |
| [`@cassida/plugin-hover-fix`](./packages/plugin-hover-fix) | First-party CSS plugin: gates `:hover` in `@media (hover: hover)` for iOS sticky-hover. |
| [`@cassida/plugin-conditional`](./packages/plugin-conditional) | First-party parser plugin: lifts conditional / short-circuit JSX spreads to build-time classes. |
| [`@cassida/plugin-global-css`](./packages/plugin-global-css) | First-party Vite plugin: serves preflight / reset / tag-selector CSS through a virtual module, wrapped in a configurable cascade `@layer`. |
| [`@cassida/plugin-print`](./packages/plugin-print) | Companion factory: `printPreflight()` returns a CSS string of conservative `@media print` defaults (page-break hygiene, black-on-white, link-href expansion). Pair with `@cassida/plugin-global-css` for delivery. |

Most consumers install three packages: `@cassida/core` (runtime), `@cassida/vite-plugin` (build-time integration), and `@cassida/recommended` (which brings the default plugin set as transitive deps). The other packages are workspace internals plus opt-in factories for bespoke composition.

## Architecture

```
source.tsx                                       (your code)
  │  <div {...cas().mt(10,'em').color('red').color('blue').props} />
  ▼
@cassida/parser                                  (Babel AST)
  │  collects Op[] from chain:
  │    [(mt, [10,'em']), (color, ['red']), (color, ['blue'])]
  ▼
@cassida/compiler                                (pure functions)
  │  Canonicalizer.collapse → ScopeBag tree (LIFO inside scopes)
  │  pluginPipeline         → optional ScopeBag transforms
  │  canonicalKey           → JSON-encoded sorted form
  │  hash                   → "cas-3702b738"
  ▼
parser rewrites JSX                              (back to source code)
  │  <div className="cas-3702b738" />
  ▼
@cassida/vite-plugin                             (Rollup hooks)
  │  injects per-file: import "virtual:cassida.css?file=<id>"
  │  load(virtual...)        → emitter + stylis flatten + lightningcss
  ▼
output                                           (zero-runtime)
  │  <div className="cas-3702b738" />
  │  @layer cas { .cas-3702b738 { color: blue; margin-top: 10em } }
```

Key invariants:

- **Deterministic hashing**: same canonical bag → same className, regardless of file location, method-call order, or alias usage (`mt` vs `marginTop`).
- **Plugin pipeline lives between collapse and hash**, so plugins are part of the bijection — different plugin set means different hash, cleanly invalidating caches.
- **Per-file virtual CSS**: each transformed JSX file gets its own `virtual:cassida.css?file=<id>` so Rollup load order doesn't race against parser transform completion.

## Plugin authoring

Cassida has two plugin interfaces, each for a different phase of the build.

### CSS plugins (`CassPlugin`)

Sync, pure, immutable transform from `ScopeBag` to `ScopeBag`. Runs after canonicalize, before hash:

```ts
import {
  mapScopeBag, wrapInMediaScope,
  type CassPlugin, type ScopeBag,
} from '@cassida/compiler';

export default function darkModePlugin(): CassPlugin {
  return {
    name: 'my-dark-mode',
    transform(tree: ScopeBag): ScopeBag {
      return mapScopeBag(tree, (node) => {
        // ... your logic — return a new node, or null to leave as-is ...
      });
    },
  };
}
```

Contract:

- **Sync**: build determinism + zero microtask cost on the hot path.
- **Pure**: same input must always produce the same output.
- **Immutable**: return a new tree. `mapScopeBag` / `wrapInMediaScope` keep this ergonomic and fast (input returned reference-equal when nothing matched).
- **Hash-aware**: any change you make to the tree changes the className. That's the design — plugins are part of the compile.

Reference: `packages/plugin-hover-fix/src/index.ts` — ~30 lines.

### Parser plugins (`CassParserPlugin`)

Claim JSX-spread shapes that the default chain walker doesn't recognize. Runs before canonicalize, on raw Babel AST:

```ts
import * as t from '@babel/types';
import type {
  CassParserPlugin, ParserPluginHelpers, SpreadPlan,
} from '@cassida/parser';

export const conditionalSpread = (): CassParserPlugin => ({
  name: 'my-conditional',
  trySpread(argPath, helpers): SpreadPlan | null {
    if (!argPath.isConditionalExpression()) return null;
    const cOps = helpers.walkChain(helpers.peelPropsAccess(argPath.get('consequent')));
    const aOps = helpers.walkChain(helpers.peelPropsAccess(argPath.get('alternate')));
    if (!cOps || !aOps) return null;
    const cRule = helpers.compileOps(cOps);
    const aRule = helpers.compileOps(aOps);
    return {
      rules: [cRule, aRule],
      buildAttrs(existing) {
        const ternary = t.conditionalExpression(
          t.cloneNode(argPath.node.test),
          t.stringLiteral(cRule.className),
          t.stringLiteral(aRule.className),
        );
        return [helpers.makeClassNameAttr(existing.className, ternary)];
      },
    };
  },
});
```

The `helpers` object exposes the parser's own internals (`walkChain`, `compileOps`, `peelPropsAccess`, `makeClassNameAttr`, `makeStyleAttr`, `registerDynamicSource`) so plugins compose existing logic instead of re-implementing chain walking or className merging.

Contract:

- **First-match wins**: each registered plugin's `trySpread` is invoked in order; the first non-null `SpreadPlan` claims the spread. Return `null` conservatively so other plugins get a turn.
- **No side effects on bail**: helpers are safe to call during a probe, but plugins shouldn't register external state unless they're going to return a plan.
- **Multi-spread guard**: an element with one bare-chain spread *and* one plugin-claimed spread still throws — Single Class Principle applies regardless of which path claimed each.
- **Clone before re-parenting**: when lifting nodes from the original AST into a synthesized expression, use `t.cloneNode` to avoid Babel parent-pointer confusion.

Reference: `packages/plugin-conditional/src/index.ts` — ~150 lines covering both `ConditionalExpression` and `LogicalExpression &&`.

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1     | ✅ | Dynamic values via per-element CSS vars + `@property` |
| 2     | ✅ | Pseudo / media / nested scopes via callback API |
| 3     | ✅ | `cassida.config.json` + mobile-first media sort |
| 4     | ✅ | Zod boundaries + parser path-narrowing |
| 5     | ✅ | lightningcss postprocessing + browserslist auto-discover |
| 6a    | ✅ | `shorthand.policy` + family-aware padding/margin/inset |
| 6b    | ✅ | mdn-data codegen — 462 standard CSS properties |
| 6c-1  | ✅ | `cas(preset)` + `cas.unsafe(preset)` |
| 6c-2  | ✅ | Same-file function composition (`withCard(cas())`) |
| 6c-3  | ✅ | `set()` escape hatch + opaque animation/transition/transform |
| 8a    | ✅ | CSS plugin system + `@cassida/plugin-hover-fix` |
| 7     | ✅ | Cross-file static evaluation — design tokens fold to static classes (`v0.2.0`) |
| —     | ✅ | `.props` terminator — chain methods hidden from JSX prop typings (`v0.3.0`) |
| —     | ✅ | Parser plugin extension point + `@cassida/plugin-conditional` + `@cassida/recommended` bundle (`v0.4.0`) |
| —     | ✅ | Multi-property utilities (`.px`, `.py`, `.mx`, `.my`) — multi-longhand registry (`v0.4.0`) |
| —     | ✅ | Dynamic-slot support in conditional spreads — `cond ? cas().color(theme.fg) : ...` (`v0.4.0`) |
| —     | ✅ | `@cassida/plugin-print` — `@media print` defaults (`v0.5.0`) |
| —     | ✅ | `@cassida/plugin-global-css` — virtual-module preflight (`v0.4.0`) |
| —     | ✅ | `.cond()` inside modifier scopes — `.hover(c => c.cond(...))` lifts to build time |
| —     | ✅ | TypeScript path-alias resolution — `@/tokens` style imports fold cross-file (auto-discovers `tsconfig.json` paths) |
| —     | 💭 | Additional first-party plugins (dark-mode duplicator, prefers-reduced-motion fallback) |
| —     | 💭 | SWC plugin port for Next.js native integration |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development guide, conventions, and release process. The short version:

This is a pnpm workspace. Node ≥ 20 required.

```bash
pnpm install
pnpm -r --filter='./packages/*' build       # build all packages
pnpm -r --filter='./packages/*' test        # vitest (334 tests)
pnpm -r typecheck                            # tsc strict across packages

# Regenerate the mdn-data-derived spec (after upgrading mdn-data)
pnpm --filter @cassida/compiler codegen

# E2E playground
cd examples/playground && pnpm dev          # http://localhost:5173
cd examples/playground && pnpm build        # produces dist/ to inspect
```

Conventional commit messages, no AI-attribution trailers. Tests are required for new behavior; type-only assertions live in `*.test-d.ts` (checked by tsc, skipped by vitest's runtime).

## License

[MIT](./LICENSE)
