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
      tagline: 'コンパイラ駆動の単一クラス CSS エンジン。',
      intro:
        'Cassida はすべてのスタイリングチェーンを 1 つのクラスへ畳み込むコンパイラだ。ランタイムエンジンも、カスケードの算術も、ユーティリティクラスの花綱もない。ブラウザが受け取るのは要素ごとに 1 つの安定ハッシュとフラットなルール層のみ — ペイントが始まる頃にはカスケードの闘いは終わっている。',
      headlineLabel: 'チェーンを入れ、クラスを得る:',
      browseApi: 'API を見る →',
      pluginsTitle: 'プラグイン',
      pluginsBlurb:
        'メンテナー推奨の既定セットは @cassida/recommended に同梱されている (iOS の :hover 居座り対策 + 条件分岐 spread のビルド時昇格)。プリフライトやリセット CSS には @cassida/plugin-global-css、印刷用の @media print 既定値には @cassida/plugin-print を組み合わせる — 印刷は後付けではなく、最初から想定された出力経路だ。',
      whyTitle: 'なぜ別の道を選ぶのか',
      whyBody:
        'BEM では状態を「ハイフン 3 つ」で命名できるが、状態機械は「ハイフン 12 個」になる。Tailwind は要素ごとにプロパティ数だけクラスを連ねる。どちらも動く — そして、どちらもカスケードを未解決のままブラウザに先送りする。Cassida はそれをビルド時に解決する。記述したチェーンは LIFO で正準なバッグに畳み込まれ、バッグはハッシュへ、ハッシュは専用カスケードレイヤー内の単一クラスとなる。詳細度は (0,1,0) で固定。出力される CSS は、あなたが書いた CSS そのもの — それ以外は 1 行たりとも含まない。',
      principleTitle: 'Single Class 原則',
      principleBody:
        '1 つの要素に、1 枚の盾。同じ形のチェーンはコードベースのどこにあっても同じハッシュを生む — ソースと出力の全単射 (bijection) が保証される。別のコンポーネントが color("red").padding(8) を書いても、生まれるクラスは同じものだ。変数を改名してもハッシュは変わらない。エスケープハッチ (cas.unsafe, .set) には用途のコストを命名で明示してあるため、誤用は静かに紛れ込めない。',
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

      <section>
        <h2 {...cas().fontSize(24).marginBottom(12).props}>{copy.pluginsTitle}</h2>
        <p>{copy.pluginsBlurb}</p>
      </section>
    </article>
  );
}
