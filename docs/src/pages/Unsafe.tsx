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
        '型付きの cas() 面は、特定の CSS shorthand と標準セット外のプロパティを意図的に拒否する。それでも本当に必要な場面 — ベンダープレフィックス、CSS カスタムプロパティ (--brand-*)、暗黙のリセットを承知した上で shorthand を使いたい場合 — には、名前付きの脱出経路を用意してある。命名は Rust に倣った。cas.unsafe (および .set) は、レジストリを迂回するというコストを呼び出し側に対して明示している。',
      whyHeading: 'なぜ unsafe なのか',
      whyCopy:
        'background や font のような shorthand には暗黙のリセットがある。1 つ書き込むと、その shorthand が覆うサブプロパティはすべて (書いていないものも含めて) リセットされる。"padding: 8px" の後に "padding-top: 16px" を書いた場合、どちらが勝つかはソース上の出現順に依存する。Cassida のデフォルトである strict な shorthand-policy は、その同居を拒否することで LIFO の結果とカスケードの結果を一致させている。cas.unsafe や .set は、それらのチェックを明示的に外すための入口だ。設計上そういう役割を持っていて、名前にもその意図が反映されている。',
      casUnsafeHeading: 'cas.unsafe(preset)',
      casUnsafeCopy:
        '任意の string キーを持つオブジェクトからチェーンを開始する。preset の各エントリは生の CSS 宣言としてそのまま埋め込まれる。レジストリ検索、shorthand-policy ガード、ファミリー追跡はいずれも適用されない。',
      setHeading: '.set(key, value)',
      setCopy:
        'cas.unsafe のメソッド版にあたる。チェーンの途中に 1 プロパティだけ生の書き込みを差し込める。単位の自動付与はないので、"10px" や "1.5rem" のように完全な CSS 値の文字列を渡す。',
      blacklistHeading: 'ブラックリストの shorthand',
      blacklistCopy:
        '以下の shorthand 名は型付き cas() チェーンには載っていない。型付き preset の SafePreset が境界で除外しているので、チェーンメソッドとしても存在しない。これらを書きたい場合は cas.unsafe({ ... }) か cas().set(\'background\', \'...\') を使う。',
      blacklistTable: '安全な面から除外されている名前:',
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
