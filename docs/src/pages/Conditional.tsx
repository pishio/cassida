import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function Conditional(): React.JSX.Element {
  const copy = useT({
    en: {
      title: '@cassida/plugin-conditional',
      intro:
        'A parser plugin that lifts conditional-shaped JSX spreads from the runtime fallback into the build-time class table. Recognized shapes: the ternary `{...(cond ? cas().X() : cas().Y())}` and the short-circuit `{...(cond && cas().X())}`. Each branch resolves to its own `cas-XXXXXXXX` class; the spread itself is rewritten as a ternary `className`. Both branches register independently, so they participate in the standard dedup pipeline.',
      dynamicHeading: 'Dynamic-slot branches (v0.4+)',
      dynamicCopy:
        'Versions prior to v0.4 bailed when either branch carried a dynamic slot (a CSS variable). v0.4+ keeps the build-time path active: dynamic branches emit a parallel branch-conditional `style={...}` ternary that mirrors the `className` shape. Branches without dynamics use `void 0`, so React skips the style application cleanly.',
      optionsHeading: 'Options',
      optionsShortCircuit:
        '`shortCircuit`: accept `LogicalExpression` `&&` spreads. Defaults to `true`. Disable when you want JSX-level branching to stay explicit and unintended `&&` spreads to surface as bail-outs.',
      bailHeading: 'When the plugin bails',
      bailCopy:
        'The plugin returns `null` (deferring to runtime) when either branch isn’t a Cassida chain, when the logical operator is `||` or `??`, or when the chain shape isn’t fully recognized. Bail is silent — the chain still runs via the runtime `cas()` builder.',
    },
    ja: {
      title: '@cassida/plugin-conditional',
      intro:
        '条件式の形をした JSX spread を、ランタイムへのフォールバックではなくビルド時のクラス選択に書き換えるパーサプラグイン。認識する形は 2 つ。三項式 `{...(cond ? cas().X() : cas().Y())}` と、短絡 `{...(cond && cas().X())}` だ。それぞれの分岐は独自の cas-XXXXXXXX クラスに解決され、spread 自体は className を選ぶ三項式に書き換わる。分岐は独立に登録されるので、通常の重複排除の経路にもそのまま乗る。',
      dynamicHeading: '動的な値を含む分岐 (v0.4+)',
      dynamicCopy:
        'v0.4 より前は、どちらかの分岐に動的な値 (CSS 変数で受け渡す値) があるとビルド時の経路を諦めていた。v0.4+ ではそのままビルド時の経路を維持する。動的な分岐に対しては、`className` を選ぶ三項式に加えて、対応する `style={...}` を選ぶ三項式も出力する。動的な値を持たない側は `void 0` になるので、React はその場合 style の適用を黙ってスキップする。',
      optionsHeading: 'オプション',
      optionsShortCircuit:
        '`shortCircuit`: `&&` の形の spread を受け入れるかどうか。デフォルトは `true`。JSX レベルの分岐を三項式に限定したい、または意図せず書かれた `&&` の形を bail (= ランタイムへのフォールバックが発生した箇所) として目立たせたい場合は `false` にする。',
      bailHeading: 'プラグインが bail する条件',
      bailCopy:
        'いずれかの分岐が Cassida のチェーンでない、論理演算子が `||` や `??`、またはチェーンの形が完全には認識できないとき、プラグインは `null` を返してランタイム経路に渡す。bail はエラーにはならず静かに行われ、チェーンはランタイムの `cas()` ビルダーを通って動き続ける。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <Code source={`// before
<button {...(highlight ? cas().shadowXl() : cas().shadowMd()).props} />

// after build
<button className={highlight ? "cas-XXXXXXXX" : "cas-YYYYYYYY"} />`} />
      <p><Prose>{copy.intro}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.dynamicHeading}</h2>
      <p><Prose>{copy.dynamicCopy}</Prose></p>
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
        <li><Prose>{copy.optionsShortCircuit}</Prose></li>
      </ul>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.bailHeading}</h2>
      <p><Prose>{copy.bailCopy}</Prose></p>
    </article>
  );
}
