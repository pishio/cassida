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

  it('passes through a custom `css` override unchanged', () => {
    const custom = '@media print { body { font-family: Garamond, serif; } }';
    expect(printPreflight({ css: custom })).toBe(custom);
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

    it('avoids orphaned headings and sets widow / orphan thresholds for body text', () => {
      expect(css).toMatch(/orphans:\s*3/);
      expect(css).toMatch(/widows:\s*3/);
      expect(css).toMatch(/h2,\s*h3\s*\{[^}]*break-after:\s*avoid/);
      expect(css).not.toMatch(/page-break-after/);
    });

    it('restores `thead` as a table-header-group so tables repeat headers across pages', () => {
      expect(css).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/);
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
