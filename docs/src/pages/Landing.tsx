import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Landing(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Cassida',
      tagline: 'The compiler-driven single class CSS engine.',
      intro:
        'Cassida compiles every styling chain to a single class. No runtime engine, no cascade arithmetic, no utility-class garlands. The browser receives one stable hash per element and a flat layer of rules — the cascade fight is already over by the time the page paints.',
      headlineLabel: 'A chain in, a class out:',
      browseApi: 'Browse the API →',
      pluginsTitle: 'Plugins',
      pluginsBlurb:
        'The maintainers’ default-on bundle ships in @cassida/recommended (iOS-safe hover gating + conditional spreads lifted to build time). Add @cassida/plugin-global-css for preflight or reset CSS, and @cassida/plugin-print for print-ready @media print defaults — print is a first-class output, not an afterthought.',
      whyTitle: 'Why a new approach',
      whyBody:
        'BEM lets you name a state in three hyphens and a state machine in twelve; Tailwind hangs a class for every property on every element. Both work — and both leave the cascade unresolved, deferred to the browser at paint time. Cassida resolves it at build time. The chain you write collapses to one canonical bag via LIFO, the bag hashes to a single class, and the class lives in a dedicated cascade layer where specificity is fixed at 0,1,0. The CSS that ships is the CSS you authored, plus exactly nothing else.',
      principleTitle: 'The Single Class Principle',
      principleBody:
        'One element gets one shield. Same chain shape, same hash, anywhere in the codebase — a bijection between source and output. Two components writing color("red").padding(8) produce the same class; rename a variable and the hash is unchanged. The escape hatches (cas.unsafe, .set) are named after their cost so misuse is loud.',
    },
    ja: {
      title: 'Cassida',
      tagline: 'ビルド時に 1 クラスへ解決する CSS-in-JS コンパイラ。',
      intro:
        'Cassida はチェーンで書いたスタイルを、ビルド時に 1 要素 = 1 クラスへ解決する。ブラウザにランタイムは届かない。詳細度の計算もない。出力されるのは class 名 1 つと、@layer cas にまとめられた CSS ルールだけだ。',
      headlineLabel: 'チェーンを入れ、クラスを得る:',
      browseApi: 'API を見る →',
      pluginsTitle: 'プラグイン',
      pluginsBlurb:
        'メンテナーが既定で有効にしているプラグインは @cassida/recommended にまとめてある (iOS の :hover 居座り問題のゲートと、条件分岐 spread のビルド時解決)。プリフライトやリセット CSS を扱う @cassida/plugin-global-css と、@media print の保守的なデフォルトを返す @cassida/plugin-print も別パッケージで用意してある。印刷は後付けの対象ではなく、最初から出力経路として組み込まれている。',
      whyTitle: 'なぜ別の道を選ぶのか',
      whyBody:
        'BEM は状態が増えるとクラス名が長くなる。Tailwind は要素ごとにプロパティ数だけクラスを並べる。どちらも動くが、どちらもカスケードを解決せずブラウザに渡している。Cassida は同じ問題をビルド時に解く。チェーンは LIFO で 1 つの形に畳まれ、そこから安定したハッシュが計算され、専用の @layer cas に置かれた単一クラスになる。詳細度は (0,1,0) で固定。出力される CSS は、書いた内容そのものだけだ。',
      principleTitle: '単一クラスの原則',
      principleBody:
        '1 要素に 1 クラス。同じ形のチェーンは、コードベースのどこに書いても同じハッシュを生む。別のコンポーネントが color("red").padding(8) と書いても、出てくる class は同じものだ。変数名を変えてもハッシュは変わらない。レジストリを迂回する経路 (cas.unsafe, .set) は名前にそのコストが書いてある — 誤って使ってしまうことが起きにくい。',
    },
  });

  return (
    <article>
      <h1 {...cas().fontSize(48).marginBottom(8).props}>{copy.title}</h1>
      <p
        {...cas()
          .fontSize(22)
          .color('#4b5563')
          .marginBottom(32).props}
      >
        {copy.tagline}
      </p>
      <p {...cas().fontSize(16).color('#1c1f24').marginBottom(32).props}>{copy.intro}</p>

      <section {...cas().marginBottom(40).props}>
        <p
          {...cas()
            .fontSize(13)
            .textTransform('uppercase')
            .color('#6b7280')
            .marginBottom(8).props}
        >
          {copy.headlineLabel}
        </p>
        <Code
          source={`<button {...cas()
  .padding(12).backgroundColor('#1a73e8').color('white')
  .hover(c => c.backgroundColor('#1557b0'))
  .focus(c => c.backgroundColor('#0e3f87'))
  .props} />`}
        />
        <p
          {...cas()
            .fontSize(13)
            .color('#6b7280')
            .marginTop(8).props}
        >
          ↓
        </p>
        <Code
          source={`<button className="cas-3702b738" />

@layer cas {
  .cas-3702b738 {
    background-color: #1a73e8; color: #fff; padding: 12px;
  }
  .cas-3702b738:hover  { background-color: #1557b0 }
  .cas-3702b738:focus  { background-color: #0e3f87 }
}`}
        />
      </section>

      <section {...cas().marginBottom(40).props}>
        <h2 {...cas().fontSize(24).marginBottom(12).props}>{copy.principleTitle}</h2>
        <p>{copy.principleBody}</p>
      </section>

      <section {...cas().marginBottom(40).props}>
        <h2 {...cas().fontSize(24).marginBottom(12).props}>{copy.whyTitle}</h2>
        <p>{copy.whyBody}</p>
      </section>

      <section {...cas().marginBottom(40).props}>
        <h2 {...cas().fontSize(24).marginBottom(12).props}>{copy.pluginsTitle}</h2>
        <p>{copy.pluginsBlurb}</p>
      </section>
    </article>
  );
}
