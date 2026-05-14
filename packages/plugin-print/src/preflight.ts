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
 *      backgrounds. Modern print drivers honor `print-color-adjust`
 *      (and its WebKit-prefixed counterpart) when a stylesheet wants
 *      backgrounds preserved — but Cassida's preflight defaults are
 *      "save ink, prefer legibility" and the user opts back in when
 *      they actually need a brand-color page.
 *   2. Append the `href` URL after every external link (`a[href]`).
 *      Skip in-page anchors (`href="#..."`) and `mailto:` / `tel:`
 *      links — the visible text already describes those.
 *   3. Help printers keep blocks together: avoid breaking inside
 *      `pre`, `blockquote`, `tr`, `img`. Don't orphan headings.
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
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  a,
  a:visited {
    text-decoration: underline;
  }

  a[href]:not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"])::after {
    content: " (" attr(href) ")";
  }

  pre {
    white-space: pre-wrap !important;
  }
  pre,
  blockquote {
    border: 1px solid #999;
    page-break-inside: avoid;
  }

  tr,
  img {
    page-break-inside: avoid;
  }

  p,
  h2,
  h3 {
    orphans: 3;
    widows: 3;
  }

  h2,
  h3 {
    page-break-after: avoid;
  }

  thead {
    display: table-header-group;
  }
}
`;
