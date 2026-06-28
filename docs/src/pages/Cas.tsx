import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function Cas(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'cas() chain',
      intro:
        '`cas()` returns a chain. Each method records a single CSS write; the chain terminates at `.props` (or one of the other terminators) to yield a JSX-spreadable `{ className, style }` pair. No template literals, no string assembly — just typed method calls that the build pipeline collapses into a single hashed class.',
      propsHeading: '.props — the JSX terminator',
      propsCopy:
        'Every chain ends with `.props`. The shape is exactly `{ className: string; style: Readonly<CSSProperties> }` — the two attributes JSX consumes, with the chain’s method surface stripped so React’s type system accepts the spread without complaint.',
      propsWhy:
        'Why a terminator at all? The chain object exposes roughly 460 method handles, and several collide with HTML attribute names — `translate` (a real CSS property that doubles as the HTML `translate` attribute) and `disabled` (a zero-arg modifier that doubles as the HTML `disabled` attribute) are two examples; `color` / `width` / `height` also clash on the specific elements that carry them as HTML attributes. React’s JSX types refuse the resulting union. `.props` pares the spread down to the two keys React actually wants — autocomplete on the chain stays intact, the spread typechecks under strict settings.',
      condHeading: '.cond(test, truthy, falsy?) — branching inside the chain',
      condCopy:
        'JSX-level ternaries duplicate the outer chain methods across both branches. `.cond` keeps the branching inline: write the shared methods once, branch the variants. At build time each branch materializes its own class hash; the JSX `className` becomes a nested ternary that picks among them at runtime.',
      condRuntime:
        'At runtime, `test` is evaluated eagerly and the picked branch’s ops are spliced into the linear list. The runtime hash matches the corresponding build-time leaf byte-for-byte — the same bag yields the same class regardless of which path produced it.',
      setHeading: '.set(key, value) — bypass the registry for one property',
      setCopy:
        'Use `.set` when you need a single property that lives outside Cassida’s curated surface: vendor prefixes, CSS custom properties (`--brand-*`), or anything experimental. No auto-unitization, no shorthand-policy enforcement; you pass full CSS values (`"10px"`, `"1.5rem"`) and you own the correctness.',
      aliasesHeading: 'Aliases',
      aliasesCopy:
        'Short runtime shortcuts resolve to the same registry entries as their canonical forms — `bg` → `backgroundColor`, `mt` → `marginTop`, and so on. The typed `CassChain` deliberately omits them: aliases exist for muscle memory and the untyped escape paths, not for production code where the long form makes intent legible.',
    },
    ja: {
      title: 'cas() チェーン',
      intro:
        '`cas()` はチェーンを返す。メソッドを 1 回呼ぶごとに CSS の書き込みが 1 つ記録される。最後に `.props` (あるいは別の終端子) を呼ぶと、JSX に spread できる `{ className, style }` が返る。テンプレートリテラルや文字列連結は出てこない。型付きのメソッド呼び出しだけで書き、ビルド時に 1 つのハッシュ済みクラスへ解決される。',
      propsHeading: '.props：JSX 終端子',
      propsCopy:
        'すべてのチェーンは `.props` で終わる。返るのは `{ className: string; style: Readonly<CSSProperties> }` の 2 キーだけ。これは JSX 側が必要としている形そのものだ。チェーン自身が持っていたメソッド群はここで落とされるので、React の型システムが spread をそのまま受け入れる。',
      propsWhy:
        'なぜ終端子が必要か。チェーンが持つメソッドハンドルは約 460 個あり、そのうちのいくつかは HTML 属性名と名前が同じだ。例えば `translate` は CSS プロパティであると同時に HTML 属性でもある。`disabled` は引数を取らない修飾子であると同時に HTML 属性でもある。`color` / `width` / `height` も、要素によって HTML 属性として宣言されていて衝突する。チェーンの型をそのまま spread すると、React の JSX 型はその union を拒否する。`.props` を呼ぶと、その union が 2 キーに絞られる。チェーンの autocomplete は維持されたまま、strict 設定下でも spread が型エラーにならない。',
      condHeading: '.cond(test, truthy, falsy?)：チェーン内分岐',
      condCopy:
        'JSX の三項演算子で書くと、外側のチェーンメソッドを両方の分岐に複製しないといけない。`.cond` を使えば共通部分は 1 度だけ書き、差分だけを分岐に閉じ込められる。ビルド時にそれぞれの分岐が独自のクラスハッシュに解決され、JSX の `className` は両者を選ぶ三項式に書き換えられる。',
      condRuntime:
        'ランタイムでは `test` が即座に評価され、選ばれた分岐の ops が線形リストにつなげられる。出てくるハッシュは、ビルド時に解決された対応分岐とバイト単位で一致する。チェーンの形が同じなら、経路を問わず同じクラスになる。',
      setHeading: '.set(key, value)：1 プロパティだけレジストリを迂回する',
      setCopy:
        '型付きの API の外に出たいとき (ベンダープレフィックス、CSS カスタムプロパティ `--brand-*`、まだ仕様が固まっていない値) は `.set` を使う。単位の自動付与もなく、shorthand-policy のチェックもかからない。`"10px"` や `"1.5rem"` のように完全な CSS 値の文字列を渡す。値の正しさは呼び出し側の責任になる。',
      aliasesHeading: 'エイリアス',
      aliasesCopy:
        '`bg` → `backgroundColor`、`mt` → `marginTop` のような短縮形は、canonical なエントリと同じ実体を指すランタイム上のショートカットだ。型付き `CassChain` には意図的に載せていない。エイリアスは手早く書くためと、型なしの脱出経路のためにある。意図を伝えたいプロダクションコードでは、長い形のほうが読みやすい。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p><Prose>{copy.intro}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.propsHeading}</h2>
      <p><Prose>{copy.propsCopy}</Prose></p>
      <Code source={`<div {...cas().padding(8).color('red').props} />`} />
      <p><Prose>{copy.propsWhy}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.condHeading}</h2>
      <p><Prose>{copy.condCopy}</Prose></p>
      <Code source={`<button
  {...cas()
    .padding(8)
    .cond(active,
      c => c.bg('blue').color('white'),
      c => c.bg('gray').color('#333'))
    .borderRadius(6)
    .props} />`} />
      <p><Prose>{copy.condRuntime}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.setHeading}</h2>
      <p><Prose>{copy.setCopy}</Prose></p>
      <Code source={`cas()
  .set('--brand-color', '#1a73e8')
  .set('-webkit-tap-highlight-color', 'transparent')
  .color('var(--brand-color)')`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.aliasesHeading}</h2>
      <p><Prose>{copy.aliasesCopy}</Prose></p>
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
