import type { Locale } from './locale.js';

/**
 * Build the canonical MDN URL for a CSS property in the given locale.
 *
 *   mdnUrl('padding-inline', 'en') →
 *     'https://developer.mozilla.org/en-US/docs/Web/CSS/padding-inline'
 *   mdnUrl('padding-inline', 'ja') →
 *     'https://developer.mozilla.org/ja/docs/Web/CSS/padding-inline'
 *
 * MDN's 2026 reference-tree reshuffle 301-redirects the bare paths to
 * `/docs/Web/CSS/Reference/Properties/<prop>` for some entries —
 * letting the server handle that keeps the link stable across
 * MDN's internal restructures.
 */
export function mdnUrl(cssProperty: string, locale: Locale): string {
  // MDN locale codes: `en-US` and `ja` (lowercase, no region for ja).
  const path = locale === 'ja' ? 'ja' : 'en-US';
  return `https://developer.mozilla.org/${path}/docs/Web/CSS/${cssProperty}`;
}
