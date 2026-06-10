import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function GlobalCss(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-global-css',
      intro:
        'A Vite plugin that serves arbitrary global CSS — preflight, resets, body / tag-selector rules — through a virtual module, wrapped in a configurable @layer so it composes cleanly with Cassida’s single-class output. Cassida’s chains always emit exactly one class per element; this plugin fills the gap for everything that can’t be expressed that way, without introducing a second styling system.',
      install: 'Install',
      use: 'Use',
      optionsHeading: 'Options',
      optionsCss:
        'css: the raw CSS string. The plugin doesn’t parse or transform it — passed through to Vite as-is, then wrapped in @layer when `layer` is non-null.',
      optionsLayer:
        'layer: the cascade layer to wrap the CSS in. Defaults to "base", so the canonical @layer base, cas; declaration lets Cassida classes in @layer cas win without specificity tricks. Pass null to skip the wrap.',
      optionsVirtualId:
        'virtualId: the virtual module id. Defaults to "virtual:cassida-global.css". Override to mount multiple instances (one for preflight, one for print, …).',
    },
    ja: {
      title: '@cassida/plugin-global-css',
      intro:
        'グローバルな CSS (プリフライト、リセット、body / タグセレクタのルール) を virtual module 経由で配信する Vite プラグイン。包む @layer の名前は設定で変えられるので、Cassida の単一クラス出力と素直に共存する。Cassida のチェーンは 1 要素につき 1 クラスしか出さない設計のため、その形に乗せられないルール (body 直接、universal selector など) はこのプラグインが受け持つ。スタイリングの仕組みを 2 系統に分けるためのものではない。',
      install: 'インストール',
      use: '使い方',
      optionsHeading: 'オプション',
      optionsCss:
        'css: 生の CSS 文字列。プラグインは解析も変換もせずに Vite に渡す。`layer` が null でないときは @layer で包んでから渡す。',
      optionsLayer:
        'layer: CSS を包む cascade layer の名前。デフォルトは "base"。`@layer base, cas;` の宣言を CSS の先頭に置くことを前提とし、@layer cas にある Cassida のクラスが詳細度の小細工なしでこのレイヤーより優先される。null を渡すと包まずに出力できる。',
      optionsVirtualId:
        'virtualId: virtual module の id。デフォルトは "virtual:cassida-global.css"。複数のインスタンスを並行で使う場合 (プリフライト用と印刷用、など) は、それぞれ別の id を指定する。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <Code source={`import { cassidaGlobalCss } from '@cassida/plugin-global-css';

cassidaGlobalCss({
  css: 'body { margin: 0; font-family: system-ui }',
  layer: 'base',
});`} />
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
