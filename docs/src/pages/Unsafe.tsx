import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

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
  const copy = useT({
    en: {
      title: 'Unsafe surface',
      intro:
        'The typed cas() surface deliberately rejects a handful of CSS shorthands and refuses anything outside the standard property set. When you genuinely need them — vendor prefixes, CSS custom properties (--brand-*), or a shorthand whose implicit-reset semantics you accept — Cassida exposes named escape paths. The naming follows Rust: cas.unsafe (and .set) makes the cost of bypassing the registry visible at the call site.',
      whyHeading: 'Why these are unsafe',
      whyCopy:
        'CSS shorthands like background and font carry implicit-reset semantics — writing one resets every sub-property the shorthand covers, including the ones you didn’t mention. In an arbitrary cascade, writing "padding: 8px" and then "padding-top: 16px" is order-dependent: the source order decides which declaration wins. Cassida’s strict-by-default shorthand-policy refuses that co-occurrence to keep LIFO and cascade in sync. cas.unsafe and .set step around every one of those checks — that’s the whole point, and that’s why they’re named.',
      casUnsafeHeading: 'cas.unsafe(preset)',
      casUnsafeCopy:
        'Open a chain from an object whose keys can be anything. The preset’s entries are inlined as raw CSS declarations — registry lookup, shorthand-policy enforcement, and family tracking are all bypassed.',
      setHeading: '.set(key, value)',
      setCopy:
        'The method equivalent of cas.unsafe — drop a single property write into the middle of a chain. No auto-unitization: pass full CSS values like "10px" or "1.5rem" rather than bare numbers.',
      blacklistHeading: 'Blacklisted shorthands',
      blacklistCopy:
        'These shorthand names are absent from the typed cas() chain. The TypeScript-typed SafePreset filters them out at the boundary; the chain methods don’t exist either. To reach them, use cas.unsafe({ ... }) or cas().set(\'background\', \'...\'):',
      blacklistTable: 'The names excluded from the safe surface:',
    },
    ja: {
      title: 'unsafe な面',
      intro:
        '型付き cas() の面は、特定の CSS shorthand と標準セット外のプロパティを意図的に拒否する。だが、本当にそれが必要な場面 — ベンダープレフィックス、CSS カスタムプロパティ (--brand-*)、暗黙リセットを伴う shorthand を受け入れた上での記述 — のためには、名前付きの脱出経路が用意してある。命名は Rust に倣い、cas.unsafe (および .set) はレジストリを迂回するコストを呼び出し側に明示する。',
      whyHeading: 'なぜ unsafe なのか',
      whyCopy:
        'background や font などの shorthand には暗黙リセット意味論がある — 1 つ書き込むと、その shorthand が覆うすべてのサブプロパティが (明示していないものも含めて) リセットされる。任意のカスケード文脈で "padding: 8px" の後に "padding-top: 16px" を書けば、勝つのはソース順に依存する宣言になる。Cassida のデフォルト strict な shorthand-policy はこの共起を拒否し、LIFO とカスケードの結果を一致させ続ける。cas.unsafe や .set はそれらのチェックを意図的に迂回するためのものだ — そう設計されており、そう命名されている。',
      casUnsafeHeading: 'cas.unsafe(preset)',
      casUnsafeCopy:
        '任意の string キーを含むオブジェクトからチェーンを開始する。preset の各エントリは生の CSS 宣言として inline され、レジストリ検索・shorthand-policy ガード・family tracking はすべてバイパスされる。',
      setHeading: '.set(key, value)',
      setCopy:
        'cas.unsafe のメソッド形式 — チェーンの途中に 1 プロパティ書き込みを差し込む。単位の自動付与はない。"10px" や "1.5rem" のように完全な CSS 値を渡す。',
      blacklistHeading: 'ブラックリストの shorthand',
      blacklistCopy:
        '以下の shorthand 名は型付き cas() チェーンから欠落している。型付き preset の SafePreset が境界でこれらを除外し、チェーンメソッドとしても存在しない。これらを書きたい場合は cas.unsafe({ ... }) もしくは cas().set(\'background\', \'...\') を経由する:',
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
