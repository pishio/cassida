import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Recommended(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/recommended',
      intro:
        'The maintainers’ default-on plugin set, behind a single import. recommended() returns an object you spread straight into cassida(...) in vite.config.ts; the bundled plugins come along as transitive dependencies, so installing one package covers the whole curated bundle.',
      contents: 'What ships in the bundle',
      hoverFix:
        '@cassida/plugin-hover-fix — gates every :hover scope behind @media (hover: hover) so iOS Safari never gets stuck on a tap-triggered hover state.',
      conditional:
        '@cassida/plugin-conditional — lifts conditional-ternary and short-circuit JSX spreads into the build-time class table. Dynamic-slot branches stay on the build-time path via a parallel branch-conditional style ternary.',
      surface: 'API',
      surfaceCopy:
        'recommended(options?) accepts per-plugin options. Pass false to disable a plugin outright, or an options object to forward configuration to the underlying plugin.',
      composing: 'Custom composition',
      composingCopy:
        'For projects that want a different mix, skip recommended() and import the factories directly — they’re re-exported from @cassida/recommended for ergonomics. Pass the result into cassida()’s plugins / parserPlugins lists by hand.',
    },
    ja: {
      title: '@cassida/recommended',
      intro:
        'メンテナーがデフォルトで有効にしているプラグインのまとまりを、import 1 行で取り込むためのバンドル。recommended() は vite.config.ts の cassida(...) にそのまま spread できるオブジェクトを返す。中身のプラグインは依存として一緒に入るので、このパッケージ 1 つで既定のセットが揃う。',
      contents: '同梱されるもの',
      hoverFix:
        '@cassida/plugin-hover-fix — すべての :hover スコープを @media (hover: hover) で包む。iOS Safari でタップした要素が :hover 状態のまま残り続ける問題を回避する。',
      conditional:
        '@cassida/plugin-conditional — 三項式や短絡 (&&) で書かれた JSX spread を、ビルド時のクラス選択に書き換える。動的な値を含む分岐も、対応する style を選ぶ三項式と組み合わせることでビルド時の経路に残り続ける。',
      surface: 'API',
      surfaceCopy:
        'recommended(options?) はプラグインごとのオプションを受け取る。false を渡すとそのプラグインを完全に外せる。オブジェクトを渡した場合は、その中身が各プラグインのオプションとしてそのまま渡される。',
      composing: 'カスタム合成',
      composingCopy:
        '別の組み合わせで使いたいときは recommended() を経由せず、各プラグインのファクトリを直接 import する。書きやすさのために @cassida/recommended からも再 export してある。得られた値を cassida() の plugins / parserPlugins に手で渡す。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.contents}</h2>
      <ul {...cas().display('flex').flexDirection('column').gap(8).props}>
        <li>{copy.hoverFix}</li>
        <li>{copy.conditional}</li>
      </ul>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.surface}</h2>
      <p>{copy.surfaceCopy}</p>
      <Code source={`import cassida from '@cassida/vite-plugin';
import { recommended } from '@cassida/recommended';

// Both enabled with default options
cassida(recommended())

// Disable hover-fix outright
cassida(recommended({ hoverFix: false }))

// Customize the conditional plugin
cassida(recommended({ conditional: { shortCircuit: false } }))`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.composing}</h2>
      <p>{copy.composingCopy}</p>
      <Code source={`import { hoverFix, conditionalSpread } from '@cassida/recommended';

cassida({
  plugins: [hoverFix({ query: '(hover: hover) and (pointer: fine)' })],
  parserPlugins: [conditionalSpread({ shortCircuit: false })],
});`} />
    </article>
  );
}
