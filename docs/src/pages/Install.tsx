import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Install(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Install',
      intro:
        'Cassida is published on npm under the @cassida scope. Most consumers install three packages: the runtime, the Vite plugin, and the recommended bundle.',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts',
      viteIntro:
        'Wire Cassida and the recommended plugin bundle into Vite. Add cassidaGlobalCss for preflight / reset CSS.',
      appHeading: 'First chain',
      appIntro:
        'Once the Vite plugin is active, any cas() chain in your JSX gets compiled at build time. The classnames are stable hashes of the chain shape.',
      verify: 'Open DevTools — every styled element has exactly one cas-XXXXXXXX class, and every rule lives inside @layer cas.',
    },
    ja: {
      title: 'インストール',
      intro:
        'Cassida は npm の @cassida スコープで配布しています。多くのユーザーは「ランタイム + Vite プラグイン + recommended バンドル」の 3 つを入れます。',
      pnpmHeading: 'pnpm',
      npmHeading: 'npm',
      yarnHeading: 'yarn',
      viteHeading: 'vite.config.ts',
      viteIntro:
        'Cassida と recommended プラグインバンドルを Vite に組み込みます。プリフライト / リセット CSS には cassidaGlobalCss を追加してください。',
      appHeading: '最初のチェーン',
      appIntro:
        'Vite プラグインが有効になれば、JSX 内の cas() チェーンはビルド時にコンパイルされます。クラス名はチェーン形状から導出される安定ハッシュです。',
      verify: 'DevTools を開いてください — スタイル付き要素には cas-XXXXXXXX クラスが 1 つだけ付き、ルールはすべて @layer cas 内に収まっています。',
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
