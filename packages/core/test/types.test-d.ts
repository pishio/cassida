/**
 * Type-only assertions. The `.test-d.ts` suffix is outside vitest's
 * `**\/*.test.ts` include pattern, so this file is never executed at
 * runtime; it is only checked by `tsc -p tsconfig.typecheck.json`.
 *
 * Each `// @ts-expect-error` encodes a guarantee — if the line below
 * ever stops being a type error, the directive itself errors and CI
 * surfaces the regression.
 */
import { fss, type FssChain } from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // 1) Documented canonical methods type-check.
  fss().color('red');
  fss().backgroundColor('#fff');
  fss().marginTop(10);
  fss().marginTop(10, 'em');
  fss().marginTop('auto');
  fss().fontSize('1.5rem');
  fss().display('flex');
  fss().position('absolute');
  fss().opacity(0.5);

  // 2) Methods absent from the canonical spec are rejected.
  // @ts-expect-error -- not declared on the chain
  fss().nonexistent('x');

  // 3) Runtime aliases are intentionally NOT in the static type.
  // @ts-expect-error -- mt is a runtime alias, not in the canonical type
  fss().mt(10);
  // @ts-expect-error -- bg is a runtime alias, not in the canonical type
  fss().bg('white');

  // 4) csstype tightens enum-like / typed values.
  // @ts-expect-error -- color expects a CSS color string, not a plain number
  fss().color(123);

  // 5) Spread surfaces a CSS.Properties-typed style object; methods are
  //    non-enumerable and do not leak.
  const chain: FssChain = fss().color('red');
  const spread: { style: object } = { ...chain };
  void spread;

  // 6) Phase 6b: generated mdn-data methods are callable with a
  //    permissive string | number payload.
  fss().aspectRatio('16/9');
  fss().containerType('inline-size');
  fss().accentColor('#ff0');

  // 7) Generated methods do not loosen hand-crafted typed methods —
  //    csstype tightening is preserved on the curated subset.
  // @ts-expect-error -- color is hand-crafted; number must still be rejected
  fss().color(456);
}
