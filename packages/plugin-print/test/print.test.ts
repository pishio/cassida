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

    it('zeroes backgrounds, shadows, and force-blacks text for ink savings', () => {
      expect(css).toMatch(/background:\s*transparent\s*!important/);
      expect(css).toMatch(/color:\s*#000\s*!important/);
      expect(css).toMatch(/box-shadow:\s*none\s*!important/);
      expect(css).toMatch(/text-shadow:\s*none\s*!important/);
    });

    it('appends the `href` URL after external links only', () => {
      // The `::after` rule must be scoped to anchors that are NOT
      // in-page (`#`), `mailto:`, or `tel:` — those would clutter the
      // print output with redundant text.
      expect(css).toMatch(
        /a\[href\]:not\(\[href\^="#"\]\):not\(\[href\^="mailto:"\]\):not\(\[href\^="tel:"\]\)::after \{[^}]*content:\s*" \(" attr\(href\) "\)"/,
      );
    });

    it('keeps `pre` / `blockquote` / `tr` / `img` from breaking across pages', () => {
      expect(css).toMatch(/pre,\s*blockquote\s*\{[^}]*page-break-inside:\s*avoid/);
      expect(css).toMatch(/tr,\s*img\s*\{[^}]*page-break-inside:\s*avoid/);
    });

    it('avoids orphaned headings and sets widow / orphan thresholds for body text', () => {
      expect(css).toMatch(/orphans:\s*3/);
      expect(css).toMatch(/widows:\s*3/);
      expect(css).toMatch(/h2,\s*h3\s*\{[^}]*page-break-after:\s*avoid/);
    });

    it('restores `thead` as a table-header-group so tables repeat headers across pages', () => {
      expect(css).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/);
    });

    it('rewraps `pre` blocks so long lines do not run off the page', () => {
      expect(css).toMatch(/pre\s*\{[^}]*white-space:\s*pre-wrap\s*!important/);
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
