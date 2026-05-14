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

    it('appends the `href` URL after absolute external links only', () => {
      // Absolute web URLs (`http`, `https`) and protocol-relative
      // (`//host/...`) get the expansion. Relative paths (`/about`)
      // and non-web schemes (`mailto:`, `tel:`, `javascript:`) are
      // skipped — their expanded form would be uninformative noise
      // on a printed page.
      expect(css).toMatch(
        /a\[href\^="http"\]::after,\s*a\[href\^="\/\/"\]::after\s*\{[^}]*content:\s*" \(" attr\(href\) "\)"/,
      );
    });

    it('keeps `pre` / `blockquote` / `tr` / `img` from breaking across pages (modern `break-inside`)', () => {
      expect(css).toMatch(/pre,\s*blockquote\s*\{[^}]*break-inside:\s*avoid/);
      expect(css).toMatch(/tr\s*\{[^}]*break-inside:\s*avoid/);
      expect(css).toMatch(/img\s*\{[^}]*break-inside:\s*avoid/);
      // Sanity: the legacy alias should NOT also appear — having both
      // double-emits the same constraint and signals stale CSS.
      expect(css).not.toMatch(/page-break-inside/);
    });

    it('caps `img` width at the page area to prevent margin clipping', () => {
      expect(css).toMatch(/img\s*\{[^}]*max-width:\s*100%/);
    });

    it('sets widow / orphan thresholds for paragraph text only', () => {
      // Headings are typically single-line; applying `orphans` /
      // `widows` to them would silently force unwanted page breaks on
      // a long heading. The constraints belong on multi-line block
      // containers. Threshold of 2 catches true singletons without
      // making 3-5 line paragraphs ineligible for page-end placement.
      expect(css).toMatch(/\bp\s*\{[^}]*orphans:\s*2[^}]*widows:\s*2/);
    });

    it('avoids breaking immediately after any heading level', () => {
      // h1 included alongside h2 / h3 — a top-level heading orphaned
      // at page-end from its body is just as bad as a subsection one.
      expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*break-after:\s*avoid/);
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
