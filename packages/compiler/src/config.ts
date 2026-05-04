import { z } from 'zod';

/**
 * Schema definitions live first so the user-facing `FssConfig` type
 * can be derived from them via `z.infer`. Hand-writing the type and
 * the validator separately is the kind of "type lies" we explicitly
 * want to eliminate.
 */

const MediaSortSchema = z.enum(['mobile-first', 'desktop-first']);
const CssModeSchema = z.enum(['rule-per-class', 'shared-by-declaration']);

const HashSchema = z
  .object({
    prefix: z.string().optional(),
    length: z.number().int().min(4).max(40).optional(),
  })
  .strict();

const MediaSchema = z
  .object({
    sort: MediaSortSchema.optional(),
  })
  .strict();

const LightningcssSchema = z
  .object({
    enabled: z.boolean().optional(),
    minify: z.boolean().optional(),
    targets: z.string().optional(),
  })
  .strict();

const CssSchema = z
  .object({
    mode: CssModeSchema.optional(),
    lightningcss: LightningcssSchema.optional(),
  })
  .strict();

/**
 * Strict schema for `fss.config.json` and inline plugin options.
 * `.strict()` rejects unknown fields so config typos surface as
 * build-time errors instead of silently ignored entries.
 */
export const FssConfigSchema = z
  .object({
    /** Editor convention; allowed but unused. */
    $schema: z.string().optional(),
    layer: z.union([z.string(), z.null()]).optional(),
    importSource: z.string().optional(),
    hash: HashSchema.optional(),
    media: MediaSchema.optional(),
    css: CssSchema.optional(),
  })
  .strict();

/** User-facing config: every field optional, derived from the schema. */
export type FssConfig = z.infer<typeof FssConfigSchema>;
export type MediaSort = z.infer<typeof MediaSortSchema>;
export type CssMode = z.infer<typeof CssModeSchema>;

/**
 * Fully-populated config — the form consumed by the emitter, parser,
 * and vite-plugin internals. Every field is required; partial
 * `FssConfig` inputs are merged onto `defaultConfig` to produce one.
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
}) satisfies ResolvedFssConfig;

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

/**
 * Validate raw input as a `FssConfig`. Use only at I/O boundaries
 * (`fss.config.json`, plugin options handed in from `vite.config.ts`);
 * inside the compiler/parser/emitter, prefer `ResolvedFssConfig`.
 *
 * Errors surface as a single `Error` with a multi-line message that
 * names every invalid field, suitable for Vite's overlay or terminal
 * output. `sourcePath` (when supplied) is woven into the heading so
 * monorepo users see which config produced the error.
 */
export function parseFssConfig(input: unknown, sourcePath?: string): FssConfig {
  const result = FssConfigSchema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((i) => `  - ${i.path.length === 0 ? '<root>' : i.path.join('.')}: ${i.message}`)
    .join('\n');
  const where = sourcePath ? ` in ${sourcePath}` : '';
  throw new Error(`[fss] invalid configuration${where}:\n${issues}`);
}

/**
 * Schema for the values `path.evaluate()` is allowed to inline as
 * concrete CSS. Confidently-evaluated objects, arrays, and functions
 * fail validation and fall through to dynamic-CSS-variable handling
 * (they can't be inlined into CSS anyway).
 */
export const EvaluatedPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
