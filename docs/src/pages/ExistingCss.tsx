import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function ExistingCss(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Working with existing CSS',
      lead: 'Goal: run Cassida next to a reset, a design-system stylesheet, or legacy CSS, and know exactly which one wins.',
      layerHeading: 'Everything Cassida emits lives in one layer',
      layerBody:
        'Cassida wraps every rule in `@layer cas`. Cascade layers decide precedence by layer order, not by selector specificity. Declare the order once with `@layer base, cas;` and a class in `cas` beats a rule in `base`, however specific the `base` selector is.',
      presetHeading: 'Put resets and preflight in @layer base',
      presetBody:
        'Serve your reset or preflight through `@cassida/plugin-global-css`, which wraps it in `@layer base` by default. With `base` ordered before `cas`, your Cassida classes win without `!important` and without specificity tricks.',
      unlayeredHeading: 'Watch out: unlayered CSS beats every layer',
      unlayeredBody:
        'A declaration in no layer at all takes precedence over a declaration in any named layer. So plain legacy CSS — a stylesheet that never opted into `@layer` — overrides Cassida, not the other way round. To let Cassida win over it, pull that CSS into a layer too: import it with `layer()` and order it before `cas`.',
      renameHeading: 'Rename or drop the layer',
      renameBody:
        'Set `layer` in `cassida.config.json` to emit into a differently-named layer, or to `null` to skip the wrap. Skipping is almost always the wrong call: without the layer, Cassida competes with your other CSS on raw specificity, which is exactly what the single-class model exists to avoid.',
    },
    ja: {
      title: '既存 CSS との共存',
      lead: '目的: リセット CSS やデザインシステムのスタイルシート、レガシー CSS の隣で Cassida を動かし、どちらが勝つかを正確に把握する。',
      layerHeading: 'Cassida の出力はすべて 1 つのレイヤーに入る',
      layerBody:
        'Cassida はすべてのルールを `@layer cas` で包む。cascade layer の優先順位は、セレクタの詳細度ではなくレイヤーの順序で決まる。`@layer base, cas;` と一度だけ順序を宣言すれば、`base` のセレクタがどれだけ詳細でも `cas` のクラスが勝つ。',
      presetHeading: 'リセットやプリフライトは @layer base に入れる',
      presetBody:
        'リセットやプリフライトは `@cassida/plugin-global-css` 経由で配ると、既定で `@layer base` に包まれる。`base` を `cas` より前に並べておけば、Cassida のクラスは `!important` も詳細度の小細工もなしで勝つ。',
      unlayeredHeading: '注意: どのレイヤーにも入っていない CSS は全レイヤーに勝つ',
      unlayeredBody:
        'どのレイヤーにも属さない宣言は、名前付きレイヤーのどの宣言よりも優先される。`@layer` を一度も使っていない素のレガシー CSS は、Cassida を上書きする。逆ではない。Cassida を勝たせたいなら、その CSS もレイヤーに入れる。`layer()` 付きで import し、`cas` より前に並べればよい。',
      renameHeading: 'レイヤーの改名と無効化',
      renameBody:
        '`cassida.config.json` の `layer` を変えれば別名のレイヤーに出力でき、`null` にすれば層で包まなくなる。無効化はほぼ常に誤りだ。層がないと、Cassida は他の CSS と詳細度で競うことになる。それは単一クラスのモデルが避けるために存在している事態そのものだ。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p {...cas().fontSize(18).color('#1c1f24').props}><Prose>{copy.lead}</Prose></p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.layerHeading}</h2>
      <p><Prose>{copy.layerBody}</Prose></p>
      <Code source={`@layer base, cas;   /* set the order once, early */

@layer base {
  #app .title { color: gray }   /* high specificity... */
}
@layer cas {
  .cas-7f3a1c { color: black }  /* ...still wins: cas is the later layer */
}`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.presetHeading}</h2>
      <p><Prose>{copy.presetBody}</Prose></p>
      <Code source={`// vite.config.ts
import preflight from './preflight.css?raw';

cassidaGlobalCss({ css: preflight, layer: 'base' });
// emits:  @layer base { ...preflight... }`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.unlayeredHeading}</h2>
      <p><Prose>{copy.unlayeredBody}</Prose></p>
      <Code source={`/* legacy.css is plain and unlayered -> it would override @layer cas */
@import 'legacy.css' layer(legacy);
@layer legacy, cas;   /* now cas wins over legacy too */`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.renameHeading}</h2>
      <p><Prose>{copy.renameBody}</Prose></p>
      <Code source={`// cassida.config.json
{ "layer": "cas" }   // default; null skips the wrap (not recommended)`} />
    </article>
  );
}
