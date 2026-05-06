<!--
  Cassida — One element, one class. Compiled, not cascaded.
-->

# Cassida

[![@cassida/core](https://img.shields.io/npm/v/%40cassida%2Fcore?label=%40cassida%2Fcore&color=2ea44f)](https://www.npmjs.com/package/@cassida/core)
[![@cassida/vite-plugin](https://img.shields.io/npm/v/%40cassida%2Fvite-plugin?label=%40cassida%2Fvite-plugin&color=2ea44f)](https://www.npmjs.com/package/@cassida/vite-plugin)
[![@cassida/plugin-hover-fix](https://img.shields.io/npm/v/%40cassida%2Fplugin-hover-fix?label=%40cassida%2Fplugin-hover-fix&color=2ea44f)](https://www.npmjs.com/package/@cassida/plugin-hover-fix)
[![license MIT](https://img.shields.io/npm/l/%40cassida%2Fcore?color=blue)](./LICENSE)

> **One element, one class — compiled, not cascaded.**

A build-time CSS-in-JS compiler. Cassida collapses every styling chain to **exactly one class per element** via LIFO resolution at build time; the browser never computes specificity for Cassida-generated rules. Every `:hover`, `@media`, and nested rule sits inside a single `@layer cas` cascade layer with one stable class hash.

```tsx
import { cas } from '@cassida/core';

<button {...cas()
  .padding(12).backgroundColor('#1a73e8').color('white')
  .hover(c => c.backgroundColor('#1557b0'))
  .focus(c => c.backgroundColor('#0e3f87'))} />
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

**v0.1.1** — packaging hardening over the v0.1.0 first release.
The API is stable across the documented surface but versions are 0.x; expect breaking changes between minor versions until 1.0. The feature set described below is implemented and covered by 174 unit tests across 5 packages, plus an end-to-end CI smoke test that builds a real consumer against the tarballs on Vite 5 / 6 / 7 and Bun.

```bash
pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin
# optional plugin
pnpm add -D @cassida/plugin-hover-fix
```

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
pnpm add -D @cassida/vite-plugin
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';

export default defineConfig({
  plugins: [cassida(), react()],
});
```

`App.tsx`:

```tsx
import { cas } from '@cassida/core';

export default function App() {
  return (
    <main {...cas().padding(24).maxWidth(720)}>
      <h1 {...cas().color('crimson').fontSize(28)}>Hello, Cassida.</h1>
    </main>
  );
}
```

That's it. Open DevTools: each element has exactly one `cas-xxxxxxxx` class, and every rule lives inside `@layer cas`.

`cas` is the canonical name; `css` and `cassida` are aliases for the same function — pick whichever reads best in your codebase. (Note: `css` collides with `emotion` / `vanilla-extract`; if you use those alongside Cassida, prefer `cas` or alias explicitly.)

## Why Cassida

There are roughly two camps in CSS-in-JS today:

1. **Runtime libraries** (styled-components, emotion): elegant ergonomics, but variable names become a fog you have to maintain — `StyledButtonBase`, `StyledButtonBaseWithIcon`, `StyledButtonBaseWithIconLarge` — and the JS bundle ships a CSS engine.
2. **Atomic CSS** (Tailwind): no runtime, but every element accumulates a forest of utility classes — `class="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded"` — and the browser still does the cascade work to assemble them.

Cassida picks a third path:

- **No runtime fog.** The build replaces `{...cas().a().b()}` with `className="cas-XXXXXXXX"`. Production bundles contain *zero* `cas(` calls.
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
<div {...cas().color('crimson').padding(12)} />
// File B
<div {...cas().padding(12).color('crimson')} />
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

The build-time parser walks `withCard`'s body, splices the ops into the input chain, and produces a single class for the merged surface. Phase 6c-2 supports same-file `const` arrow functions and `function` declarations with one `CassChain` param. Cross-file composition is on the [roadmap](#roadmap).

### Constant injection — `cas(preset)`

Receive a static design token object and continue from there:

```ts
const card = { padding: 12, borderRadius: 8, backgroundColor: '#fff' } as const;

<div {...cas(card).marginTop(16).color('#222')} />
//          ^^^^ same hash whether `card` is in this file or imported
```

`path.evaluate()` resolves const-bound objects across files (within Babel's confidence boundary). Non-confident inputs fall through to runtime inline-style.

### Dynamic values — auto CSS variables

When an argument is non-literal, Cassida promotes the property to a CSS custom property without breaking the Single Class:

```ts
function ThemedBox({ accent }: { accent: string }) {
  return <div {...cas().color(accent).padding(16)} />;
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
<div {...cas.unsafe({ background: 'linear-gradient(...)' }).marginTop(16)} />

// Direct CSS property write inside a chain
cas()
  .set('--brand-scale', 1.5)
  .set('-webkit-tap-highlight-color', 'transparent')
  .padding(12)
```

Both bypass the registry, the shorthand-policy guard, and family tracking. The escape is named explicitly so accidental misuse stands out at the call site. (Numeric values are *not* auto-unitized in `set` — pass full CSS values like `'10px'`.)

### Plugins — `@cassida/plugin-hover-fix`

```ts
// vite.config.ts
import cassida from '@cassida/vite-plugin';
import hoverFix from '@cassida/plugin-hover-fix';

export default defineConfig({
  plugins: [cassida({ plugins: [hoverFix()] }), react()],
});
```

`hoverFix` wraps every `:hover` scope in `@media (hover: hover)` so iOS Safari's sticky-hover artifact never fires:

```css
/* without plugin */
.cas-X:hover { color: red }
/* with hoverFix */
@media (hover: hover) { .cas-X:hover { color: red } }
```

Plugins run between collapse and hash, so the className itself reflects the post-plugin tree — turning a plugin on or off changes hashes and invalidates browser caches cleanly. See [Plugin authoring](#plugin-authoring) for the contract.

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
<div {...cas.unsafe({ background: 'linear-gradient(...)' })} />
```

Same applies to `font`, `border`, `flex`, `grid`, `transition`, `animation`, etc. All are reachable via `cas.unsafe` or `.set('background', '...')`.

### Non-literal arguments don't cause an error

```ts
function Box({ tone }: { tone: string }) {
  return <div {...cas().color(tone)} />;
}
```

This compiles fine — `tone` becomes a CSS variable, the className is computed from the chain's *shape*. The hash is stable across builds even when `tone` is wired to user input or random state. If the value is confidently evaluable at build time (e.g. `THEME.primary` from a const), it's inlined as a literal instead of becoming a variable.

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
| [`@cassida/parser`](./packages/parser)      | Babel-based AST transform. Detects chains in JSX spread and rewrites them. |
| [`@cassida/vite-plugin`](./packages/vite-plugin) | Vite integration. Per-file virtual CSS module + lightningcss postprocess. |
| [`@cassida/plugin-hover-fix`](./packages/plugin-hover-fix) | First-party plugin: gates `:hover` in `@media (hover: hover)` for iOS sticky-hover. |

Most consumers install only `@cassida/core` (runtime) and `@cassida/vite-plugin` (build-time integration); the other packages are workspace internals.

## Architecture

```
source.tsx                                       (your code)
  │  <div {...cas().mt(10,'em').color('red').color('blue')} />
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

A Cassida plugin is a sync, pure, immutable transform from `ScopeBag` to `ScopeBag`:

```ts
import {
  mapScopeBag, wrapInMediaScope,
  type CassPlugin, type ScopeBag,
} from '@cassida/compiler';

export default function darkModePlugin(): CassPlugin {
  return {
    name: 'my-dark-mode',
    transform(tree: ScopeBag): ScopeBag {
      // Walk the tree bottom-up; return a new tree (input is never mutated).
      return mapScopeBag(tree, (node) => {
        // ... your logic — return a new node, or null to leave as-is ...
      });
    },
  };
}
```

The contract:

- **Sync**: build determinism + zero microtask cost on the hot path. Async plugins are intentionally not supported in v1.
- **Pure**: same input must always produce the same output. Cross-call state belongs in your factory closure, not the plugin object.
- **Immutable**: return a new tree. Helpers like `mapScopeBag` and `wrapInMediaScope` make this ergonomic and fast (the input tree is returned reference-equal when nothing matched).
- **Hash-aware**: any change you make to the tree changes the className. That's the design — plugins are part of the compile, not a post-processor.

See `packages/plugin-hover-fix/src/index.ts` for a 30-line reference implementation.

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
| 8a    | ✅ | Plugin system + `@cassida/plugin-hover-fix` |
| 7     | 🚧 | Cross-file static evaluation (Linaria-class) |
| —     | 💭 | Additional first-party plugins (dark-mode duplicator, prefers-reduced-motion fallback) |
| —     | 💭 | SWC plugin port for Next.js native integration |

## Contributing

This is a pnpm workspace. Node ≥ 20 required.

```bash
pnpm install
pnpm -r --filter='./packages/*' build       # build all packages
pnpm -r --filter='./packages/*' test        # vitest (172+ tests)
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
