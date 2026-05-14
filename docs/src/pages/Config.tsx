import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Config(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Configuration',
      intro:
        'Place cassida.config.json at the project root. The vite plugin auto-discovers it; values not specified fall back to documented defaults.',
      fields: 'Fields',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '"strict" (default) bans shorthand ↔ longhand co-occurrence in either direction within a single scope. "shorthand-first" allows longhand → shorthand but still bans the reverse (the bug-prone direction). "lenient" disables the check entirely; downstream cascade decides on its own.',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '"mobile-first" (default) sorts min-width queries low → high. "desktop-first" sorts max-width queries high → low. em/rem are normalized at 16px so they sort correctly relative to px. Non-width queries (print, prefers-color-scheme, …) follow width-based ones alphabetically.',
      layerTitle: 'layer',
      layerCopy:
        'Cascade layer name to wrap every Cassida-emitted rule in. Defaults to "cas". Set to null to disable layer wrapping (rarely a good idea; cascade-layer composition is what lets Cassida classes win over preflight without specificity tricks).',
      hashTitle: 'hash',
      hashCopy:
        'Class hash format. Defaults: { prefix: "cas-", length: 8 }. Increase length if you expect hash collisions in extremely large projects (vanishingly unlikely under 8-char MurmurHash3).',
      cssTitle: 'css',
      cssCopy:
        'Output mode and post-processing. mode: "rule-per-class" (default — one rule per class hash) or "shared-by-declaration" (group declarations by value across classes for tiny CSS savings). lightningcss.enabled = true pipes the emitted CSS through lightningcss for autoprefixing and minification.',
    },
    ja: {
      title: '設定',
      intro:
        'プロジェクトルートに cassida.config.json を置きます。Vite プラグインが自動検出し、指定されないフィールドは documented なデフォルトにフォールバックします。',
      fields: 'フィールド',
      shorthandTitle: 'shorthand.policy',
      shorthandCopy:
        '"strict" (デフォルト) は単一スコープ内での shorthand と longhand の共起をどちらの方向でも拒否します。"shorthand-first" は longhand → shorthand を許可しますが逆方向 (バグを誘発しやすい方向) は依然禁止。"lenient" はチェックを完全に無効化し、下流の cascade に判断を委ねます。',
      mediaSortTitle: 'media.sort',
      mediaSortCopy:
        '"mobile-first" (デフォルト) は min-width クエリを小 → 大にソート。"desktop-first" は max-width クエリを大 → 小にソート。em/rem は 16px で正規化されるので px との相対順序が正しく決まります。幅基準でないクエリ (print、prefers-color-scheme 等) は幅基準クエリの後にアルファベット順で並びます。',
      layerTitle: 'layer',
      layerCopy:
        'Cassida が emit するすべてのルールを包む cascade layer 名。デフォルト "cas"。null にすると layer wrapping を無効化 (preflight に対して詳細度トリックなしで Cassida クラスが勝つのは cascade-layer の構成によるものなので、無効化は推奨されません)。',
      hashTitle: 'hash',
      hashCopy:
        'クラスハッシュのフォーマット。デフォルト: { prefix: "cas-", length: 8 }。極端に大規模なプロジェクトでハッシュ衝突を懸念する場合は length を増やします (8 文字 MurmurHash3 で衝突する確率は実質ゼロ)。',
      cssTitle: 'css',
      cssCopy:
        '出力モードと後処理。mode: "rule-per-class" (デフォルト — クラスハッシュごとに 1 ルール) または "shared-by-declaration" (値ごとに宣言をグルーピング、CSS サイズが微減)。lightningcss.enabled = true で emit された CSS を lightningcss に通して autoprefix・minify します。',
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
