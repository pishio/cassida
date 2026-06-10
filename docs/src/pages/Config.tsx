import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code, Prose } from '../components/Code.js';

export default function Config(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Configuration',
      intro:
        'Drop a `cassida.config.json` at the project root. The Vite plugin auto-discovers it and merges your values over the documented defaults. Every field is optional — leave a key out and you get the default.',
      fields: 'Fields',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '`"strict"` (default) refuses shorthand ↔ longhand co-occurrence in either direction within the same scope. `"shorthand-first"` allows longhand → shorthand but still refuses the reverse (the direction that bites silently). `"lenient"` disables the check entirely; you’re telling Cassida to trust the downstream cascade with the conflict resolution.',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '`"mobile-first"` (default) sorts `min-width` queries low → high. `"desktop-first"` sorts `max-width` queries high → low. `em` / `rem` are normalized at 16px so they interleave with `px` in the right order. Non-width queries (`print`, `prefers-color-scheme`, …) trail the width block alphabetically.',
      layerTitle: 'layer',
      layerCopy:
        'The cascade layer Cassida wraps every emitted rule in. Defaults to `"cas"`. Setting it to `null` disables the wrap — almost always the wrong choice, because the layer is what lets a Cassida class beat a preflight rule without specificity tricks.',
      hashTitle: 'hash',
      hashCopy:
        'Class-hash format. Defaults: `{ prefix: "cas-", length: 8 }`. An 8-character MurmurHash3 collides with vanishing probability in real projects; raise `length` if you operate at "every chain in npm" scale.',
      cssTitle: 'css',
      cssCopy:
        'Emission mode and post-processing. `mode: "rule-per-class"` (one rule per class hash, default) or `"shared-by-declaration"` (group declarations across classes for a tiny size win). `lightningcss.enabled` pipes the emitted CSS through lightningcss for autoprefixing and minification.',
    },
    ja: {
      title: '設定',
      intro:
        'プロジェクトルートに `cassida.config.json` を置く。Vite プラグインがこれを自動で見つけ、指定された値を既定値の上にマージする。すべてのフィールドは optional で、書かなかったキーは既定値が使われる。',
      fields: 'フィールド',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '`"strict"` (デフォルト) は、同じスコープ内に shorthand と longhand が同居することを、どちら向きでも拒否する。`"shorthand-first"` は longhand → shorthand の順だけ許す。逆向き (黙ってバグる方向) は引き続き拒否する。`"lenient"` はチェックを完全に外す。衝突の解決はブラウザ側のカスケードに委ねる、と明示的に決めた場合だけ選ぶ。',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '`"mobile-first"` (デフォルト) は `min-width` クエリを小 → 大の順に並べる。`"desktop-first"` は `max-width` クエリを大 → 小の順に並べる。`em` / `rem` は 16px で正規化されるので、`px` と混ぜても順序が一貫する。幅基準でないクエリ (`print`、`prefers-color-scheme` など) は、幅ブロックの後にアルファベット順で続く。',
      layerTitle: 'layer',
      layerCopy:
        'Cassida が出力するすべてのルールを包む cascade layer の名前。デフォルトは `"cas"`。`null` にすると層で包まずに出力できるが、ほぼ常に誤った選択になる。Cassida のクラスが詳細度の小細工なしでプリフライトより優先されるのは、この層に置かれているからだ。',
      hashTitle: 'hash',
      hashCopy:
        'クラスハッシュの形式。デフォルトは `{ prefix: "cas-", length: 8 }`。8 文字の MurmurHash3 は、現実的なプロジェクト規模では無視できる確率でしか衝突しない。npm 上の全チェーンを 1 つのインデックスで扱うような規模で運用する場合に限り、`length` を伸ばす。',
      cssTitle: 'css',
      cssCopy:
        '出力モードと後処理の設定。`mode: "rule-per-class"` は 1 クラスにつき 1 ルールを出力する (デフォルト)。`"shared-by-declaration"` は同じ宣言を持つクラスをまとめて出力サイズを少し縮める。`lightningcss.enabled` を true にすると、出力された CSS を lightningcss に通してベンダープレフィックスと minify を行う。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p><Prose>{copy.intro}</Prose></p>

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
      <p><Prose>{copy.shorthandCopy}</Prose></p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.mediaSortTitle}</h3>
      <p><Prose>{copy.mediaSortCopy}</Prose></p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.layerTitle}</h3>
      <p><Prose>{copy.layerCopy}</Prose></p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.hashTitle}</h3>
      <p><Prose>{copy.hashCopy}</Prose></p>

      <h3 {...cas().fontSize(18).marginTop(16).props}>{copy.cssTitle}</h3>
      <p><Prose>{copy.cssCopy}</Prose></p>
    </article>
  );
}
