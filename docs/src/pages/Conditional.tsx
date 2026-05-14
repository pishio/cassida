import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Conditional(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-conditional',
      intro:
        'A parser plugin that lifts conditional-shaped JSX spreads from the runtime fallback into the build-time class table. Recognised shapes: the ternary `{...(cond ? cas().X() : cas().Y())}` and the short-circuit `{...(cond && cas().X())}`. Each branch resolves to its own cas-XXXXXXXX class; the spread itself is rewritten as a ternary className. Both branches register independently, so they participate in the standard dedup pipeline.',
      dynamicHeading: 'Dynamic-slot branches (v0.4+)',
      dynamicCopy:
        'Versions prior to v0.4 bailed when either branch carried a dynamic slot (a CSS variable). v0.4+ keeps the build-time path active: dynamic branches emit a parallel branch-conditional `style={...}` ternary that mirrors the className shape. Branches without dynamics use `void 0`, so React skips the style application cleanly.',
      optionsHeading: 'Options',
      optionsShortCircuit:
        'shortCircuit: accept LogicalExpression `&&` spreads. Defaults to true. Disable when you want JSX-level branching to stay explicit and unintended `&&` spreads to surface as bail-outs.',
      bailHeading: 'When the plugin bails',
      bailCopy:
        'The plugin returns null (deferring to runtime) when either branch isn’t a Cassida chain, when the logical operator is `||` or `??`, or when the chain shape isn’t fully recognised. Bail is silent — the chain still runs via the runtime cas() builder.',
    },
    ja: {
      title: '@cassida/plugin-conditional',
      intro:
        '条件式形状の JSX spread をランタイムフォールバックからビルド時クラステーブルへ引き上げるパーサプラグイン。認識する形は 2 つ — 三項式 `{...(cond ? cas().X() : cas().Y())}` と短絡 `{...(cond && cas().X())}`。各分岐は独自の cas-XXXXXXXX クラスへ解決され、spread 自体は三項式 className に書き換わる。両分岐は独立に登録されるため、通常の dedup パイプラインに乗る。',
      dynamicHeading: '動的スロット分岐 (v0.4+)',
      dynamicCopy:
        'v0.4 未満ではどちらかの分岐に動的スロット (CSS 変数) があるとビルド時パスを諦めていた。v0.4+ はそのままビルド時パスを維持する — 動的な分岐に対しては、className 三項式と並列の分岐条件付き `style={...}` 三項式を発行する。動的を持たない分岐は `void 0` となるため、React は style 適用を素直にスキップする。',
      optionsHeading: 'オプション',
      optionsShortCircuit:
        'shortCircuit: 論理式 `&&` 形の spread を受け入れる。デフォルト true。JSX レベルの分岐を明示的に保ち、意図しない `&&` 形を bail として可視化したい場合は false にする。',
      bailHeading: 'プラグインが bail する条件',
      bailCopy:
        'いずれかの分岐が Cassida チェーンでない、論理演算子が `||` や `??`、またはチェーン形状が完全に認識できないとき、プラグインは null を返してランタイムにフォールバックする。bail は silent で、チェーンはランタイムの cas() ビルダー経由でそのまま動く。',
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
