import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Cas(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'cas() chain',
      intro:
        'cas() returns a chain. Each method records a single CSS write; the chain terminates at .props (or one of the other terminators) to yield a JSX-spreadable { className, style } pair. No template literals, no string assembly — just typed method calls that the build pipeline collapses into a single hashed class.',
      propsHeading: '.props — the JSX terminator',
      propsCopy:
        'Every chain ends with .props. The shape is exactly { className: string; style: Readonly<CSSProperties> } — the two attributes JSX consumes, with the chain’s method surface stripped so React’s type system accepts the spread without complaint.',
      propsWhy:
        'Why a terminator at all? The chain object exposes roughly 460 method handles, and several collide with HTML attribute names — translate (a real CSS property that doubles as the HTML translate attribute) and disabled (a zero-arg modifier that doubles as the HTML disabled attribute) are two examples; color / width / height also clash on the specific elements that carry them as HTML attributes. React’s JSX types refuse the resulting union. .props pares the spread down to the two keys React actually wants — autocomplete on the chain stays intact, the spread typechecks under strict settings.',
      condHeading: '.cond(test, truthy, falsy?) — branching inside the chain',
      condCopy:
        'JSX-level ternaries duplicate the outer chain methods across both branches. .cond keeps the branching inline: write the shared methods once, branch the variants. At build time each branch materialises its own class hash; the JSX className becomes a nested ternary that picks among them at runtime.',
      condRuntime:
        'At runtime, test is evaluated eagerly and the picked branch’s ops are spliced into the linear list. The runtime hash matches the corresponding build-time leaf byte-for-byte — the same bag yields the same class regardless of which path produced it.',
      setHeading: '.set(key, value) — bypass the registry for one property',
      setCopy:
        'Use .set when you need a single property that lives outside Cassida’s curated surface: vendor prefixes, CSS custom properties (--brand-*), or anything experimental. No auto-unitisation, no shorthand-policy enforcement; you pass full CSS values ("10px", "1.5rem") and you own the correctness.',
      aliasesHeading: 'Aliases',
      aliasesCopy:
        'Short runtime shortcuts resolve to the same registry entries as their canonical forms — bg → backgroundColor, mt → marginTop, and so on. The typed CassChain deliberately omits them: aliases exist for muscle memory and the untyped escape paths, not for production code where the long form makes intent legible.',
    },
    ja: {
      title: 'cas() チェーン',
      intro:
        'cas() はチェーンを返す。メソッド 1 回ごとに CSS 書き込みが 1 つ記録され、最後に .props (あるいは別の終端子) を呼ぶと JSX に spread できる { className, style } が返る。テンプレートリテラルも文字列連結も登場しない — 型付きメソッド呼び出しの並びを、ビルド側がハッシュ化されたクラスへ畳み込む。',
      propsHeading: '.props — JSX 終端子',
      propsCopy:
        'すべてのチェーンは .props で終わる。返るのは { className: string; style: Readonly<CSSProperties> } — JSX が必要とする 2 属性だけだ。チェーンが持つメソッド面は剥がされ、React の型システムが spread を素直に受け入れる。',
      propsWhy:
        'なぜ終端子が要るのか。チェーンが持つ約 460 個のメソッドハンドルのうち、HTML 属性名と衝突するものがいくつかある — 例えば translate (CSS プロパティと HTML translate 属性が同名) や disabled (zero-arg modifier と HTML disabled 属性が同名)、それに color / width / height は要素によって HTML 属性として宣言されているため、その要素で衝突する。React の JSX 型はその union を拒否する。.props はその union を 2 キーへ刈り込む — チェーンの autocomplete は失われず、strict 設定下でも spread が型を通る。',
      condHeading: '.cond(test, truthy, falsy?) — チェーン内分岐',
      condCopy:
        'JSX レベルの三項演算子は、外側のチェーンメソッドを両分岐に複製させる。.cond ならその重複を取り除ける — 共通のメソッドは 1 度だけ書き、差分だけを分岐に閉じ込める。ビルド時に各分岐がそれぞれ独自のクラスハッシュを得て、JSX の className はそれを選ぶ入れ子の三項式に書き換わる。',
      condRuntime:
        'ランタイムでは test が即座に評価され、選ばれた分岐の ops が線形リストに合流する。生まれるハッシュはビルド時の対応する leaf とバイト単位で一致する — 同じバッグからは、経路を問わず同じクラスが出る。',
      setHeading: '.set(key, value) — 1 プロパティだけレジストリを迂回する',
      setCopy:
        'curated な面の外側に出たいとき (ベンダープレフィックス、CSS カスタムプロパティ --brand-*、実験的な仕様) は .set を使う。単位の自動付与もなければ shorthand-policy のチェックもない。"10px" や "1.5rem" のように完全な CSS 値を渡し、正しさは呼び出し側が引き受ける。',
      aliasesHeading: 'エイリアス',
      aliasesCopy:
        'bg → backgroundColor、mt → marginTop のような短縮形は、canonical なエントリと同じ実体を指すランタイム上のショートカットだ。型付き CassChain にはあえて載せていない — エイリアスは指の動きを軽くするためと、型なしのエスケープ経路のためのもので、意図を読み取らせる必要があるプロダクションコードでは long form の方が雄弁だ。',
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

cas().bg('white').mt(8);   // === cas().backgroundColor('white').marginTop(8)`} />
    </article>
  );
}
