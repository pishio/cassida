import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Print(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-print',
      intro:
        'Companion factory returning a CSS string of conservative @media print defaults — the kind of preflight every printable page benefits from regardless of site design. Black-on-white with shadows cleared, external link URLs appended after the anchor text (with break-word wrapping), abbreviation expansion via abbr[title], media width clamp covering img / svg / video / canvas, page-break hygiene for pre / blockquote / tr and h1-h6, p / li orphans + widows: 2, and thead / tfoot repetition across page boundaries.',
      design: 'Design notes',
      designNoImportant:
        'The preflight intentionally ships without !important. CSS Cascade Layers flip the precedence on important declarations — !important in earlier layers wins over !important in later ones, which would lock users out of overriding the defaults from their @layer cas rules. Without !important, the canonical @layer base, cas; declaration plus class-vs-universal specificity does the right thing.',
      designSource:
        'Rules adapted from the HTML5 Boilerplate print subset (MIT). Deliberately conservative — opinionated decisions ("hide nav / footer", brand fonts, page-size) stay in user code because they can’t be applied universally.',
      use: 'Use',
      composition: 'Composition',
      compositionCopy:
        'printPreflight() returns a CSS string. It does not ship its own stylesheet delivery — pair with @cassida/plugin-global-css and a distinct virtualId so screen and print stylesheets coexist.',
      siteSpecific: 'Site-specific extensions',
      siteSpecificCopy:
        'For rules that hide your site’s nav / footer / interactive controls (which the library default deliberately doesn’t touch), concatenate on top.',
    },
    ja: {
      title: '@cassida/plugin-print',
      intro:
        '保守的な @media print デフォルトの CSS 文字列を返すコンパニオンファクトリ。サイトデザインを問わずあらゆる印刷可能ページが恩恵を受けるプリフライトです: 黒インクオン白背景、影削除、外部リンクのテキストの後に URL を append (long URL の break-word ラップ付き)、abbr[title] による略語展開、img / svg / video / canvas に対する幅クランプ、pre / blockquote / tr / h1-h6 のページ分割衛生、p / li の orphans + widows: 2、thead / tfoot のページ境界での反復。',
      design: '設計ノート',
      designNoImportant:
        'プリフライトは意図的に !important を含みません。CSS Cascade Layers では !important の優先順位が反転します — 早いレイヤーの !important が後のレイヤーの !important を上回るため、ユーザーが @layer cas のルールでデフォルトを上書きできなくなります。!important なしであれば、canonical な @layer base, cas; 宣言とクラス vs ユニバーサル詳細度の組み合わせが正しく機能します。',
      designSource:
        'ルールは HTML5 Boilerplate の print サブセット (MIT) を adapt したもの。"hide nav / footer"・ブランドフォント・ページサイズなどの opinionated な判断はユニバーサルに適用できないためライブラリのデフォルトには含めず、ユーザーコードに残しています。',
      use: '使い方',
      composition: '合成',
      compositionCopy:
        'printPreflight() は CSS 文字列を返します。配信機構はそれ自身で持たないので、@cassida/plugin-global-css と組み合わせ、別の virtualId を渡してスクリーンと印刷のスタイルシートを共存させます。',
      siteSpecific: 'サイト固有の拡張',
      siteSpecificCopy:
        'ライブラリデフォルトが意図的に手を入れない部分 (サイトの nav / footer / インタラクティブコントロールを隠す等) は、preflight に concat して追加します。',
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
