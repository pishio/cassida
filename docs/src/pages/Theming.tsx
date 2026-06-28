import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function Theming(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Theming and dark mode',
      lead: 'Goal: follow the OS dark-mode setting, and hold your colors as tokens instead of repeating a hex code at every call site.',
      darkHeading: 'Per-element dark mode',
      darkBody:
        'The `.darkMode` preset emits `@media (prefers-color-scheme: dark)`. Reach for it when a single element needs a dark variant and nothing more.',
      tokensHeading: 'App-wide tokens with CSS variables',
      tokensBody:
        'Writing `#1a73e8` into every chain spreads one decision across the whole codebase. Hold the colors as custom properties on `:root` instead, and read them with `var()`. A `:root` rule can’t ride on a chain, so put it in the global stylesheet served by `@cassida/plugin-global-css`; each element then just reads the variable.',
      flipHeading: 'Flip the tokens in dark mode',
      flipBody:
        'In that same global stylesheet, define the light tokens on `:root` and override them under the dark media query. Every element that reads `var(--fg)` follows automatically. The class count stays flat because the value moves, not the class — this is how Cassida carries dynamic values without exploding cardinality.',
      toggleHeading: 'A manual theme switch',
      toggleBody:
        'For a switch the user controls, instead of the OS setting, key the override on an attribute and flip it on the root element. Override the tokens under `[data-theme="dark"]` in the same stylesheet, then set `document.documentElement.dataset.theme`.',
      localHeading: 'A variable on one element',
      localBody:
        'To scope a variable to a single element rather than the whole app, write it through the unsafe surface: `cas.unsafe({ "--accent": "#1a73e8" })` or `.set("--accent", "#1a73e8")`. The same chain can then read it back as `var(--accent)`.',
    },
    ja: {
      title: 'テーマとダークモード',
      lead: '目的: OS のダークモード設定に追従し、色をハードコードせずトークンとして持つ。同じ hex を各所で繰り返さない。',
      darkHeading: '要素単位のダークモード',
      darkBody:
        '`.darkMode` プリセットは `@media (prefers-color-scheme: dark)` を出す。1 つの要素にダーク用の差分を足すだけなら、これでよい。',
      tokensHeading: 'CSS 変数でアプリ全体のトークンを持つ',
      tokensBody:
        '`#1a73e8` をすべてのチェーンに直書きすると、1 つの決定がコードベース中に散る。色は `:root` のカスタムプロパティにまとめ、各要素は `var()` で読む。`:root` のルールはチェーンに乗らないので、`@cassida/plugin-global-css` が配るグローバル CSS に置く。各要素は変数を読むだけになる。',
      flipHeading: 'ダークモードでトークンを差し替える',
      flipBody:
        '同じグローバル CSS の中で、ライトのトークンを `:root` に書き、ダークのメディアクエリで上書きする。`var(--fg)` を読む要素は自動で追従する。動くのは値であってクラスではないので、クラスの数は増えない。Cassida がクラスの種類を増やさずに動的な値を運べるのは、この仕組みのためだ。',
      toggleHeading: '手動のテーマ切り替え',
      toggleBody:
        'OS 設定ではなくユーザー操作で切り替えるなら、上書きを属性に紐づけてルート要素で切り替える。同じ CSS の中で `[data-theme="dark"]` の下にトークンを上書きし、`document.documentElement.dataset.theme` で値を変える。',
      localHeading: '1 要素だけの変数',
      localBody:
        'アプリ全体ではなく特定の要素にだけ変数を持たせたいときは、unsafe な API で書き込む。`cas.unsafe({ "--accent": "#1a73e8" })` か `.set("--accent", "#1a73e8")` で要素に変数を置き、同じチェーンの中で `var(--accent)` として読み戻せる。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p {...cas().fontSize(18).color('#1c1f24').props}><Prose>{copy.lead}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.darkHeading}</h2>
      <p><Prose>{copy.darkBody}</Prose></p>
      <Code source={`cas()
  .backgroundColor('#ffffff').color('#1c1f24')
  .darkMode(c => c.backgroundColor('#111317').color('#e8eaed'))`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.tokensHeading}</h2>
      <p><Prose>{copy.tokensBody}</Prose></p>
      <Code source={`/* served via @cassida/plugin-global-css, layer: 'base' */
:root { --fg: #1c1f24; --bg: #ffffff; --brand: #1a73e8 }`} />
      <Code source={`// every element just reads the token
cas().color('var(--fg)').backgroundColor('var(--bg)')`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.flipHeading}</h2>
      <p><Prose>{copy.flipBody}</Prose></p>
      <Code source={`:root { --fg: #1c1f24; --bg: #ffffff; --brand: #1a73e8 }

@media (prefers-color-scheme: dark) {
  :root { --fg: #e8eaed; --bg: #111317; --brand: #8ab4f8 }
}`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.toggleHeading}</h2>
      <p><Prose>{copy.toggleBody}</Prose></p>
      <Code source={`:root[data-theme="dark"] {
  --fg: #e8eaed; --bg: #111317; --brand: #8ab4f8
}

/* document.documentElement.dataset.theme = 'dark' */`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.localHeading}</h2>
      <p><Prose>{copy.localBody}</Prose></p>
      <Code source={`cas.unsafe({ '--accent': '#1a73e8' })
  .borderLeftStyle('solid').borderLeftWidth(3)
  .borderLeftColor('var(--accent)')`} />
    </article>
  );
}
