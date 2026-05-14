import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function HoverFix(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-hover-fix',
      intro:
        'A CSS-level plugin that wraps every :hover scope in @media (hover: hover) — hover styling applies only to pointing devices that actually hover. The fix targets a long-standing iOS Safari bug where tapping an element leaves :hover styles applied until the user taps somewhere else.',
      effectHeading: 'Before / after',
      withoutHeading: 'Without the plugin',
      withHeading: 'With the plugin',
      optionsHeading: 'Options',
      optionsQuery:
        'query: override the media query. Defaults to "(hover: hover)". Use "(hover: hover) and (pointer: fine)" if you want to require precise pointing too (mouse, trackpad — coarse stylus excluded).',
      optionsSelectors:
        'selectors: pseudo-class names the wrap applies to. Defaults to ["hover"]. Add "any-hover" to gate :any-hover identically.',
    },
    ja: {
      title: '@cassida/plugin-hover-fix',
      intro:
        ':hover スコープをすべて @media (hover: hover) で包む CSS レイヤーのプラグイン。実際に hover できるポインティングデバイスにだけ hover スタイルが適用される。iOS Safari の長年のバグ — 要素をタップした後、別の場所をタップするまで :hover が残り続ける挙動 — をこれで塞ぐ。',
      effectHeading: 'Before / After',
      withoutHeading: 'プラグインなし',
      withHeading: 'プラグインあり',
      optionsHeading: 'オプション',
      optionsQuery:
        'query: メディアクエリを上書きする。デフォルト "(hover: hover)"。精密なポインティング (マウス・トラックパッド — coarse なスタイラスは除外) も要求するなら "(hover: hover) and (pointer: fine)" を渡す。',
      optionsSelectors:
        'selectors: ラップ対象となる擬似クラス名の配列。デフォルト ["hover"]。:any-hover にも同じゲートをかけたければ "any-hover" を加える。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.effectHeading}</h2>
      <h3 {...cas().fontSize(16).marginTop(8).props}>{copy.withoutHeading}</h3>
      <Code source={`.cas-X:hover { color: red }`} />
      <h3 {...cas().fontSize(16).marginTop(8).props}>{copy.withHeading}</h3>
      <Code source={`@media (hover: hover) {
  .cas-X:hover { color: red }
}`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.optionsHeading}</h2>
      <ul {...cas().display('flex').flexDirection('column').gap(8).props}>
        <li>{copy.optionsQuery}</li>
        <li>{copy.optionsSelectors}</li>
      </ul>
      <Code source={`import hoverFix from '@cassida/plugin-hover-fix';

cassida({
  plugins: [hoverFix({
    query: '(hover: hover) and (pointer: fine)',
    selectors: ['hover'],
  })],
});`} />
    </article>
  );
}
