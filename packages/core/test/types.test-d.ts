/**
 * Type-only assertions. The `.test-d.ts` suffix is outside vitest's
 * `**\/*.test.ts` include pattern, so this file is never executed at
 * runtime; it is only checked by `tsc -p tsconfig.typecheck.json`.
 *
 * Each `// @ts-expect-error` encodes a guarantee — if the line below
 * ever stops being a type error, the directive itself errors and CI
 * surfaces the regression.
 */
import { cas, type CassChain } from '../src/index.js';

declare const _execute: boolean;

if (_execute) {
  // 1) Documented canonical methods type-check.
  cas().color('red');
  cas().backgroundColor('#fff');
  cas().marginTop(10);
  cas().marginTop(10, 'em');
  cas().marginTop('auto');
  cas().fontSize('1.5rem');
  cas().display('flex');
  cas().position('absolute');
  cas().opacity(0.5);

  // 2) Methods absent from the canonical spec are rejected.
  // @ts-expect-error -- not declared on the chain
  cas().nonexistent('x');

  // 3) Runtime aliases are intentionally NOT in the static type.
  // @ts-expect-error -- mt is a runtime alias, not in the canonical type
  cas().mt(10);
  // @ts-expect-error -- bg is a runtime alias, not in the canonical type
  cas().bg('white');

  // 4) csstype tightens enum-like / typed values.
  // @ts-expect-error -- color expects a CSS color string, not a plain number
  cas().color(123);

  // 5) `.props` surfaces only the JSX-shaped output; methods on the
  //    chain are not part of the spread type. v0.2 spread the chain
  //    directly; v0.3+ requires `.props` as the explicit terminator.
  const chain: CassChain = cas().color('red');
  const props: { className: string; style: object } = chain.props;
  void props;

  // 6) Phase 6b: generated mdn-data methods are callable with a
  //    permissive string | number payload.
  cas().aspectRatio('16/9');
  cas().containerType('inline-size');
  cas().accentColor('#ff0');

  // 7) Generated methods do not loosen hand-crafted typed methods —
  //    csstype tightening is preserved on the curated subset.
  // @ts-expect-error -- color is hand-crafted; number must still be rejected
  cas().color(456);

  // 8) Multi-property entries (`px` / `py` / `mx` / `my`) are part of
  //    the canonical chain type. Their argument signature mirrors the
  //    length-typed shorthands (`paddingTop`, `marginTop`, …).
  cas().px(8);
  cas().py(12, 'em');
  cas().mx('auto');
  cas().my('1rem');
  cas().px(8).paddingInlineStart('4px');
  // @ts-expect-error -- LenArg rejects booleans (must be number | string)
  cas().px(true);

  // 9) `.border(1)` previously typechecked but emitted `border: 1` (invalid
  //    CSS) because csstype's `Border<TLength>` widens to include `number`.
  //    The runtime `passthrough(v)` returned `String(v)`. Now the shorthand
  //    accepts strings only; numeric `border-width` goes through `borderWidth(1)`.
  // @ts-expect-error -- `.border(number)` no longer typechecks
  cas().border(1);
  // @ts-expect-error -- `.outline(number)` no longer typechecks
  cas().outline(1);
}
