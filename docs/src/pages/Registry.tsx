import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { PropertyTable } from '../components/PropertyTable.js';
import { Code } from '../components/Code.js';

export default function Registry(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Property registry',
      intro:
        'Every standard CSS property is callable as a chain method. The curated subset is hand-typed via csstype so IDE autocomplete surfaces real CSS values; the long tail is auto-generated from mdn-data with a permissive (string | number) signature. The line between them is invisible at the call site — you get the same chain shape either way.',
      canonicalHeading: 'Canonical entries',
      canonicalCopy:
        'Hand-crafted, csstype-typed. Covers the box-model shorthand families (margin, padding, inset) along with their longhands, and ships Tailwind-shaped multi-property utilities — px / py / mx / my — that write two logical longhands per call (padding-inline-start/end, padding-block-start/end, …). The shorthand-policy guard rejects shorthand ↔ longhand co-occurrence inside a single scope at build time, so the cascade-vs-LIFO ambiguity that bites silently elsewhere has no place to hide.',
      generatedHeading: 'Generated entries',
      generatedCopy:
        'Roughly 230 methods auto-generated from mdn-data fill the gaps the curated set leaves open. Each takes a permissive (string | number) argument. When a name collides with a canonical entry, TypeScript’s intersection keeps the curated typing — generated methods exist for breadth, not to loosen what the curated set already constrains.',
      multiHeading: 'Multi-property utilities (v0.4+)',
      multiCopy:
        'px(n) writes both padding-inline-start and padding-inline-end. LIFO collapses per-longhand: cas().px(8).paddingInlineStart(4) settles on start: 4px, end: 8px. For shorthand-policy purposes they’re longhands of the padding / margin family — mixing px with padding in the same scope errors at build time, just like paddingTop would.',
      mdnHeading: 'MDN cross-reference',
      mdnCopy:
        'Every row links to its MDN documentation page in the active locale (en-US or ja). Search by method name, CSS property, or alias; filter by category. The table is generated from the same registry the runtime consumes, so it never drifts.',
    },
    ja: {
      title: 'プロパティレジストリ',
      intro:
        '標準 CSS プロパティはすべてチェーンメソッドとして呼べる。canonical な (手書きの) サブセットは csstype で型付けされていて、IDE の補完に実際の CSS 値が並ぶ。それ以外は mdn-data から自動生成されたメソッドが埋めている。生成側の引数は (string | number) で受ける緩い形だ。呼び出し側からは、canonical なメソッドと生成メソッドの境界は見えない。どちらでもチェーンの形は同じだ。',
      canonicalHeading: 'Canonical エントリ',
      canonicalCopy:
        '手書きで、csstype で型付けされた集合。box-model の shorthand ファミリー (margin / padding / inset) とそれぞれの longhand に加え、Tailwind と同じ形の multi-property ユーティリティ（px / py / mx / my）を含む。これらは 1 回の呼び出しで 2 つの論理 longhand (padding-inline-start/end, padding-block-start/end, …) を書き込む。物理的な左右は書字方向に応じて決まる。shorthand-policy ガードは、同じスコープ内に shorthand と longhand が同居することをビルド時に拒否する。LIFO とカスケードの結果がずれる余地は、ここでは閉じている。',
      generatedHeading: 'Generated エントリ',
      generatedCopy:
        'canonical な集合が拾わない部分は、mdn-data から自動生成された約 230 個のメソッドが受け持つ。引数は (string | number) を 1 つ取る緩い形だ。canonical 側に同じ名前のメソッドがある場合は、TypeScript の intersection が canonical の型付けを優先する。生成エントリは網羅性のためにある。canonical が課す制約をゆるめる目的では用意していない。',
      multiHeading: 'Multi-property utility (v0.4+)',
      multiCopy:
        'px(n) は padding-inline-start と padding-inline-end の両方を書き込む。LIFO は longhand 単位で効くので、cas().px(8).paddingInlineStart(4) の結果は start: 4px, end: 8px になる。shorthand-policy の文脈では padding / margin ファミリーの longhand として扱う。同じスコープで px と padding を混ぜるとビルド時にエラーになる。paddingTop を混ぜたときと同じ挙動だ。',
      mdnHeading: 'MDN クロスリファレンス',
      mdnCopy:
        '表の各行は、現在のロケール (en-US または ja) の MDN ページへリンクしている。メソッド名、CSS プロパティ名、エイリアスのいずれでも検索でき、カテゴリで絞り込める。表はランタイムと同じレジストリから生成しているので、表と実装がずれることはない。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.canonicalHeading}</h2>
      <p>{copy.canonicalCopy}</p>

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.generatedHeading}</h2>
      <p>{copy.generatedCopy}</p>

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.multiHeading}</h2>
      <p>{copy.multiCopy}</p>
      <Code source={`cas().px(8)
// → padding-inline-start: 8px; padding-inline-end: 8px

cas().px(8).paddingInlineStart('4px')
// → padding-inline-start: 4px; padding-inline-end: 8px`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.mdnHeading}</h2>
      <p>{copy.mdnCopy}</p>
      <PropertyTable />
    </article>
  );
}
