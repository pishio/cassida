import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function NextPlugin(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/next-plugin',
      lead: 'The Next.js side of the build pipeline. It pairs an IR-comment loader (which reads the markers emitted by @cassida/swc-plugin), a webpack plugin (which serves @cassida/next-plugin/virtual.css through webpack-virtual-modules), and a cross-compiler bridge (which lets Server-only Server Component styles reach the Client compiler\'s stylesheet).',
      configHeading: 'withCassida()',
      configCopy: 'The entry point. Pass it your next config and it returns a config with the SWC plugin (./next entry of @cassida/swc-plugin) wired into experimental.swcPlugins and the webpack plugin wired into config.webpack. Plain object configs and config functions are both supported.',
      virtualHeading: '/virtual.css',
      virtualCopy: 'The exports map ships @cassida/next-plugin/virtual.css as a one-byte placeholder file. The CassidaWebpackPlugin replaces its contents on every compilation via webpack-virtual-modules.writeModule. Import it once at the root of the App Router (app/layout.tsx) — the import is the signal to Next.js that the route depends on the stylesheet.',
      pluginHeading: 'CassidaWebpackPlugin lifecycle',
      pluginCopy: 'The plugin taps three webpack hooks. compiler.hooks.thisCompilation seeds the virtual placeholder so the resolver can find the module while app/layout.tsx is being built. compilation.hooks.processAssets fires at stage PROCESS_ASSETS_STAGE_PRE_PROCESS (-1000) — by that stage every JSX file has been through the IR loader, so the store is complete; writeModule lands the real CSS before CSS minimisation and chunking finalise.',
      pluginHmrCopy: 'compiler.hooks.beforeRun (production) and compiler.hooks.watchRun (dev) clear that compiler\'s namespace before its loaders re-run. Stale rules from since-deleted source files no longer accumulate across next dev HMR passes, and the OTHER compiler\'s namespace is preserved so the cross-compiler bridge survives.',
      bridgeHeading: 'Cross-compiler bridge',
      bridgeCopy: 'Next.js spawns separate webpack compilers ("client" / "server" / "edge" / "middleware") and they each see only their own module graph. A Server-only Server Component (one that never gets bundled into the Client graph) still writes cas() chains; if the Client compiler\'s virtual.css doesn\'t pick those up, the className the RSC payload carries lands in the browser with no matching CSS rule.',
      bridgeCopy2: 'The store is therefore keyed (compilerName, filename) two-level. Each compiler\'s loader writes into its own namespace. allRules() merges every namespace on the read path. The merge is the bridge.',
      storeHeading: 'Store API',
      storeCopy: 'The store is module-singleton on the Node side; @cassida/next-plugin/store exposes it for tooling. allRules() returns every rule across every compiler namespace — that is what the webpack plugin reads to assemble virtual.css. allRulesForCompiler(name) reads a single namespace, useful for testing or for tools that need to introspect what a specific compiler emitted.',
      subscribeCopy: 'subscribe(listener) is for live updates — the listener fires whenever any namespace changes. The listener takes no arguments; call allRules() inside it to read the merged rule list as of that moment. CassidaWebpackPlugin uses this internally to rewrite virtual.css when a chain changes during HMR.',
    },
    ja: {
      title: '@cassida/next-plugin',
      lead: 'ビルドパイプラインの Next.js 側を受け持つパッケージ。@cassida/swc-plugin が emit したマーカーを読む IR コメントローダー、webpack-virtual-modules を介して @cassida/next-plugin/virtual.css を配信する webpack プラグイン、そして Server Component だけで書かれたスタイルが Client コンパイラの stylesheet に届くようにするクロスコンパイラブリッジ — この 3 つを束ねている。',
      configHeading: 'withCassida()',
      configCopy: 'エントリポイント。next config を渡すと、SWC プラグイン (@cassida/swc-plugin の "./next" エントリ) を experimental.swcPlugins に登録し、webpack プラグインを config.webpack に登録した config を返す。プレーンなオブジェクト config と関数型 config の両方に対応する。',
      virtualHeading: '/virtual.css',
      virtualCopy: 'exports map は @cassida/next-plugin/virtual.css を 1 バイトのプレースホルダーとして配布している。CassidaWebpackPlugin が compilation のたびに、webpack-virtual-modules の writeModule を通して中身を上書きする。App Router のルート (app/layout.tsx) で 1 度だけ import する。この import は「このルートは stylesheet に依存している」という signal として Next.js に伝わる。',
      pluginHeading: 'CassidaWebpackPlugin のライフサイクル',
      pluginCopy: 'プラグインは webpack の 3 つのフックに乗っている。compiler.hooks.thisCompilation で virtual のプレースホルダーを仕込むことで、app/layout.tsx のビルド時にリゾルバがモジュールを見つけられるようにする。compilation.hooks.processAssets が PROCESS_ASSETS_STAGE_PRE_PROCESS (-1000) で発火する時点では、すべての JSX が IR ローダーを通過した後なので store は完成している。CSS の minify や chunking が終わる前に writeModule で本物の CSS を書き込む。',
      pluginHmrCopy: 'compiler.hooks.beforeRun (production) と compiler.hooks.watchRun (dev) は、各コンパイラのローダーが再実行される直前に、そのコンパイラ自身の namespace だけをクリアする。削除されたソースファイルから来た古いルールは next dev の HMR で蓄積しなくなり、それでいて相手側コンパイラの namespace は保たれるので、クロスコンパイラブリッジは生き続ける。',
      bridgeHeading: 'クロスコンパイラブリッジ',
      bridgeCopy: 'Next.js は webpack コンパイラを複数 ("client" / "server" / "edge" / "middleware") 立ち上げ、それぞれが自分のモジュールグラフしか見ない。Server Component の中でも Client グラフに一切 bundle されないファイル (Server-only な Server Component) があるが、そこで書かれた cas() チェーンを Client コンパイラの virtual.css が拾わないと、RSC payload に乗ってきた className が、ブラウザでは対応する CSS ルールを持たない宙ぶらりんな class になってしまう。',
      bridgeCopy2: 'そのためストアは (compilerName, filename) の 2 段で keyed されている。各コンパイラのローダーは自分の namespace に書き込み、allRules() は読み取り時に全 namespace をマージする。このマージそのものがブリッジだ。',
      storeHeading: 'Store API',
      storeCopy: 'ストアは Node 側でモジュール単位の singleton になっており、@cassida/next-plugin/store からツール向けに公開されている。allRules() は全コンパイラ namespace を横断したルール集合を返す。webpack プラグインが virtual.css を組み立てるときに読む先だ。allRulesForCompiler(name) は単一 namespace だけを返す。テストや、特定コンパイラが何を emit したか調べたいツール向け。',
      subscribeCopy: 'subscribe(listener) はライブ更新用。いずれかの namespace が変化したタイミングでリスナが呼ばれる。リスナは引数を取らないので、その時点でのマージ済みルールが必要なら listener の中で allRules() を呼び直す。CassidaWebpackPlugin は HMR でチェーンが変わったとき virtual.css を書き直すためにこれを内部で使っている。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <Code source={`// next.config.mjs
import { withCassida } from '@cassida/next-plugin';
export default withCassida({ /* your config */ });

// app/layout.tsx
import '@cassida/next-plugin/virtual.css';`} />
      <p>{copy.lead}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.configHeading}</h2>
      <p>{copy.configCopy}</p>
      <Code source={`// next.config.mjs — plain object
import { withCassida } from '@cassida/next-plugin';
export default withCassida({
  reactStrictMode: true,
});

// next.config.mjs — function form
export default withCassida((phase, { defaultConfig }) => ({
  ...defaultConfig,
  reactStrictMode: true,
}));`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.virtualHeading}</h2>
      <p>{copy.virtualCopy}</p>
      <Code source={`// app/layout.tsx — root of the App Router
import type React from 'react';
import '@cassida/next-plugin/virtual.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.pluginHeading}</h2>
      <p>{copy.pluginCopy}</p>
      <p>{copy.pluginHmrCopy}</p>
      <Code source={`// Lifecycle (conceptual)
compiler.hooks.thisCompilation     // seed virtual.css placeholder
compilation.hooks.processAssets    // stage -1000 (PRE_PROCESS): writeModule with real CSS
compiler.hooks.beforeRun           // prod: clear this compiler's namespace
compiler.hooks.watchRun            // dev:  clear this compiler's namespace per HMR cycle`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.bridgeHeading}</h2>
      <p>{copy.bridgeCopy}</p>
      <p>{copy.bridgeCopy2}</p>
      <Code source={`// Store keys (conceptual)
{
  client:     { 'app/page.tsx':      [...rules] },
  server:     { 'app/dashboard.tsx': [...rules] },
  edge:       { },
  middleware: { },
}
// allRules() returns the union across all four compilers.`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.storeHeading}</h2>
      <p>{copy.storeCopy}</p>
      <Code source={`import { allRules, allRulesForCompiler, subscribe } from '@cassida/next-plugin/store';

// Every rule, across every compiler namespace
const merged = allRules();

// Per-namespace read
const clientOnly = allRulesForCompiler('client');`} />
      <p>{copy.subscribeCopy}</p>
      <Code source={`import { allRules, subscribe } from '@cassida/next-plugin/store';

const unsubscribe = subscribe(() => {
  const rules = allRules();
  // rules is the merged list as of the latest write
});

// later
unsubscribe();`} />
    </article>
  );
}
