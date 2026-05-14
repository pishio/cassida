import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Install(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Install',
      intro:
        'Three packages cover the typical setup: the runtime (@cassida/core), the Vite plugin that does the compile work, and the recommended bundle that flips on the maintainers’ default plugins. Yarn and npm work the same way; pnpm is what we test against.',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts',
      viteIntro:
        'Mount cassida() with the recommended bundle, then drop cassidaGlobalCss() in if you want preflight / reset CSS served through the same Vite pipeline.',
      appHeading: 'First chain',
      appIntro:
        'Author chains as JSX spread; the Vite plugin walks them at build time and rewrites every cas().X().props into a stable cas-XXXXXXXX className. The runtime carries no styling logic — it only exists for dynamic / dev-mode chains the parser deliberately defers.',
      verify:
        'Open DevTools and look: every styled element carries exactly one cas- class, every rule lives under @layer cas, and the JS bundle ships zero cas() calls for any chain the parser could resolve statically.',
    },
    ja: {
      title: 'インストール',
      intro:
        '基本構成はパッケージ 3 つだ。ランタイムの @cassida/core、ビルド時の変換を担う Vite プラグイン、そしてメンテナー推奨プラグインを 1 行で有効化する @cassida/recommended。yarn・npm でも同じ手順で導入できるが、CI で検証しているのは pnpm だ。',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts',
      viteIntro:
        'cassida() に recommended() を渡すだけで動く。プリフライトやリセット CSS を同じ Vite パイプラインに乗せたければ cassidaGlobalCss() を追加する。',
      appHeading: '最初のチェーン',
      appIntro:
        'チェーンは JSX spread として書く。Vite プラグインがビルド時にそれを走査し、cas().X().props を安定した cas-XXXXXXXX クラス名へと書き換える。ランタイムはスタイリングの判断を持たない — パーサが意図的にビルド時解決を見送った動的チェーンや dev モードのためだけに存在する。',
      verify:
        'DevTools を開いて確かめると良い: スタイル付き要素には cas- クラスがちょうど 1 つだけ、ルールはすべて @layer cas の内側、JS バンドルにはパーサが静的解決できたチェーンの cas() 呼び出しは残らない。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.pnpmHeading}</h2>
      <Code source={`pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin @cassida/recommended`} />

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.npmHeading}</h2>
      <Code source={`npm install @cassida/core
npm install -D @cassida/vite-plugin @cassida/recommended`} />

      <h2 {...cas().fontSize(20).marginTop(16).props}>{copy.yarnHeading}</h2>
      <Code source={`yarn add @cassida/core
yarn add -D @cassida/vite-plugin @cassida/recommended`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.viteHeading}</h2>
      <p>{copy.viteIntro}</p>
      <Code source={`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';
import { recommended } from '@cassida/recommended';
import { cassidaGlobalCss } from '@cassida/plugin-global-css';

export default defineConfig({
  plugins: [
    cassida(recommended()),
    cassidaGlobalCss({ css: 'body { margin: 0 }', layer: 'base' }),
    react(),
  ],
});`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.appHeading}</h2>
      <p>{copy.appIntro}</p>
      <Code source={`import { cas } from '@cassida/core';

export default function App() {
  return (
    <main {...cas().padding(24).maxWidth(720).props}>
      <h1 {...cas().color('crimson').fontSize(28).props}>Hello, Cassida.</h1>
    </main>
  );
}`} />
      <p {...cas().color('#6b7280').fontSize(14).props}>{copy.verify}</p>
    </article>
  );
}
