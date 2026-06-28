import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Landing(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Cassida',
      tagline: 'A CSS-in-JS compiler that ends the class pile-up and the specificity fight at build time.',
      intro:
        'Tailwind stacks utility classes on every element; runtime CSS-in-JS keeps a style engine running in the browser. Cassida resolves the chain you write at build time and leaves one class on the element. The browser receives a single class name and one CSS rule grouped under @layer cas: no specificity arithmetic, no runtime style engine.',
      headlineLabel: 'A chain in, a class out:',
      browseApi: 'Browse the API →',
      pluginsTitle: 'Plugins',
      pluginsBlurb:
        'The maintainer-default bundle ships as @cassida/recommended (iOS-safe :hover gating + conditional JSX spreads resolved at build time). Add @cassida/plugin-global-css for preflight / reset rules and @cassida/plugin-print for the conservative @media print defaults — print is treated as a first-class output path, not an afterthought.',
      whyTitle: 'Why a new approach',
      whyBody:
        'BEM keeps state in class-name conventions; Tailwind composes one class per property per element. Both work, and both leave the cascade for the browser to resolve. Cassida resolves it earlier: the chain you write is collapsed into one normalised set of declarations, that set hashes to a single class, and the class sits in a dedicated cascade layer where specificity is fixed at 0,1,0. The CSS that ships is exactly the CSS you authored, and nothing else.',
      principleTitle: 'The Single Class Principle',
      principleBody:
        'One element, one class. The same chain shape produces the same class hash anywhere in the codebase: two components that write color("red").padding(8) emit the same class, and renaming a variable does not move the hash. The named escape paths (cas.unsafe, .set) carry their cost in the name so accidental use is visible at the call site.',
    },
    ja: {
      title: 'Cassida',
      tagline: 'クラスの積み上がりと詳細度の調整を、ビルド時に終わらせる CSS-in-JS コンパイラ。',
      intro:
        'Tailwind は要素にユーティリティクラスを積み上げ、ランタイム型の CSS-in-JS はブラウザでスタイル生成のエンジンを動かし続ける。Cassida は書いたチェーンをビルド時に解決し、要素には class を 1 つだけ残す。ブラウザが受け取るのは class 名 1 つと、@layer cas にまとめた CSS ルール 1 つだけだ。詳細度の計算も、ランタイムのスタイル生成も残らない。',
      headlineLabel: 'チェーンを入れ、クラスを得る:',
      browseApi: 'API を見る →',
      pluginsTitle: 'プラグイン',
      pluginsBlurb:
        'メンテナーが既定で有効にしているプラグインは @cassida/recommended にまとめてある (iOS の :hover 居座り対策と、条件分岐 spread のビルド時解決)。プリフライトやリセット CSS を扱う @cassida/plugin-global-css と、@media print の保守的なデフォルトを返す @cassida/plugin-print も別パッケージで用意してある。印刷は後付けの対象ではなく、最初から出力経路として組み込まれている。',
      whyTitle: 'なぜ別の道を選ぶのか',
      whyBody:
        'BEM は状態が増えるほどクラス名が伸びる。Tailwind は要素ごとにプロパティの数だけクラスを並べる。どちらも動くが、カスケードの解決はブラウザに委ねたままだ。Cassida は同じ問題をビルド時に解く。チェーンは 1 つの形に畳まれ、そこから安定したハッシュが決まり、専用の @layer cas に置かれた単一クラスになる。詳細度は (0,1,0) で固定され、出力される CSS は書いた内容そのものになる。',
      principleTitle: '単一クラスの原則',
      principleBody:
        '1 要素に 1 クラス。同じ形のチェーンは、コードベースのどこに書いても同じハッシュを生む。別のコンポーネントが color("red").padding(8) と書いても、出てくる class は同じものだ。変数名を変えてもハッシュは変わらない。レジストリを迂回する cas.unsafe や .set は、コストが名前そのものに書かれているので、うっかり使えば呼び出し位置で目に入る。',
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
