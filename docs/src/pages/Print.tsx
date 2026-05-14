import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Print(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-print',
      intro:
        'A companion factory returning a CSS string of conservative @media print defaults — the kind of preflight every printable page benefits from regardless of site design. Black-on-white with shadows cleared, external link URLs appended after the anchor text (with break-word wrapping), abbreviation expansion via abbr[title], media width clamp covering img / svg / video / canvas, page-break hygiene for pre / blockquote / tr / h1-h6, p / li orphans + widows: 2, and thead / tfoot repetition across page boundaries.',
      design: 'Design notes',
      designNoImportant:
        'The preflight intentionally ships without !important. CSS Cascade Layers invert the precedence on important declarations — an !important in an earlier layer beats an !important in a later one, which would lock users out of overriding the defaults from their own @layer cas rules. Without !important, the canonical @layer base, cas; declaration plus class-vs-universal specificity does the right thing on its own.',
      designSource:
        'Rules adapted from the HTML5 Boilerplate print subset (MIT). Deliberately conservative — opinionated decisions ("hide nav / footer", brand fonts, page-size) live in user code because they can’t be applied universally.',
      use: 'Use',
      composition: 'Composition',
      compositionCopy:
        'printPreflight() returns a CSS string. It ships no delivery mechanism of its own — pair with @cassida/plugin-global-css and a distinct virtualId so screen and print stylesheets coexist as separate virtual modules.',
      siteSpecific: 'Site-specific extensions',
      siteSpecificCopy:
        'For rules that hide your site’s nav / footer / interactive controls (the kind of decision the library default deliberately leaves to you), concatenate on top of the preflight string.',
    },
    ja: {
      title: '@cassida/plugin-print',
      intro:
        '保守的な @media print デフォルトの CSS 文字列を返すコンパニオンファクトリ。サイトデザインを問わずあらゆる印刷可能ページが恩恵を受けるプリフライトを提供する — 黒インクの白背景、影の除去、外部リンクのテキスト末尾への URL 追記 (長い URL は break-word でラップ)、abbr[title] による略語展開、img / svg / video / canvas の幅クランプ、pre / blockquote / tr / h1-h6 のページ分割衛生、p / li の orphans + widows: 2、thead / tfoot のページ境界での反復。',
      design: '設計ノート',
      designNoImportant:
        'プリフライトは意図的に !important を含まない。CSS Cascade Layers は !important の優先順位を反転させる — 早いレイヤーの !important が後のレイヤーの !important より強くなるため、ユーザーは @layer cas のルールでデフォルトを上書きできなくなってしまう。!important を持たないこのプリフライトは、canonical な @layer base, cas; 宣言とクラス vs ユニバーサルの詳細度差だけで自然に正しい順序へ落ち着く。',
      designSource:
        'ルールは HTML5 Boilerplate の print サブセット (MIT) を adapt したもの。"hide nav / footer"・ブランドフォント・ページサイズなど opinionated な判断はユニバーサルに適用できないため、ライブラリのデフォルトには含めず、ユーザーコードに残す。',
      use: '使い方',
      composition: '合成',
      compositionCopy:
        'printPreflight() は CSS 文字列を返す — 配信機構はそれ自身では持たない。@cassida/plugin-global-css と組み合わせ、別の virtualId を渡せば、スクリーン用と印刷用のスタイルシートを別々の virtual module として共存させられる。',
      siteSpecific: 'サイト固有の拡張',
      siteSpecificCopy:
        'サイトの nav / footer / インタラクティブコントロールを隠す類の判断 — ライブラリのデフォルトが意図的にユーザーに委ねている部分 — はプリフライト文字列の上に concat して足す。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.design}</h2>
      <p>{copy.designNoImportant}</p>
      <p>{copy.designSource}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.use}</h2>
      <Code source={`pnpm add @cassida/plugin-print
pnpm add -D @cassida/plugin-global-css`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.composition}</h2>
      <p>{copy.compositionCopy}</p>
      <Code source={`// vite.config.ts
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { printPreflight } from '@cassida/plugin-print';

cassidaGlobalCss({
  css: printPreflight(),
  layer: 'base',
  virtualId: 'virtual:cassida-print.css',
});

// main.tsx
import 'virtual:cassida-print.css';`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.siteSpecific}</h2>
      <p>{copy.siteSpecificCopy}</p>
      <Code source={[
        'cassidaGlobalCss({',
        "  css: printPreflight() + `",
        '    @media print {',
        '      nav, footer, button, [aria-hidden="true"] {',
        '        display: none !important;',
        '      }',
        '    }',
        '  `,',
        "  layer: 'base',",
        "  virtualId: 'virtual:cassida-print.css',",
        '});',
      ].join('\n')} />
    </article>
  );
}
