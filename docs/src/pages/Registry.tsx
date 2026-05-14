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
        'Every standard CSS property is callable as a chain method. The curated subset is hand-typed via csstype for IDE autocomplete on real CSS values; the rest is auto-generated from mdn-data with a permissive (string | number) signature.',
      canonicalHeading: 'Canonical entries',
      canonicalCopy:
        'Hand-crafted, csstype-typed. Includes box-model shorthand families (margin, padding, inset) with their longhands plus the Tailwind-style multi-property utilities px / py / mx / my that write two physical longhands per call. Shorthand-policy enforces that you don’t mix a shorthand with its longhand in the same scope — the cascade-vs-LIFO ambiguity is rejected at build time.',
      generatedHeading: 'Generated entries',
      generatedCopy:
        '~230 methods auto-generated from mdn-data, covering every standard CSS property the curated set doesn’t. Accept (string | number) as a single permissive argument. Hand-crafted methods of the same name override these via TypeScript intersection, so the curated typing wins where it exists.',
      multiHeading: 'Multi-property utilities (v0.4+)',
      multiCopy:
        'px(n) writes both padding-inline-start AND padding-inline-end. Per-longhand LIFO collapse: cas().px(8).paddingInlineStart(4) ends up with start: 4px, end: 8px. Treated as a longhand of the padding / margin family for shorthand-policy.',
      mdnHeading: 'MDN cross-reference',
      mdnCopy:
        'Every row links to its CSS property page on MDN in the active locale. Search and filter the table below by method name, CSS property, or alias.',
    },
    ja: {
      title: 'プロパティレジストリ',
      intro:
        '標準 CSS プロパティはすべてチェーンメソッドとして呼び出せます。curated なサブセットは csstype で IDE autocomplete を効かせるため手書き型付きで、その他は mdn-data から自動生成され (string | number) の permissive シグネチャを持ちます。',
      canonicalHeading: 'Canonical entries',
      canonicalCopy:
        'csstype 型付きの手書きエントリー。box-model の shorthand ファミリー (margin / padding / inset) と各 longhand に加え、1 回の呼び出しで 2 つの物理 longhand に書き込む Tailwind 風の multi-property utility (px / py / mx / my) を含みます。shorthand-policy により、同一スコープ内での shorthand と longhand の混在 — cascade vs LIFO の曖昧さ — はビルド時に拒否されます。',
      generatedHeading: 'Generated entries',
      generatedCopy:
        'mdn-data から約 230 個のメソッドを自動生成し、curated なセットがカバーしない標準 CSS プロパティをすべて埋めています。引数は (string | number) の permissive な単一引数。同名の手書きメソッドは TypeScript の intersection で優先され、curated な型付けが効くところでは効きます。',
      multiHeading: 'Multi-property utility (v0.4+)',
      multiCopy:
        'px(n) は padding-inline-start と padding-inline-end の両方に書き込みます。プロパティ単位の LIFO 畳み込み: cas().px(8).paddingInlineStart(4) の結果は start: 4px, end: 8px。shorthand-policy では padding / margin ファミリーの longhand として扱われます。',
      mdnHeading: 'MDN クロスリファレンス',
      mdnCopy:
        'すべての行は現在のロケールの MDN CSS プロパティページにリンクします。下の表はメソッド名、CSS プロパティ、エイリアスで検索・絞り込みできます。',
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
