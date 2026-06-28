import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function Responsive(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Responsive design',
      lead: 'Goal: change styles by viewport width. Cassida has no breakpoint config to learn — you write CSS media queries directly with `.media()`, and the compiler sorts them so the cascade reads in the right order.',
      step1Heading: 'Write the base first, then layer breakpoints',
      step1Body:
        'Author the mobile layout as the base chain, then add wider layouts with `.media("(min-width: …)")`. Each `.media` call opens a scope that emits one nested rule under the element’s single class — the element still carries exactly one `cas-` class.',
      step2Heading: 'Source order does not matter',
      step2Body:
        '`min-width` queries are sorted ascending at build time — that is the default, mobile-first behaviour. List the breakpoints in any order you like; the emitted CSS still reads small → large, so a wider rule never loses to a narrower one by accident.',
      step3Heading: 'Combine with state and other modifiers',
      step3Body:
        'Modifiers nest. Put a `.media` inside a `.hover` (or the reverse) to scope a hover effect to one breakpoint. Each callback runs its own LIFO collapse, independent of the outer scope.',
      step4Heading: 'Switch to desktop-first',
      step4Body:
        'If you design from large screens down, set `media.sort` to `"desktop-first"` in `cassida.config.json`. Author with `max-width` and the compiler sorts the queries descending instead.',
    },
    ja: {
      title: 'レスポンシブ対応',
      lead: '目的: 画面幅でスタイルを切り替える。Cassida に覚えるべき breakpoint 設定はない。CSS のメディアクエリを `.media()` で直接書き、並べ替えはコンパイラがやる。',
      step1Heading: 'まずベースを書き、後から breakpoint を重ねる',
      step1Body:
        'モバイルの見た目をベースのチェーンに書き、広い画面の分を `.media("(min-width: …)")` で足す。`.media` は要素の単一クラスの下にネストしたルールを 1 つ出すだけで、要素が持つ `cas-` クラスは 1 つのままだ。',
      step2Heading: 'ソース順は気にしなくてよい',
      step2Body:
        '`min-width` のクエリはビルド時に昇順へ並べ替えられる。これが既定のモバイルファーストの挙動だ。breakpoint をどの順で書いても、出力 CSS は小さい幅から大きい幅の順に読まれる。広いルールが狭いルールに不意に負けることはない。',
      step3Heading: '状態や他の修飾子と組み合わせる',
      step3Body:
        '修飾子はネストする。`.hover` の中に `.media` を置けば（逆でもよい）、ある breakpoint だけに効くホバーを書ける。各コールバックは外側と独立に LIFO で解決される。',
      step4Heading: 'デスクトップファーストにする',
      step4Body:
        '大きい画面から設計するなら、`cassida.config.json` の `media.sort` を `"desktop-first"` にする。あとは `max-width` で書けば、コンパイラがクエリを降順に並べる。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p {...cas().fontSize(18).color('#1c1f24').props}><Prose>{copy.lead}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.step1Heading}</h2>
      <p><Prose>{copy.step1Body}</Prose></p>
      <Code source={`// 1 column on phones, 2 from 768px, 3 from 1100px
cas()
  .display('grid')
  .gridTemplateColumns('1fr')
  .gap(16)
  .media('(min-width: 768px)', c => c.gridTemplateColumns('1fr 1fr'))
  .media('(min-width: 1100px)', c => c.gridTemplateColumns('1fr 1fr 1fr'))`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.step2Heading}</h2>
      <p><Prose>{copy.step2Body}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.step3Heading}</h2>
      <p><Prose>{copy.step3Body}</Prose></p>
      <Code source={`cas()
  .color('#1c1f24')
  .media('(min-width: 768px)', c =>
    c.hover(h => h.color('#1a73e8')))
// the hover tint only applies at >= 768px`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.step4Heading}</h2>
      <p><Prose>{copy.step4Body}</Prose></p>
      <Code source={`// cassida.config.json
{ "media": { "sort": "desktop-first" } }`} />
    </article>
  );
}
