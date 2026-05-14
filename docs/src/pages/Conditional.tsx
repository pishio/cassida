import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Conditional(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-conditional',
      intro:
        'Parser plugin that lifts conditional-shaped JSX spreads from the runtime fallback into the build-time class table. Recognized shapes: ternary `{...(cond ? cas().X() : cas().Y())}` and short-circuit `{...(cond && cas().X())}`. Each branch becomes its own cas-XXXXXXXX class; the JSX spread is rewritten to a ternary className expression. CSS for both branches is registered with the emitter so runtime lookup is just a string switch.',
      dynamicHeading: 'Dynamic-slot branches (v0.4+)',
      dynamicCopy:
        'Versions prior to v0.4 bailed when either branch carried a dynamic slot (CSS variable). v0.4+ keeps the build-time path active: dynamic branches emit a parallel branch-conditional style={...} ternary that mirrors the className shape. Branches without dynamics use `void 0` so React skips style application cleanly.',
      optionsHeading: 'Options',
      optionsShortCircuit:
        'shortCircuit: accept LogicalExpression `&&` spreads. Defaults to true. Disable if you want JSX-level branching to remain explicit and surface authoring mistakes as bail-outs.',
      bailHeading: 'When the plugin bails',
      bailCopy:
        'Plugin returns null (defers to runtime) when: either branch isn’t a Cassida chain, the logical operator is || or ??, or the chain shape isn’t fully recognized. Bail is silent; the chain runs as-is via the runtime cas() builder.',
    },
    ja: {
      title: '@cassida/plugin-conditional',
      intro:
        '条件式形状の JSX spread をランタイムフォールバックからビルド時クラステーブルに引き上げる Parser プラグイン。認識する形状: 三項式 `{...(cond ? cas().X() : cas().Y())}` と短絡 `{...(cond && cas().X())}`。各分岐は独自の cas-XXXXXXXX クラスとなり、JSX spread は三項式 className 式に書き換えられます。両分岐の CSS は emitter に登録されるので、ランタイムは単なる文字列スイッチで済みます。',
      dynamicHeading: '動的スロット分岐 (v0.4+)',
      dynamicCopy:
        'v0.4 未満ではどちらかの分岐に動的スロット (CSS 変数) があるとビルド時パスを諦めていました。v0.4+ はビルド時パスを維持し、動的な分岐に対して並列の分岐条件付き style={...} 三項式を className 三項式と同形で発行します。動的を持たない分岐は `void 0` を入れて React に style 適用をスキップさせます。',
      optionsHeading: 'オプション',
      optionsShortCircuit:
        'shortCircuit: 論理式 `&&` の spread を受け入れます。デフォルト true。JSX レベルの分岐を明示的に保ち、書き間違いをビルド時の bail として可視化したい場合は false にします。',
      bailHeading: 'プラグインが bail する条件',
      bailCopy:
        '次のいずれかでプラグインは null を返し、ランタイムにフォールバックします: いずれかの分岐が Cassida チェーンでない、論理演算子が || または ??、チェーン形状が完全に認識できない。bail は silent で、チェーンはランタイムの cas() ビルダー経由でそのまま動作します。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>
      <Code source={`// before
<button {...(highlight ? cas().shadowXl() : cas().shadowMd()).props} />

// after build
<button className={highlight ? "cas-XXXXXXXX" : "cas-YYYYYYYY"} />`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.dynamicHeading}</h2>
      <p>{copy.dynamicCopy}</p>
      <Code source={`// dynamic branch + static alternate
<div {...(active
  ? cas().color(theme.fg)
  : cas().color('blue')).props} />

// after build
<div
  className={active ? "cas-AAAAAAAA" : "cas-BBBBBBBB"}
  style={active ? { '--cas-fg': theme.fg } : void 0}
/>`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.optionsHeading}</h2>
      <ul {...cas().display('flex').flexDirection('column').gap(8).props}>
        <li>{copy.optionsShortCircuit}</li>
      </ul>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.bailHeading}</h2>
      <p>{copy.bailCopy}</p>
    </article>
  );
}
