/**
 * Media-query ordering policy.
 *
 * - `mobile-first`: `@media (min-width: N)` ascending by N (small N first),
 *   `@media (max-width: N)` descending by N. This matches the typical
 *   mobile-first cascade where larger viewports override smaller ones.
 * - `desktop-first`: opposite directions. Larger min-width first, smaller
 *   max-width first.
 *
 * Non-width media queries (`print`, `prefers-color-scheme`, ...) sort
 * lexicographically in either mode and come *after* width-based queries.
 */
export type MediaSort = 'mobile-first' | 'desktop-first';

/**
 * CSS-emission strategy.
 *
 * - `rule-per-class`: one CSS rule per className, declarations baked in.
 * - `shared-by-declaration`: one CSS rule per (property, value) pair with
 *   a grouped selector list. Single class per element preserved at the
 *   markup level. (Phase 4+ feature; the option is recognized now but
 *   not yet implemented in the emitter.)
 */
export type CssMode = 'rule-per-class' | 'shared-by-declaration';

/**
 * User-facing config shape. Every field is optional; missing fields fall
 * through to `defaultConfig` via `mergeConfig`. Designed to be JSON-
 * serializable so it can live in `fss.config.json` at the project root.
 */
export interface FssConfig {
  readonly layer?: string | null;
  readonly importSource?: string;
  readonly hash?: {
    readonly prefix?: string;
    readonly length?: number;
  };
  readonly media?: {
    readonly sort?: MediaSort;
  };
  readonly css?: {
    readonly mode?: CssMode;
    readonly lightningcss?: {
      readonly enabled?: boolean;
      readonly minify?: boolean;
      readonly targets?: string;
    };
  };
}

/**
 * Fully-populated config — the form consumed by the emitter, parser, and
 * vite-plugin internals. All fields are required; every optional in
 * `FssConfig` is filled in from `defaultConfig`.
 */
export interface ResolvedFssConfig {
  readonly layer: string | null;
  readonly importSource: string;
  readonly hash: {
    readonly prefix: string;
    readonly length: number;
  };
  readonly media: {
    readonly sort: MediaSort;
  };
  readonly css: {
    readonly mode: CssMode;
    readonly lightningcss: {
      readonly enabled: boolean;
      readonly minify: boolean;
      readonly targets: string;
    };
  };
}

export const defaultConfig: ResolvedFssConfig = Object.freeze({
  layer: 'fss',
  importSource: '@fss/core',
  hash: Object.freeze({
    prefix: 'fss-',
    length: 8,
  }),
  media: Object.freeze({
    sort: 'mobile-first' as const,
  }),
  css: Object.freeze({
    mode: 'rule-per-class' as const,
    lightningcss: Object.freeze({
      enabled: false,
      minify: true,
      targets: 'defaults',
    }),
  }),
}) as ResolvedFssConfig;

/**
 * Deep-merge a sequence of partial configs over `defaultConfig`. Later
 * layers win on field conflicts; `undefined` and missing fields are
 * skipped (so a partial layer can leave earlier values intact).
 *
 * `layer: null` is preserved (it is an *explicit* "no @layer wrap"
 * choice, distinct from "use the default layer name"). Only `undefined`
 * is treated as "not set".
 */
export function mergeConfig(
  ...layers: ReadonlyArray<FssConfig | undefined>
): ResolvedFssConfig {
  let acc: ResolvedFssConfig = defaultConfig;
  for (const layer of layers) {
    if (!layer) continue;
    acc = {
      layer: layer.layer !== undefined ? layer.layer : acc.layer,
      importSource: layer.importSource ?? acc.importSource,
      hash: {
        prefix: layer.hash?.prefix ?? acc.hash.prefix,
        length: layer.hash?.length ?? acc.hash.length,
      },
      media: {
        sort: layer.media?.sort ?? acc.media.sort,
      },
      css: {
        mode: layer.css?.mode ?? acc.css.mode,
        lightningcss: {
          enabled:
            layer.css?.lightningcss?.enabled ?? acc.css.lightningcss.enabled,
          minify:
            layer.css?.lightningcss?.minify ?? acc.css.lightningcss.minify,
          targets:
            layer.css?.lightningcss?.targets ?? acc.css.lightningcss.targets,
        },
      },
    };
  }
  return acc;
}
