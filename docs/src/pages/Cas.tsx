import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Cas(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'cas() chain',
      intro:
        'cas() returns a chain builder. Every method call records a CSS write; the chain terminates at .props (or another terminator like .cond / .set) to yield JSX-spreadable { className, style }.',
      propsHeading: '.props — the JSX terminator',
      propsCopy:
        'Every chain ends with .props. The shape is exactly { className: string; style: Readonly<CSSProperties> } — the two attributes JSX needs, with the chain method surface stripped so React typings accept the spread.',
      propsWhy:
        'Why a terminator instead of spreading the chain object directly? The chain carries ~460 method handles named after CSS properties, and a handful of those names collide with HTML attributes (translate, disabled, hidden, etc). React rejects the resulting union; .props fixes it without dropping autocomplete.',
      condHeading: '.cond(test, truthy, falsy?) — chain-internal branching',
      condCopy:
        'Keep conditional styling inside the chain instead of duplicating the outer methods across both branches of a JSX ternary. At build time each branch materializes its own class hash; the JSX className becomes a nested ternary that picks the right one.',
      condRuntime:
        'At runtime, test is evaluated immediately and the picked branch is inlined into the linear ops list. The runtime hash matches the corresponding build-time leaf exactly.',
      setHeading: '.set(key, value) — direct property write',
      setCopy:
        'Bypass the registry for a single property write. Useful for vendor prefixes, CSS custom properties (--brand-*), or any property outside the curated safe surface. Numbers are NOT auto-unitized — pass full CSS values like "10px".',
      aliasesHeading: 'Aliases',
      aliasesCopy:
        'Short runtime sugar that resolves to the same registry entry as the long form. Aliases are intentionally absent from the TypeScript-typed CassChain — they exist for ergonomics in untyped contexts and during refactor. Recommended to use the canonical names in code you ship.',
    },
    ja: {
      title: 'cas() チェーン',
      intro:
        'cas() はチェーンビルダーを返します。各メソッド呼び出しが 1 つの CSS 書き込みを記録します。チェーンは .props（または .cond / .set など別の終端子）で終わり、JSX に spread できる { className, style } を返します。',
      propsHeading: '.props — JSX 終端子',
      propsCopy:
        'すべてのチェーンは .props で終わります。返値の形は { className: string; style: Readonly<CSSProperties> } — JSX が必要とする 2 つの属性だけで、チェーンのメソッド面は剥がされており React の型が spread を受け入れます。',
      propsWhy:
        'なぜチェーンオブジェクトを直接 spread せず終端子経由なのか？ チェーンは CSS プロパティ名にちなんだ約 460 個のメソッドハンドルを持ち、その中に HTML 属性と衝突するもの (translate / disabled / hidden 等) が含まれます。React の型はその union を拒否しますが、.props は autocomplete を犠牲にせずに型を成立させます。',
      condHeading: '.cond(test, truthy, falsy?) — チェーン内分岐',
      condCopy:
        '条件付きスタイリングをチェーン内に閉じ込めます。JSX 三項式で外側のメソッドを両分岐に複製する必要がありません。ビルド時に各分岐は独自のクラスハッシュにマテリアライズされ、JSX の className は適切な 1 つを選ぶネスト三項式になります。',
      condRuntime:
        'ランタイムでは test が即時評価され、選ばれた分岐が線形 ops リストに inline されます。ランタイムのハッシュは対応するビルド時の leaf と完全に一致します。',
      setHeading: '.set(key, value) — レジストリを経由しないプロパティ書き込み',
      setCopy:
        '単一プロパティの書き込みでレジストリをバイパスします。ベンダープレフィックス、CSS カスタムプロパティ (--brand-*)、または curated な safe surface 外のプロパティに有用です。数値は自動で単位付与されません — "10px" のように完全な CSS 値を渡します。',
      aliasesHeading: 'エイリアス',
      aliasesCopy:
        'ランタイムでのみ機能する短縮形で、long form と同じレジストリエントリーを指します。エイリアスは TypeScript 型付き CassChain には意図的に含まれていません — 型なしの文脈やリファクタ中のエルゴノミクスのために存在します。リリースするコードでは canonical な名前を推奨します。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.propsHeading}</h2>
      <p>{copy.propsCopy}</p>
      <Code source={`<div {...cas().padding(8).color('red').props} />`} />
      <p>{copy.propsWhy}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.condHeading}</h2>
      <p>{copy.condCopy}</p>
      <Code source={`<button
  {...cas()
    .padding(8)
    .cond(active,
      c => c.bg('blue').color('white'),
      c => c.bg('gray').color('#333'))
    .borderRadius(6)
    .props} />`} />
      <p>{copy.condRuntime}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.setHeading}</h2>
      <p>{copy.setCopy}</p>
      <Code source={`cas()
  .set('--brand-color', '#1a73e8')
  .set('-webkit-tap-highlight-color', 'transparent')
  .color('var(--brand-color)')`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.aliasesHeading}</h2>
      <p>{copy.aliasesCopy}</p>
      <Code source={`// Aliases (runtime-only, untyped):
//   bg → backgroundColor
//   mt → marginTop
//   mr → marginRight
//   mb → marginBottom
//   ml → marginLeft
//   pt → paddingTop
//   pr → paddingRight
//   pb → paddingBottom
//   pl → paddingLeft

cas().bg('white').mt(8);   // = cas().backgroundColor('white').marginTop(8)`} />
    </article>
  );
}
