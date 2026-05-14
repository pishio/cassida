import type React from 'react';
import { cas } from '@cassida/core';
import { t } from '../lib/locale.js';
import { Code, InlineCode } from '../components/Code.js';

const BLACKLISTED = [
  'background',
  'font',
  'border',
  'flex',
  'grid',
  'all',
  'mask',
  'transition',
  'animation',
  'listStyle',
  'textDecoration',
  'placeItems',
  'placeContent',
  'placeSelf',
  'columns',
  'columnRule',
  'overflow',
  'gridArea',
  'gridTemplate',
];

export default function Unsafe(): React.JSX.Element {
  const copy = t({
    en: {
      title: 'Unsafe surface',
      intro:
        'Cassida’s typed surface refuses certain CSS shorthands and any property outside the standard set. When you genuinely need them — for vendor prefixes, CSS custom properties (--brand-*), or shorthand-with-implicit-reset semantics — explicit opt-out paths exist. The naming follows Rust: cas.unsafe (and .set) acknowledges that you take responsibility for the CSS correctness the registry would otherwise check.',
      whyHeading: 'Why these are unsafe',
      whyCopy:
        'CSS shorthands like background and font have implicit-reset semantics: writing one of them resets every sub-property the shorthand covers, including the ones you didn’t mention. Cascade output for "padding: 8px" then "padding-top: 16px" is order-dependent in arbitrary cascade contexts; Cassida’s strict-by-default shorthand-policy refuses the co-occurrence to prevent the LIFO-vs-cascade ambiguity from biting silently. The unsafe escape bypasses every one of these checks.',
      casUnsafeHeading: 'cas.unsafe(preset)',
      casUnsafeCopy:
        'Start a chain from an object preset that can include any string key. Bypasses: registry lookup, shorthand-policy guard, family tracking. The preset object’s entries are inlined as raw CSS declarations.',
      setHeading: '.set(key, value)',
      setCopy:
        'Method form of the same escape. Use mid-chain to drop in a single property write that bypasses the registry. No auto-unitization: pass full CSS values ("10px", "1.5rem"), not bare numbers.',
      blacklistHeading: 'Blacklisted shorthands',
      blacklistCopy:
        'These shorthand names are absent from the typed cas() surface. The TypeScript-typed preset type SafePreset filters them out; the chain methods don’t exist either. To write them, use cas.unsafe({ ... }) or cas().set(\'background\', \'...\'):',
      blacklistTable: 'The names removed from the safe surface:',
    },
    ja: {
      title: 'unsafe な面',
      intro:
        'Cassida の型付き面は特定の CSS shorthand と標準セット外のプロパティを拒否します。本当に必要な場合 — ベンダープレフィックス、CSS カスタムプロパティ (--brand-*)、暗黙リセットを伴う shorthand 意味論 — のために明示的な opt-out 経路が用意されています。命名は Rust に倣い、cas.unsafe (および .set) は「レジストリが検査するはずの CSS 正しさをあなたが引き受ける」ことを示します。',
      whyHeading: 'なぜ unsafe か',
      whyCopy:
        'background や font などの CSS shorthand には暗黙リセット意味論があります — それらを書き込むと shorthand が覆うすべてのサブプロパティが (明示していないものも含めて) リセットされます。任意の cascade コンテキストで "padding: 8px" の後に "padding-top: 16px" を書いた場合の cascade 出力は順序依存となり、Cassida のデフォルト strict な shorthand-policy は LIFO vs cascade の曖昧さが silently 噛むのを防ぐためこの co-occurrence を拒否します。unsafe な escape はこれらの検査すべてをバイパスします。',
      casUnsafeHeading: 'cas.unsafe(preset)',
      casUnsafeCopy:
        '任意の string キーを含む preset オブジェクトからチェーンを開始します。バイパスするもの: レジストリ検索、shorthand-policy ガード、family tracking。preset のエントリーは生の CSS 宣言として inline されます。',
      setHeading: '.set(key, value)',
      setCopy:
        '同じ escape のメソッド形式。チェーン途中で 1 つのプロパティ書き込みを差し込んでレジストリをバイパスします。自動の単位付与なし: "10px", "1.5rem" のように完全な CSS 値を渡してください。',
      blacklistHeading: 'ブラックリスト shorthand',
      blacklistCopy:
        '以下の shorthand 名は型付き cas() 面から欠落しています。TypeScript の型付き preset 型 SafePreset でフィルタされ、チェーンメソッドとしても存在しません。これらを書きたい場合は cas.unsafe({ ... }) または cas().set(\'background\', \'...\') を使ってください:',
      blacklistTable: 'safe surface から除外されている名前:',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.whyHeading}</h2>
      <p>{copy.whyCopy}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.casUnsafeHeading}</h2>
      <p>{copy.casUnsafeCopy}</p>
      <Code source={`cas.unsafe({
  background: 'linear-gradient(45deg, #fafafa, #e8e8e8)',
  '-webkit-tap-highlight-color': 'transparent',
  '--brand-scale': 1.5,
}).marginTop(16)`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.setHeading}</h2>
      <p>{copy.setCopy}</p>
      <Code source={`cas()
  .color('var(--brand-color)')
  .set('--brand-color', '#1a73e8')
  .set('print-color-adjust', 'exact')`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.blacklistHeading}</h2>
      <p>{copy.blacklistCopy}</p>
      <p>{copy.blacklistTable}</p>
      <ul
        {...cas
          .unsafe({ listStyle: 'none' })
          .display('grid')
          .gridTemplateColumns('repeat(auto-fill, minmax(140px, 1fr))')
          .gap(4)
          .padding(12)
          .borderRadius(8)
          .backgroundColor('#f9fafb')
          .fontSize(13)
          .margin(0).props}
      >
        {BLACKLISTED.map((name) => (
          <li key={name} {...cas().fontFamily('monospace').props}>
            {name}
          </li>
        ))}
      </ul>
    </article>
  );
}
