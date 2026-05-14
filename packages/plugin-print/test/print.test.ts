import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_PREFLIGHT, printPreflight } from '../src/index.js';

describe('printPreflight()', () => {
  it('returns a non-empty CSS string by default', () => {
    const css = printPreflight();
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  it('is wrapped in `@media print` — never affects screen rendering', () => {
    const css = printPreflight();
    expect(css.trimStart()).toMatch(/^@media print \{/);
    // No leaking rules outside the @media block.
    const openCount = (css.match(/@media print/g) ?? []).length;
    expect(openCount).toBe(1);
  });

  it('returns the same value across calls (no per-call mutation)', () => {
    expect(printPreflight()).toBe(printPreflight());
    expect(printPreflight()).toBe(DEFAULT_PRINT_PREFLIGHT);
  });

  it('takes no arguments — extensions compose via string concatenation', () => {
    // Documented contract: callers wanting site-specific additions
    // do `printPreflight() + "@media print { ... }"`. The function
    // itself is opinion-free beyond the bundled defaults.
    expect(printPreflight.length).toBe(0);
  });

  describe('bundled defaults', () => {
    const css = printPreflight();

    it('zeroes backgrounds, shadows, and defaults text to black for ink savings', () => {
      // No !important — cascade-layer semantics flip the precedence
      // for important declarations, which would lock users out of
      // explicitly choosing a brand-color print page from @layer cas.
      expect(css).toMatch(/background:\s*transparent;/);
      expect(css).toMatch(/color:\s*#000;/);
      expect(css).toMatch(/box-shadow:\s*none;/);
      expect(css).toMatch(/text-shadow:\s*none;/);
      // Explicit assertion: !important is absent from the universal
      // selector. A regression here would silently break override
      // semantics for cascade-layer consumers.
      expect(css).not.toMatch(/!important/);
    });

    it('appends the `href` URL after absolute external links only, with break-word wrapping', () => {
      // Strict-prefix selectors (the trailing `://` matters): a bare
      // `[href^="http"]` would also match a relative `http-server.pdf`,
      // a real false-positive. Explicit `http://` / `https://` plus
      // protocol-relative `//host/...` is the correct shape.
      // Relative paths (`/about`) and non-web schemes (`mailto:`,
      // `tel:`, `javascript:`) stay out — their expanded form is
      // uninformative noise on a printed page. `overflow-wrap:
      // break-word` keeps long URLs from running off the page.
      const block = css.match(
        /a\[href\^="http:\/\/"\]::after,\s*a\[href\^="https:\/\/"\]::after,\s*a\[href\^="\/\/"\]::after\s*\{[^}]*\}/,
      );
      expect(block).not.toBeNull();
      expect(block![0]).toMatch(/content:\s*" \(" attr\(href\) "\)"/);
      expect(block![0]).toMatch(/overflow-wrap:\s*break-word/);
    });

    it('expands `abbr[title]` so abbreviations carry their long form in print', () => {
      // Classic H5BP idiom — single source of truth for the long
      // form is the `title` attribute, so screen readers and print
      // readers see the same expansion.
      expect(css).toMatch(
        /abbr\[title\]::after\s*\{[^}]*content:\s*" \(" attr\(title\) "\)"/,
      );
    });

    it('keeps `pre` / `blockquote` / `tr` / media from breaking across pages', () => {
      expect(css).toMatch(/pre,\s*blockquote\s*\{[^}]*break-inside:\s*avoid/);
      expect(css).toMatch(/tr\s*\{[^}]*break-inside:\s*avoid/);
      expect(css).toMatch(
        /img,\s*svg,\s*video,\s*canvas\s*\{[^}]*break-inside:\s*avoid/,
      );
      // Sanity: the legacy alias should NOT also appear — having both
      // double-emits the same constraint and signals stale CSS.
      expect(css).not.toMatch(/page-break-inside/);
    });

    it('caps media width and preserves aspect ratio across img / svg / video / canvas', () => {
      // The shared media rule covers raster images, inline SVGs,
      // <video> (prints its poster) and <canvas> (charts /
      // visualisations) — all overflow the printable area otherwise.
      // `height: auto` paired with the width clamp prevents a fixed
      // CSS or HTML-attribute height from leaving the box distorted.
      const block = css.match(/img,\s*svg,\s*video,\s*canvas\s*\{[^}]*\}/);
      expect(block).not.toBeNull();
      expect(block![0]).toMatch(/max-width:\s*100%/);
      expect(block![0]).toMatch(/height:\s*auto/);
    });

    it('sets widow / orphan thresholds for paragraph and list-item text', () => {
      // Headings are typically single-line; applying `orphans` /
      // `widows` to them would silently force unwanted page breaks on
      // a long heading. The constraints belong on multi-line block
      // containers. Threshold of 2 catches true singletons without
      // making 3-5 line paragraphs ineligible for page-end placement.
      // `li` joins `p` because list items in technical / academic
      // docs frequently carry multi-line prose.
      expect(css).toMatch(/p,\s*li\s*\{[^}]*orphans:\s*2[^}]*widows:\s*2/);
    });

    it('avoids breaking immediately after any heading level (h1-h6)', () => {
      // All heading levels — a subsection (h4 / h5 / h6) orphaned at
      // page-end from its body is just as bad as a top-level h1.
      // Including the deeper levels costs nothing.
      expect(css).toMatch(
        /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*break-after:\s*avoid/,
      );
      expect(css).not.toMatch(/page-break-after/);
    });

    it('repeats table header AND footer rows across pages', () => {
      expect(css).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/);
      // tfoot must be table-footer-group — table-header-group would
      // flip the footer to the top of each page-break section.
      expect(css).toMatch(/tfoot\s*\{[^}]*display:\s*table-footer-group/);
    });

    it('rewraps `pre` blocks so long lines do not run off the page', () => {
      expect(css).toMatch(/pre\s*\{[^}]*white-space:\s*pre-wrap/);
    });
  });

  describe('composition with `@cassida/plugin-global-css`', () => {
    it('the output is suitable as the `css` option for cassidaGlobalCss', () => {
      // Smoke-test: the return value is a plain string with balanced
      // braces (open == close), so feeding it into a `@layer X { ... }`
      // wrapper produces syntactically valid CSS.
      const css = printPreflight();
      const opens = (css.match(/\{/g) ?? []).length;
      const closes = (css.match(/\}/g) ?? []).length;
      expect(opens).toBe(closes);
    });
  });
});
