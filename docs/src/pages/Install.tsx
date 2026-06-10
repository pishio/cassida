import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Install(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Install',
      quickStartHeading: '5-minute Quick Start',
      quickStartLead: 'Drop these four blocks into a fresh Vite + React app and you have a working Cassida project. Each block goes into the file named in the comment.',
      quickStartRun: 'Then start the dev server. Open the page in DevTools and confirm the heading carries one cas-XXXXXXXX class, and the rule lives inside @layer cas.',
      packagesHeading: 'Packages',
      packagesLead:
        'The typical setup is three packages: the runtime (@cassida/core), the Vite plugin that does the compile work, and the recommended bundle that flips on the maintainers\' default plugins. Yarn and npm work the same way; pnpm is what CI tests against.',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts (explained)',
      viteIntro:
        'Mount cassida() with the recommended bundle, then drop cassidaGlobalCss() in if you want preflight / reset CSS served through the same Vite pipeline.',
      appHeading: 'First chain (explained)',
      appIntro:
        'Author chains as JSX spread; the Vite plugin walks them at build time and rewrites every cas().X().props into a stable cas-XXXXXXXX className. The runtime carries no styling logic — it only exists for dynamic / dev-mode chains the parser deliberately defers.',
      verify:
        'Open DevTools and look: every styled element carries exactly one cas- class, every rule lives under @layer cas, and the JS bundle ships zero cas() calls for any chain the parser could resolve statically.',
    },
    ja: {
      title: 'インストール',
      quickStartHeading: '5 分で動かす',
      quickStartLead: '空の Vite + React プロジェクトに、以下の 4 つのブロックを順に置けば動く Cassida プロジェクトになる。各ブロックはコメントに書かれたファイルに保存する。',
      quickStartRun: 'あとは dev サーバを立ち上げる。DevTools でページを開き、見出しが cas-XXXXXXXX のクラスを 1 つだけ持ち、ルールが @layer cas の中にあることを確認する。',
      packagesHeading: 'パッケージ',
      packagesLead:
        '基本構成はパッケージ 3 つだ。ランタイムの @cassida/core、ビルド時にチェーンを書き換える Vite プラグイン、メンテナー推奨プラグインを 1 行で有効化する @cassida/recommended の 3 つ。yarn / npm でも同じ手順で導入できるが、CI で検証しているのは pnpm だ。',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts (解説)',
      viteIntro:
        'cassida() に recommended() を渡すだけで動く。プリフライトやリセット CSS を同じ Vite パイプラインに乗せたければ cassidaGlobalCss() を追加する。',
      appHeading: '最初のチェーン (解説)',
      appIntro:
        'チェーンは JSX spread として書く。Vite プラグインがビルド時にそれを走査し、cas().X().props を安定した cas-XXXXXXXX クラス名に書き換える。ランタイムはスタイリングの判断を持たず、パーサが意図的にビルド時解決を見送った動的チェーンと dev モードのためだけに存在する。',
      verify:
        'DevTools を開いて確かめると良い。スタイル付き要素には cas- クラスがちょうど 1 つだけ、ルールはすべて @layer cas の内側、JS バンドルにはパーサが静的解決できたチェーンの cas() 呼び出しは残らない。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>

      <h2 {...cas().fontSize(24).marginTop(8).props}>{copy.quickStartHeading}</h2>
      <p>{copy.quickStartLead}</p>
      <Code source={`# package.json — install
pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin @cassida/recommended @cassida/plugin-global-css vite @vitejs/plugin-react react react-dom`} />
      <Code source={`// vite.config.ts
import { defineConfig } from 'vite';
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
      <Code source={`// src/App.tsx
import { cas } from '@cassida/core';

export default function App() {
  return (
    <main {...cas().padding(24).maxWidth(720).props}>
      <h1 {...cas().color('crimson').fontSize(28).props}>Hello, Cassida.</h1>
    </main>
  );
}`} />
      <Code source={`// src/main.tsx
import { createRoot } from 'react-dom/client';
import App from './App.js';

createRoot(document.getElementById('root')!).render(<App />);`} />
      <p>{copy.quickStartRun}</p>
      <Code source={`pnpm vite`} />

      <h2 {...cas().fontSize(24).marginTop(32).props}>{copy.packagesHeading}</h2>
      <p>{copy.packagesLead}</p>

      <h3 {...cas().fontSize(20).marginTop(16).props}>{copy.pnpmHeading}</h3>
      <Code source={`pnpm add @cassida/core
pnpm add -D @cassida/vite-plugin @cassida/recommended`} />

      <h3 {...cas().fontSize(20).marginTop(16).props}>{copy.npmHeading}</h3>
      <Code source={`npm install @cassida/core
npm install -D @cassida/vite-plugin @cassida/recommended`} />

      <h3 {...cas().fontSize(20).marginTop(16).props}>{copy.yarnHeading}</h3>
      <Code source={`yarn add @cassida/core
yarn add -D @cassida/vite-plugin @cassida/recommended`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.viteHeading}</h2>
      <p>{copy.viteIntro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.appHeading}</h2>
      <p>{copy.appIntro}</p>
      <p {...cas().color('#6b7280').fontSize(14).props}>{copy.verify}</p>
    </article>
  );
}
