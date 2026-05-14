import { DEFAULT_PRINT_PREFLIGHT } from './preflight.js';

/**
 * Options for `printPreflight`.
 */
export interface PrintPreflightOptions {
  /**
   * Override the bundled preflight CSS with your own string. Useful
   * when you want to start from the conservative defaults but tack on
   * site-specific rules (hide `nav`, force a brand font, set
   * page-size, etc.):
   *
   *   ```ts
   *   printPreflight({
   *     css: printPreflight() + `
   *       @media print {
   *         nav, footer, button { display: none !important }
   *         body { font-family: Georgia, serif }
   *       }
   *     `,
   *   })
   *   ```
   *
   * When omitted, returns the bundled `DEFAULT_PRINT_PREFLIGHT`.
   */
  readonly css?: string;
}

/**
 * Return a CSS string of conservative `@media print` defaults — the
 * kind of preflight every printable page benefits from regardless of
 * site design. Black-on-white with shadows cleared, external link
 * URLs appended after the anchor text, and page-break hygiene for
 * `pre` / `blockquote` / `tr` / `img` / headings.
 *
 * The function returns a string — Cassida doesn't ship its own
 * stylesheet delivery; pair it with `@cassida/plugin-global-css` to
 * mount the rules through Vite's CSS pipeline:
 *
 *   ```ts
 *   // vite.config.ts
 *   import { cassidaGlobalCss } from '@cassida/plugin-global-css';
 *   import { printPreflight } from '@cassida/plugin-print';
 *
 *   cassidaGlobalCss({
 *     css: printPreflight(),
 *     layer: 'base',
 *     virtualId: 'virtual:cassida-print.css',
 *   });
 *   ```
 *
 *   ```ts
 *   // main.tsx
 *   import 'virtual:cassida-print.css';
 *   ```
 *
 * The bundled rules are wrapped in `@media print` so they only
 * affect print output; screen rendering is untouched. The result is
 * a static string (no parameters), so importers can also `?raw`-load
 * a CSS file if they prefer authoring print styles in CSS directly.
 */
export function printPreflight(options: PrintPreflightOptions = {}): string {
  return options.css ?? DEFAULT_PRINT_PREFLIGHT;
}

export { DEFAULT_PRINT_PREFLIGHT };
