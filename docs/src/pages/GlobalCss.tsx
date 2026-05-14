import type React from 'react';
import { cas } from '@cassida/core';
import { t } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function GlobalCss(): React.JSX.Element {
  const copy = t({
    en: {
      title: '@cassida/plugin-global-css',
      intro:
        'Vite plugin that serves arbitrary global CSS — preflight, resets, body / tag-selector rules — through a virtual module, wrapped in a configurable @layer so it composes cleanly with Cassida’s single-class output. Cassida’s chains always emit exactly one class per element; this plugin fills the gap for rules like body { ... } or *, ::before, ::after { ... } without introducing a second styling system.',
      install: 'Install',
      use: 'Use',
      optionsHeading: 'Options',
      optionsCss: 'css: the raw CSS string. The plugin does not parse or transform it — passed through to Vite as-is, then wrapped in @layer if `layer` is non-null.',
      optionsLayer:
        'layer: cascade layer name to wrap the CSS in. Defaults to "base" so the canonical @layer base, cas; declaration lets Cassida classes in @layer cas win without specificity tricks. Pass null to skip the wrap.',
      optionsVirtualId:
        'virtualId: virtual module id. Defaults to "virtual:cassida-global.css". Override to mount multiple instances (e.g. one for preflight, one for print).',
    },
    ja: {
      title: '@cassida/plugin-global-css',
      intro:
        'グローバル CSS (preflight、reset、body / タグセレクタルール) を virtual module 経由で提供する Vite プラグイン。configurable な @layer で包み、Cassida の単一クラス出力と綺麗に共存できます。Cassida のチェーンは常に 1 要素 1 クラスを emit するので、body { ... } や *, ::before, ::after { ... } のようなルールを書く穴をこのプラグインが埋めます — 二重の styling system を持ち込むことなく。',
      install: 'インストール',
      use: '使い方',
      optionsHeading: 'オプション',
      optionsCss: 'css: 生の CSS 文字列。プラグインは解析・変換せず Vite にそのまま渡し、`layer` が null でない場合は @layer で包みます。',
      optionsLayer:
        'layer: CSS を包む cascade layer 名。デフォルト "base"。canonical な @layer base, cas; 宣言と組み合わせれば、@layer cas にある Cassida クラスが詳細度トリックなしで勝ちます。null で wrap をスキップ。',
      optionsVirtualId:
        'virtualId: virtual module の id。デフォルト "virtual:cassida-global.css"。複数インスタンスを mount する場合 (preflight 用 + print 用 など) は別の id を指定します。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.install}</h2>
      <Code source={`pnpm add -D @cassida/plugin-global-css`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.use}</h2>
      <Code source={`// vite.config.ts
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import preflight from './preflight.css?raw';

export default defineConfig({
  plugins: [
    cassida(recommended()),
    cassidaGlobalCss({ css: preflight, layer: 'base' }),
  ],
});

// main.tsx
import 'virtual:cassida-global.css';`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.optionsHeading}</h2>
      <ul {...cas().display('flex').flexDirection('column').gap(8).props}>
        <li>{copy.optionsCss}</li>
        <li>{copy.optionsLayer}</li>
        <li>{copy.optionsVirtualId}</li>
      </ul>
    </article>
  );
}
