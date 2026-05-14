import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Recommended(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/recommended',
      intro:
        'One-line opt-in for the maintainers’ default-on plugin set. recommended() returns an object suitable for spreading directly into cassida(...) in vite.config.ts. The bundled plugins come along as transitive dependencies, so users install only @cassida/recommended.',
      contents: 'What’s bundled',
      hoverFix:
        '@cassida/plugin-hover-fix — wraps :hover scopes in @media (hover: hover) so iOS Safari doesn’t get stuck on touch-triggered hovers.',
      conditional:
        '@cassida/plugin-conditional — lifts conditional ternary and short-circuit JSX spreads from runtime fallback into the build-time class table; supports dynamic-slot branches via parallel style ternary.',
      surface: 'API surface',
      surfaceCopy:
        'recommended(options?) accepts per-plugin options. Pass `false` to disable a plugin, or an object to forward the plugin’s own options.',
      composing: 'Custom composition',
      composingCopy:
        'For projects that want a subset, skip recommended and import the factories directly — they’re re-exported from @cassida/recommended for convenience.',
    },
    ja: {
      title: '@cassida/recommended',
      intro:
        'メンテナーが既定で有効にしているプラグインセットを 1 行で導入できるバンドル。recommended() は vite.config.ts の cassida(...) に直接 spread できるオブジェクトを返します。同梱プラグインは transitive 依存として一緒に入るので、ユーザーは @cassida/recommended だけインストールすれば済みます。',
      contents: '同梱内容',
      hoverFix:
        '@cassida/plugin-hover-fix — :hover スコープを @media (hover: hover) で包むことで、iOS Safari のタッチ起因の :hover 残留を防ぎます。',
      conditional:
        '@cassida/plugin-conditional — 条件付き三項式や短絡 JSX spread をランタイムフォールバックからビルド時クラステーブルに引き上げます。動的スロット分岐は並列 style 三項式でサポート。',
      surface: 'API サーフェス',
      surfaceCopy:
        'recommended(options?) はプラグイン単位のオプションを受け取ります。`false` でプラグイン無効化、オブジェクトでプラグインのオプションを forwarding します。',
      composing: 'カスタム合成',
      composingCopy:
        'サブセットだけ欲しい場合は recommended をスキップしてファクトリを直接 import してください — 利便性のため @cassida/recommended から再 export されています。',
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

// Both enabled, default options
cassida(recommended())

// Disable hover-fix entirely
cassida(recommended({ hoverFix: false }))

// Customize conditional plugin options
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
