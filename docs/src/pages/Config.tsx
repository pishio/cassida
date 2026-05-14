import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Config(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Configuration',
      intro:
        'Drop a cassida.config.json at the project root. The Vite plugin auto-discovers it and merges your values over the documented defaults. Every field is optional — leave a key out and you get the default.',
      fields: 'Fields',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '"strict" (default) refuses shorthand ↔ longhand co-occurrence in either direction within the same scope. "shorthand-first" allows longhand → shorthand but still refuses the reverse (the direction that bites silently). "lenient" disables the check entirely; you’re telling Cassida to trust the downstream cascade with the conflict resolution.',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '"mobile-first" (default) sorts min-width queries low → high. "desktop-first" sorts max-width queries high → low. em / rem are normalised at 16px so they interleave with px in the right order. Non-width queries (print, prefers-color-scheme, …) trail the width block alphabetically.',
      layerTitle: 'layer',
      layerCopy:
        'The cascade layer Cassida wraps every emitted rule in. Defaults to "cas". Setting it to null disables the wrap — almost always the wrong choice, because the layer is what lets a Cassida class beat a preflight rule without specificity tricks.',
      hashTitle: 'hash',
      hashCopy:
        'Class-hash format. Defaults: { prefix: "cas-", length: 8 }. An 8-character MurmurHash3 collides with vanishing probability in real projects; raise length if you operate at "every chain in npm" scale.',
      cssTitle: 'css',
      cssCopy:
        'Emission mode and post-processing. mode: "rule-per-class" (one rule per class hash, default) or "shared-by-declaration" (group declarations across classes for a tiny size win). lightningcss.enabled pipes the emitted CSS through lightningcss for autoprefixing and minification.',
    },
    ja: {
      title: '設定',
      intro:
        'プロジェクトルートに cassida.config.json を置く。Vite プラグインが自動で見つけ、指定された値を documented デフォルトの上にマージする。すべてのフィールドは optional — キーを書かなければデフォルトが採用される。',
      fields: 'フィールド',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '"strict" (デフォルト) は同一スコープ内での shorthand と longhand の共起をどちらの方向でも拒否する。"shorthand-first" は longhand → shorthand を許すが、逆方向 (静かにバグる方向) は依然として拒否する。"lenient" はチェックを完全に無効化する — 下流のカスケードに衝突解決を委ねる宣言だと理解した上で選ぶ。',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '"mobile-first" (デフォルト) は min-width クエリを小 → 大にソートする。"desktop-first" は max-width クエリを大 → 小にソートする。em / rem は 16px で正規化されるため、px と適切な順で交互に並ぶ。幅基準でないクエリ (print、prefers-color-scheme など) は幅ブロックの後ろにアルファベット順で続く。',
      layerTitle: 'layer',
      layerCopy:
        'Cassida が emit するすべてのルールを包む cascade layer 名。デフォルトは "cas"。null にすると wrap を無効化できるが、ほぼ常に誤った選択だ — Cassida のクラスがプリフライトを詳細度トリックなしで凌ぐのは、このレイヤーの存在のおかげだ。',
      hashTitle: 'hash',
      hashCopy:
        'クラスハッシュのフォーマット。デフォルトは { prefix: "cas-", length: 8 }。8 文字の MurmurHash3 は実用上は無視できる確率でしか衝突しない。npm 上の全チェーン規模で動かす場合のみ length を引き上げる。',
      cssTitle: 'css',
      cssCopy:
        '出力モードと後処理。mode: "rule-per-class" (クラスハッシュごとに 1 ルール、デフォルト) または "shared-by-declaration" (値ごとに宣言をグルーピングして CSS サイズを微減)。lightningcss.enabled を true にすると、emit された CSS が lightningcss を通って autoprefix と minify を受ける。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p>{copy.intro}</p>

      <Code source={`{
  "$schema": "./node_modules/@cassida/compiler/config.schema.json",

  "layer": "cas",
  "importSource": "@cassida/core",

  "hash": { "prefix": "cas-", "length": 8 },

  "media": { "sort": "mobile-first" },

  "css": {
    "mode": "rule-per-class",
    "lightningcss": {
      "enabled": false,
      "minify": true,
      "targets": null
    }
  },

  "shorthand": { "policy": "strict" }
}`} />

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.fields}</h2>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.shorthandTitle}</h3>
      <p>{copy.shorthandCopy}</p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.mediaSortTitle}</h3>
      <p>{copy.mediaSortCopy}</p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.layerTitle}</h3>
      <p>{copy.layerCopy}</p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.hashTitle}</h3>
      <p>{copy.hashCopy}</p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.cssTitle}</h3>
      <p>{copy.cssCopy}</p>
    </article>
  );
}
