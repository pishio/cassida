import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';

export default function Landing(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Cassida',
      tagline: 'One element, one class — compiled, not cascaded.',
      intro:
        'A build-time CSS-in-JS compiler. Cassida collapses every styling chain to exactly one class per element via LIFO resolution at build time; the browser never computes specificity for Cassida-generated rules. Every :hover, @media, and nested rule sits inside a single @layer cas cascade layer with one stable class hash.',
      headlineLabel: 'A typical chain compiles to:',
      browseApi: 'Browse the API →',
      pluginsTitle: 'Plugins',
      pluginsBlurb:
        'The bundled @cassida/recommended brings the maintainers’ default-on plugins (hover-fix + conditional spreads). Drop in @cassida/plugin-global-css for preflight / reset CSS, and @cassida/plugin-print for sensible @media print defaults.',
    },
    ja: {
      title: 'Cassida',
      tagline: '1 つの要素、1 つのクラス — カスケードではなくコンパイルで。',
      intro:
        'ビルド時に動作する CSS-in-JS コンパイラです。Cassida はすべてのチェーンを 1 要素あたりちょうど 1 クラスに LIFO で畳み込みます。ブラウザは Cassida 生成のルールで詳細度計算を行いません。:hover、@media、ネストされたルールはすべて単一の @layer cas カスケードレイヤー内に収まり、安定したクラスハッシュを共有します。',
      headlineLabel: '典型的なチェーンはこのようにコンパイルされます:',
      browseApi: 'API を見る →',
      pluginsTitle: 'プラグイン',
      pluginsBlurb:
        '@cassida/recommended にはメンテナーが既定で有効にしているプラグイン (hover-fix と conditional spreads) が含まれます。プリフライト/リセット CSS には @cassida/plugin-global-css、印刷向けの妥当な @media print デフォルトには @cassida/plugin-print を組み合わせて使えます。',
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
        <CodeBlock
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
        <CodeBlock
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

      <section>
        <h2 {...cas().fontSize(24).marginBottom(12).props}>{copy.pluginsTitle}</h2>
        <p {...cas().marginBottom(16).props}>{copy.pluginsBlurb}</p>
      </section>
    </article>
  );
}

function CodeBlock({ source }: { source: string }): React.JSX.Element {
  return (
    <pre
      {...cas()
        .padding(16)
        .borderRadius(8)
        .backgroundColor('#0f172a')
        .color('#e2e8f0')
        .fontSize(13)
        .lineHeight(1.6)
        .overflowX('auto')
        .whiteSpace('pre').props}
    >
      <code>{source}</code>
    </pre>
  );
}
