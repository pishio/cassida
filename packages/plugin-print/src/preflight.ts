/**
 * Default `@media print` ruleset.
 *
 * Adapted from the HTML5 Boilerplate project's print-stylesheet
 * subset (MIT-licensed). The rules are the conservative,
 * widely-applicable defaults that any print output benefits from —
 * no opinionated typography, page-size, or color palette decisions.
 *
 * What this covers:
 *
 *   1. Reset every element to black-on-white with no shadows /
 *      backgrounds. NOTE: no `!important` here. CSS Cascade Layers
 *      flip the precedence on important declarations — `!important`
 *      in earlier layers (e.g. `base`) wins over `!important` in
 *      later ones (`cas`), which would lock users out of overriding
 *      a brand-color print page even when they wrote `!important`
 *      themselves. Without it, the layer declaration `@layer base,
 *      cas;` plus class-vs-universal specificity lets explicit cas
 *      colors flow through to print, while elements without an
 *      explicit color still default to ink-saving black.
 *   2. Append the `href` URL after every *absolute* external link —
 *      either `http`/`https` or protocol-relative `//host/...`.
 *      Relative paths (`/about`, `./contact`) are intentionally not
 *      expanded: they print without the origin and would render as
 *      uninformative fragments next to the visible text. Anchors with
 *      non-web schemes (`mailto:`, `tel:`, `javascript:`) are also
 *      excluded — the visible text already describes them.
 *   3. Help printers keep blocks together: avoid breaking inside
 *      `pre`, `blockquote`, `tr`, `img`. Don't orphan headings.
 *      Uses the modern `break-inside` / `break-after` properties
 *      (CSS Fragmentation 3) — the legacy `page-break-*` names are
 *      aliased by every browser still in support and not worth
 *      shipping a second declaration for.
 *   4. Restore `thead` as a table-header-group so printed tables
 *      repeat their header row across pages.
 *
 * No element is hidden by default. Users hide nav / buttons / forms
 * for their specific site by adding rules on top of the preflight
 * (those decisions are too site-specific for a library default).
 */
export const DEFAULT_PRINT_PREFLIGHT = `@media print {
  *,
  *::before,
  *::after {
    background: transparent;
    color: #000;
    box-shadow: none;
    text-shadow: none;
  }

  a,
  a:visited {
    text-decoration: underline;
  }

  a[href^="http"]::after,
  a[href^="//"]::after {
    content: " (" attr(href) ")";
  }

  pre {
    white-space: pre-wrap;
  }
  pre,
  blockquote {
    border: 1px solid #999;
    break-inside: avoid;
  }

  tr {
    break-inside: avoid;
  }

  img {
    break-inside: avoid;
    /* Prevent oversized images from being clipped by the page
       margins; the wider dimension scales down to fit. */
    max-width: 100%;
  }

  p,
  h2,
  h3 {
    orphans: 3;
    widows: 3;
  }

  h2,
  h3 {
    break-after: avoid;
  }

  thead {
    display: table-header-group;
  }
}
`;
