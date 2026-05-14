import { DEFAULT_PRINT_PREFLIGHT } from './preflight.js';

/**
 * Return a CSS string of conservative `@media print` defaults — the
 * kind of preflight every printable page benefits from regardless of
 * site design. Black-on-white with shadows cleared, external link
 * URLs appended after the anchor text, image width clamped to the
 * page area, and page-break hygiene for `pre` / `blockquote` / `tr` /
 * `img` / headings.
 *
 * The function takes no arguments. Authors who want to layer custom
 * rules on top concatenate against the return value (no special
 * option required — string concatenation is the contract):
 *
 *   ```ts
 *   cassidaGlobalCss({
 *     css: printPreflight() + `
 *       @media print {
 *         nav, footer, button { display: none !important }
 *       }
 *     `,
 *     layer: 'base',
 *     virtualId: 'virtual:cassida-print.css',
 *   });
 *   ```
 *
 * Cassida doesn't ship its own stylesheet delivery; pair with
 * `@cassida/plugin-global-css` to mount the rules through Vite's CSS
 * pipeline:
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
 * affect print output; screen rendering is untouched.
 */
export function printPreflight(): string {
  return DEFAULT_PRINT_PREFLIGHT;
}

export { DEFAULT_PRINT_PREFLIGHT };
