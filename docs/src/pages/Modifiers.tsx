import type React from 'react';
import { cas } from '@cassida/core';
import { t } from '../lib/locale.js';
import { Code, InlineCode } from '../components/Code.js';

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
  const copy = t({
    en: {
      title: 'Modifiers',
      intro:
        'Modifiers wrap inner ops in a scope (pseudo-class, pseudo-element, or media query). Each modifier takes a callback that receives a fresh chain whose ops accumulate into the modifier’s sub-scope. The outer chain wraps those inner ops in a ScopedOp when the callback returns.',
      zeroArgHeading: 'Zero-argument modifiers',
      zeroArgIntro:
        'The 19 entries below resolve to a fixed pseudo-class, pseudo-element, or media query. Invoke as chain.<name>(c => …).',
      argHeading: 'Argument-taking modifiers',
      argIntro:
        '.media(query, cb) accepts any CSS media query. .on(selector, cb) accepts a raw selector (any pseudo, attribute selector, descendant combinator). The selector’s prefix determines the scope kind:',
      onPseudo: '" : " / " :: " prefix → pseudo scope',
      onMedia: 'starts with "@media" → media scope',
      onRaw: 'anything else → raw selector scope',
      nestingHeading: 'Nesting',
      nestingCopy:
        'Modifiers nest arbitrarily. Each callback creates a new scope; the inner chain has its own LIFO collapse independent of the outer scope.',
      sortHeading: 'Mobile-first media sort',
      sortCopy:
        'Source order doesn’t matter — width-based queries are sorted ascending. The default is mobile-first (min-width queries sorted low → high); switch to desktop-first (max-width descending) via cassida.config.json.',
    },
    ja: {
      title: '修飾子',
      intro:
        '修飾子は内側の ops をスコープ (擬似クラス / 擬似要素 / メディアクエリ) で包みます。各修飾子はコールバックを受け取り、その中で新しいチェーンが渡されます。コールバック内の ops が修飾子のサブスコープに蓄積され、コールバックが return すると外側チェーンがそれを ScopedOp として包みます。',
      zeroArgHeading: '引数なし修飾子',
      zeroArgIntro:
        '以下の 19 個は固定の擬似クラス / 擬似要素 / メディアクエリに解決されます。chain.<name>(c => …) として呼びます。',
      argHeading: '引数を取る修飾子',
      argIntro:
        '.media(query, cb) は任意の CSS メディアクエリを受け取ります。.on(selector, cb) は生のセレクタ (任意の擬似クラス、属性セレクタ、子孫結合子) を受け取り、prefix によって scope の種類が決まります:',
      onPseudo: '" : " / " :: " で始まる → pseudo scope',
      onMedia: '"@media" で始まる → media scope',
      onRaw: 'それ以外 → raw selector scope',
      nestingHeading: 'ネスト',
      nestingCopy:
        '修飾子は任意にネストできます。各コールバックは新しいスコープを作り、内側チェーンは外側スコープから独立した LIFO 畳み込みを持ちます。',
      sortHeading: 'モバイルファーストのメディア順序',
      sortCopy:
        'ソース順は問いません — 幅基準のクエリは昇順にソートされます。デフォルトはモバイルファースト (min-width を小 → 大)。デスクトップファースト (max-width を大 → 小) に切り替える場合は cassida.config.json で指定します。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.zeroArgHeading}</h2>
      <p>{copy.zeroArgIntro}</p>
      <table
        {...cas().fontSize(13).props}
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '6px 4px' }}>Method</th>
            <th style={{ padding: '6px 4px' }}>Scope</th>
          </tr>
        </thead>
        <tbody>
          {ZERO_ARG_MODIFIERS.map((m) => (
            <tr key={m.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '4px', fontFamily: 'monospace' }}>{m.name}</td>
              <td style={{ padding: '4px', fontFamily: 'monospace' }}>{m.scope}</td>
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
