# @cassida/plugin-print

Companion plugin for Cassida that ships a `printPreflight()` factory
returning a CSS string of conservative `@media print` defaults — the
kind of preflight every printable page benefits from regardless of
site design.

Cassida is a CSS-mania library, so print styling is a first-class
concern out of the box.

## What's in the preflight

- **Black-on-white, no shadows / backgrounds.** Saves ink and makes
  copy legible. The user opts back in when they actually need a
  brand-color page.
- **External link URLs appended.** `a[href]::after { content: " (" attr(href) ")" }`
  for every external anchor; in-page (`#`), `mailto:`, and `tel:`
  links are skipped because their text already describes them.
- **Page-break hygiene.** `pre`, `blockquote`, `tr`, `img` don't
  break across pages. Headings (`h2`, `h3`) don't orphan onto a new
  page from their bodies. Body text uses `orphans: 3` / `widows: 3`.
- **Table header repetition.** `thead` is restored to
  `display: table-header-group` so printed tables repeat their header
  row across page boundaries.
- **Pre wrapping.** `pre { white-space: pre-wrap !important }` so
  long source lines don't fall off the page edge.

The rules are adapted from the well-known HTML5 Boilerplate print
stylesheet subset (MIT-licensed). They are deliberately conservative;
opinionated decisions like "hide `nav` / `footer` / `button`" stay
out of the library default because they're site-specific.

## Install

```bash
pnpm add @cassida/plugin-print
pnpm add -D @cassida/plugin-global-css   # peer for delivery
```

## Use

`printPreflight()` returns a CSS string. It does not ship its own
stylesheet delivery — pair it with `@cassida/plugin-global-css` to
mount the rules through Vite's CSS pipeline:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { cassida } from '@cassida/vite-plugin';
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { recommended } from '@cassida/recommended';
import { printPreflight } from '@cassida/plugin-print';

export default defineConfig({
  plugins: [
    cassida(recommended()),
    cassidaGlobalCss({
      css: printPreflight(),
      layer: 'base',
      virtualId: 'virtual:cassida-print.css',
    }),
  ],
});
```

```ts
// main.tsx
import 'virtual:cassida-print.css';
```

The bundled rules are wrapped in `@media print` so they only affect
print output; screen rendering is untouched. The default `@layer base`
wrap pairs with the cascade declaration `@layer base, cas;` so any
Cassida classes you set print-specific overrides on still win without
specificity tricks.

## Site-specific extensions

To tack on rules that hide your site's nav / footer / interactive
controls (which the library default deliberately doesn't touch),
concatenate or override:

```ts
cassidaGlobalCss({
  css: printPreflight() + `
    @media print {
      nav, footer, button, [aria-hidden="true"] {
        display: none !important;
      }
      body {
        font-family: Garamond, "Times New Roman", serif;
      }
    }
  `,
  layer: 'base',
  virtualId: 'virtual:cassida-print.css',
});
```

Or replace the bundled defaults entirely:

```ts
printPreflight({ css: myOwnPrintCss })  // returns myOwnPrintCss as-is
```

## License

MIT © pishio. Bundled print-rule subset adapted from HTML5 Boilerplate (MIT).
