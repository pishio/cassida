/**
 * Type-only assertions for `@cassida/vite-plugin`.
 *
 * The `.test-d.ts` suffix is outside vitest's `**\/*.test.ts` include
 * pattern, so this file is never executed at runtime; it is only checked
 * by `tsc -p tsconfig.typecheck.json`. Each `// @ts-expect-error` encodes
 * a consumer-facing guarantee — if the line below ever stops being a
 * type error, the directive itself errors and CI surfaces the regression.
 */
import type { Plugin } from 'vite';
import type { CassConfig } from '@cassida/compiler';
import cassida, { type CassPluginOptions } from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // ────────────────────────────────────────────────────────────────
  // 1) Default-export factory: no args is valid, returns a Vite `Plugin`.
  // ────────────────────────────────────────────────────────────────
  const noArgs: Plugin = cassida();
  void noArgs;
  const withEmpty: Plugin = cassida({});
  void withEmpty;

  // ────────────────────────────────────────────────────────────────
  // 2) `CassPluginOptions` extends `CassConfig` — every `CassConfig`
  //    field is assignable.
  // ────────────────────────────────────────────────────────────────
  const fromCassConfig: CassConfig = { layer: 'cas', shorthand: { policy: 'strict' } };
  const opts: CassPluginOptions = fromCassConfig;
  void opts;

  cassida({
    layer: null,
    shorthand: { policy: 'shorthand-first' },
    media: { sort: 'desktop-first' },
  });

  // ────────────────────────────────────────────────────────────────
  // 3) Each documented option's type narrowly matches its source-of-truth.
  // ────────────────────────────────────────────────────────────────
  // `include` is a RegExp (not string, not array — a single RegExp).
  cassida({ include: /\.tsx$/ });
  // @ts-expect-error -- `include` is not a string glob
  cassida({ include: '**/*.tsx' });
  // @ts-expect-error -- `include` does not accept an array of RegExps
  cassida({ include: [/\.tsx$/] });

  // `plugins` is an array of `CassPlugin`; each entry must have name + transform.
  cassida({ plugins: [{ name: 'p', transform: (t) => t }] });
  // @ts-expect-error -- a plain string is not a CassPlugin
  cassida({ plugins: ['plugin-name'] });
  // @ts-expect-error -- missing transform field
  cassida({ plugins: [{ name: 'p' }] });

  // `parserPlugins` is its own list.
  cassida({ parserPlugins: [{ name: 'pp', trySpread: () => null }] });

  // ────────────────────────────────────────────────────────────────
  // 4) `pathAliases` accepts a real alias map OR the special `false`
  //    opt-out — but nothing else.
  // ────────────────────────────────────────────────────────────────
  cassida({ pathAliases: { '@/*': '/abs/*' } });
  cassida({ pathAliases: false });
  // @ts-expect-error -- `true` is not a valid pathAliases value
  cassida({ pathAliases: true });
  // @ts-expect-error -- numeric targets are rejected
  cassida({ pathAliases: { '@/*': 42 } });

  // ────────────────────────────────────────────────────────────────
  // 5) `shorthand.policy` is the documented `ShorthandPolicy` enum;
  //    only the three documented values are accepted.
  // ────────────────────────────────────────────────────────────────
  cassida({ shorthand: { policy: 'lenient' } });
  // @ts-expect-error -- arbitrary string fails the enum
  cassida({ shorthand: { policy: 'whatever' } });

  // ────────────────────────────────────────────────────────────────
  // 6) `media.sort` is `'mobile-first' | 'desktop-first'`.
  // ────────────────────────────────────────────────────────────────
  cassida({ media: { sort: 'mobile-first' } });
  // @ts-expect-error -- arbitrary sort value fails
  cassida({ media: { sort: 'random' } });

  // ────────────────────────────────────────────────────────────────
  // 7) `layer` accepts `string | null | undefined`, mirroring
  //    `CssEmitterOptions.layer`.
  // ────────────────────────────────────────────────────────────────
  cassida({ layer: 'cas' });
  cassida({ layer: null });
  cassida({});
  // @ts-expect-error -- `layer` does not accept numbers
  cassida({ layer: 42 });

  // ────────────────────────────────────────────────────────────────
  // 8) The returned `Plugin` carries the documented Vite hooks. The
  //    plugin's `name` is the literal `'cassida'`.
  // ────────────────────────────────────────────────────────────────
  const p = cassida();
  const pname: string = p.name;
  void pname;
  // `Plugin.enforce` is `'pre' | 'post' | undefined` — assignable.
  const enforce: 'pre' | 'post' | undefined = p.enforce;
  void enforce;
}
