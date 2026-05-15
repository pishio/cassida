import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

const ZERO_ARG_MODIFIERS = [
  { name: 'hover', scope: ':hover' },
  { name: 'focus', scope: ':focus' },
  { name: 'focusVisible', scope: ':focus-visible' },
  { name: 'focusWithin', scope: ':focus-within' },
  { name: 'active', scope: ':active' },
  { name: 'disabled', scope: ':disabled' },
  { name: 'checked', scope: ':checked' },
  { name: 'required', scope: ':required' },
  { name: 'invalid', scope: ':invalid' },
  { name: 'firstChild', scope: ':first-child' },
  { name: 'lastChild', scope: ':last-child' },
  { name: 'empty', scope: ':empty' },
  { name: 'before', scope: '::before' },
  { name: 'after', scope: '::after' },
  { name: 'placeholder', scope: '::placeholder' },
  { name: 'selection', scope: '::selection' },
  { name: 'darkMode', scope: '@media (prefers-color-scheme: dark)' },
  { name: 'reduceMotion', scope: '@media (prefers-reduced-motion: reduce)' },
  { name: 'print', scope: '@media print' },
];

export default function Modifiers(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Modifiers',
      intro:
        'Modifiers open a scope — a pseudo-class, pseudo-element, or media query — and accept a callback that styles inside it. The callback receives a fresh chain; whatever methods it runs accumulate into the modifier’s sub-scope and the outer chain wraps the result as a single ScopedOp when control returns.',
      zeroArgHeading: 'Zero-argument modifiers',
      zeroArgIntro:
        'Nineteen presets resolve to a fixed pseudo-class, pseudo-element, or media query. Call chain.<name>(c => …) and the inner chain takes over.',
      argHeading: 'Argument-taking modifiers',
      argIntro:
        '.media(query, cb) accepts any CSS media query. .on(selector, cb) accepts a raw selector and dispatches on the prefix:',
      onPseudo: '" : " / " :: " prefix → pseudo scope',
      onMedia: 'starts with "@media" → media scope',
      onRaw: 'anything else → raw selector scope',
      nestingHeading: 'Nesting',
      nestingCopy:
        'Modifiers nest freely. Each callback opens its own scope, and the inner chain runs its own LIFO collapse independent of the outer one.',
      sortHeading: 'Mobile-first by default',
      sortCopy:
        'Source order doesn’t matter — width-based media queries are sorted ascending so the cascade reads small → large. Switch to desktop-first (max-width descending) in cassida.config.json. em / rem are normalised at 16px so they sort consistently against px; non-width queries (print, prefers-color-scheme) follow the width block alphabetically.',
    },
    ja: {
      title: '修飾子',
      intro:
        '修飾子はスコープ (擬似クラス・擬似要素・メディアクエリ) を開き、その内側を描くためのコールバックを受け取る。コールバックには新しいチェーンが渡され、その中で呼ばれたメソッドが修飾子のサブスコープへ蓄積される。コールバックを抜けると、外側のチェーンがそれらをひとつの ScopedOp として包む。',
      zeroArgHeading: '引数なし修飾子',
      zeroArgIntro:
        '固定の擬似クラス・擬似要素・メディアクエリへ解決される 19 個のプリセットがある。chain.<name>(c => …) と書けば、内側のチェーンに制御が渡る。',
      argHeading: '引数を取る修飾子',
      argIntro:
        '.media(query, cb) は任意の CSS メディアクエリを受け取る。.on(selector, cb) は生のセレクタを受け、その接頭辞でスコープの種類が決まる:',
      onPseudo: '" : " / " :: " で始まる → pseudo scope',
      onMedia: '"@media" で始まる → media scope',
      onRaw: 'それ以外 → raw selector scope',
      nestingHeading: 'ネスト',
      nestingCopy:
        '修飾子は自由にネストできる。各コールバックは独自のスコープを開き、内側のチェーンは外側とは独立した LIFO 畳み込みを持つ。',
      sortHeading: 'デフォルトはモバイルファースト',
      sortCopy:
        'ソース順は問われない — 幅基準のメディアクエリは昇順 (小 → 大) にソートされ、カスケードがその順番で読まれる。cassida.config.json でデスクトップファースト (max-width 降順) に切り替えられる。em / rem は 16px で正規化されるため px との相対順序が一貫し、幅基準でないクエリ (print、prefers-color-scheme など) は幅ブロックの後にアルファベット順で並ぶ。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.zeroArgHeading}</h2>
      <p>{copy.zeroArgIntro}</p>
      <table
        {...cas.unsafe({ borderCollapse: 'collapse' }).fontSize(13).width('100%').props}
      >
        <thead>
          <tr
            {...cas()
              .textAlign('left')
              .borderBottomWidth("1px")
              .borderBottomStyle('solid')
              .borderBottomColor('#e5e7eb').props}
          >
            <th {...cas().py(6).px(4).props}>Method</th>
            <th {...cas().py(6).px(4).props}>Scope</th>
          </tr>
        </thead>
        <tbody>
          {ZERO_ARG_MODIFIERS.map((m) => (
            <tr
              key={m.name}
              {...cas()
                .borderBottomWidth("1px")
                .borderBottomStyle('solid')
                .borderBottomColor('#f3f4f6').props}
            >
              <td {...cas().padding(4).fontFamily('monospace').props}>{m.name}</td>
              <td {...cas().padding(4).fontFamily('monospace').props}>{m.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.argHeading}</h2>
      <p>{copy.argIntro}</p>
      <ul {...cas().display('flex').flexDirection('column').gap(4).props}>
        <li>{copy.onPseudo}</li>
        <li>{copy.onMedia}</li>
        <li>{copy.onRaw}</li>
      </ul>
      <Code source={`cas().backgroundColor('#fff')
  .hover(c => c.backgroundColor('#eee'))
  .focus(c => c.outlineWidth(2))
  .media('(min-width: 768px)', c => c.padding(24))
  .on(':visited', c => c.color('purple'))
  .on('[data-state="open"]', c => c.borderColor('blue'))`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.nestingHeading}</h2>
      <p>{copy.nestingCopy}</p>
      <Code source={`cas().hover(c =>
  c.media('(min-width: 768px)', c2 =>
    c2.color('red')))
// → .cas-X:hover { color: red }  (only at >= 768px)`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.sortHeading}</h2>
      <p>{copy.sortCopy}</p>
    </article>
  );
}
