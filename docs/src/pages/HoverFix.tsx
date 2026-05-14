import type React from 'react';
import { cas } from '@cassida/core';
import { t } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function HoverFix(): React.JSX.Element {
  const copy = t({
    en: {
      title: '@cassida/plugin-hover-fix',
      intro:
        'CSS-level plugin that wraps every :hover scope in @media (hover: hover) — gates hover styling to pointing devices that can actually hover. Fixes the iOS Safari sticky-hover bug where tapping an element leaves :hover styles applied until the next tap elsewhere.',
      effectHeading: 'Effect on output',
      withoutHeading: 'Without the plugin',
      withHeading: 'With the plugin',
      optionsHeading: 'Options',
      optionsQuery:
        'query: override the media query. Default "(hover: hover)". Use "(hover: hover) and (pointer: fine)" to also require precise pointing (mouse, trackpad — not coarse stylus).',
      optionsSelectors:
        'selectors: an array of pseudo-class names to apply the wrap to. Default ["hover"]. Add "any-hover" if you want to gate :any-hover too.',
    },
    ja: {
      title: '@cassida/plugin-hover-fix',
      intro:
        'CSS レイヤーのプラグイン。すべての :hover スコープを @media (hover: hover) で包み、実際に hover できるポインティングデバイスにのみ hover スタイリングを適用します。iOS Safari のタップで :hover が残留するバグ (要素をタップした後、別の場所をタップするまで :hover スタイルが残る現象) を解消します。',
      effectHeading: '出力への影響',
      withoutHeading: 'プラグインなし',
      withHeading: 'プラグインあり',
      optionsHeading: 'オプション',
      optionsQuery:
        'query: メディアクエリを上書きします。デフォルト "(hover: hover)"。精密なポインティング (マウス / トラックパッド — coarse なスタイラスを除外) も要求する場合は "(hover: hover) and (pointer: fine)" を指定します。',
      optionsSelectors:
        'selectors: ラッピング対象の擬似クラス名配列。デフォルト ["hover"]。:any-hover にもゲートをかけたい場合は "any-hover" を追加します。',
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
