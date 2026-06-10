import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';

interface Term {
  readonly id: string;
  readonly term: string;
  readonly body: string;
}

export default function Glossary(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Glossary',
      lead: 'Short definitions for terms that appear across the docs. Each entry has a stable anchor so other pages can link directly to its definition.',
      terms: [
        {
          id: 'single-class-principle',
          term: 'Single Class Principle',
          body: 'One element wears one class. The compiler resolves every styling chain into exactly one cas-XXXXXXXX class — no utility-token strings on the class attribute, no per-property class composition. The browser receives one class per element and one rule per class.',
        },
        {
          id: 'zero-runtime',
          term: 'Zero-runtime',
          body: 'Chains that the build pipeline can resolve statically disappear from the client bundle entirely — the cas() call site and its argument expressions are gone. No styling logic runs in the browser. The dev server and dynamic chains keep a small runtime, but it never ships to production for static call sites.',
        },
        {
          id: 'lifo-collapse',
          term: 'LIFO Collapse',
          body: 'When the same property is written twice in one chain — .color("red").color("blue") — the last write wins at build time. The earlier value is dropped by the compiler; it never reaches the CSS. The cascade is not consulted because the conflict was eliminated before emission.',
        },
        {
          id: 'bijection',
          term: 'Bijection',
          body: 'The chain shape, the emitted CSS rule body, and the class hash stand in one-to-one correspondence. Same chain shape → same class hash, anywhere in the codebase. Rename a variable, move the file, the hash does not move. From a class in DevTools you can find exactly one chain in source.',
        },
        {
          id: 'canonical',
          term: 'Canonical',
          body: 'A hand-curated, csstype-typed entry in the registry. Canonical methods (margin, padding, color, …) get autocomplete with real CSS values; the shorthand-policy guard applies to them. The auto-generated entries from mdn-data fill the long tail with a permissive (string | number) signature.',
        },
        {
          id: 'longhand',
          term: 'Longhand',
          body: 'A CSS property that writes one logical value (paddingTop, borderColor, …) as opposed to a shorthand that bundles several (padding, border). Cassida prefers longhands at the API surface — the typed cas() chain rejects the blacklisted shorthands at compile time.',
        },
        {
          id: 'shorthand-policy',
          term: 'Shorthand Policy',
          body: 'The build-time guard that decides whether shorthand and longhand may coexist inside the same scope. "strict" (default) refuses both directions. "shorthand-first" allows longhand → shorthand only. "lenient" disables the guard. See the Configuration page.',
        },
        {
          id: 'modifier-scope',
          term: 'Modifier scope',
          body: 'The region opened by a modifier callback (.hover(c => …), .media("(max-width: 480px)", c => …)). Writes inside the callback are accumulated inside that scope and emitted as one scoped rule when the callback returns. LIFO collapse runs independently inside each scope.',
        },
        {
          id: 'cascade-layer',
          term: '@layer cas',
          body: 'The cascade layer that wraps every Cassida-emitted rule. Configured by config.layer ("cas" by default). The layer is what lets Cassida classes win against preflight / reset CSS without specificity tricks — declare @layer base, cas; in source order, and the cas layer beats base regardless of selector arithmetic.',
        },
        {
          id: 'props-terminator',
          term: '.props (terminator)',
          body: 'The chain terminator that yields { className, style } — exactly the two attributes JSX needs. Required because the chain object exposes ~460 method handles, several of which collide with HTML attribute names (translate, disabled, color, …); spreading the raw chain fails React\'s JSX type. .props pares it to the two keys React wants.',
        },
        {
          id: 'rsc-bridge',
          term: 'Cross-compiler bridge (Next.js)',
          body: 'Inside Next.js App Router, @cassida/next-plugin\'s store is keyed first by webpack compiler ("client" / "server" / "edge" / "middleware"), then by file. allRules() merges every namespace on the read path — that merge is the mechanism by which Server-only Server Component styles reach the Client compiler\'s virtual.css.',
        },
      ] satisfies readonly Term[],
    },
    ja: {
      title: '用語集',
      lead: 'ドキュメント全体に出てくる用語の短い定義集。各項目に anchor がついているので、別のページから定義へ直接リンクできる。',
      terms: [
        {
          id: 'single-class-principle',
          term: '単一クラスの原則 (Single Class Principle)',
          body: '1 つの要素には 1 つのクラス。コンパイラはスタイリングチェーンを 1 つの cas-XXXXXXXX に解決する。class 属性にユーティリティトークンの羅列を並べたり、プロパティごとにクラスを連結したりはしない。ブラウザは要素ごとに 1 つのクラスと、クラスごとに 1 つのルールだけを受け取る。',
        },
        {
          id: 'zero-runtime',
          term: 'ゼロランタイム (Zero-runtime)',
          body: 'ビルド時に静的に解決できたチェーンは、クライアントバンドルから完全に消える。cas() 呼び出しもその引数式も残らない。ブラウザではスタイリングのロジックが一切動かない。dev サーバや動的チェーン向けには小さなランタイムが存在するが、静的に解決された呼び出し位置には本番ビルドで残らない。',
        },
        {
          id: 'lifo-collapse',
          term: 'LIFO 畳み込み (LIFO Collapse)',
          body: '同じプロパティが 1 つのチェーン内で 2 回書かれたとき (例: .color("red").color("blue"))、後勝ち (Last-In wins) でビルド時に解決される。先に書いた値はコンパイラが消し、CSS には届かない。カスケードに問い合わせる必要はない。衝突自体が emit 前に消えているからだ。',
        },
        {
          id: 'bijection',
          term: '全単射 (Bijection)',
          body: 'チェーンの形、出力される CSS ルール、class 名のハッシュ — この三つが一対一に対応する。同じ形のチェーンはコードベースのどこに書いても同じハッシュを生む。変数名を変えても、ファイルを移してもハッシュは変わらない。DevTools に表示される class から、ソース上のチェーンへ一意に辿り直せる。',
        },
        {
          id: 'canonical',
          term: 'canonical (手書きエントリ)',
          body: 'レジストリの中で、手書きで csstype 型付けされているエントリ。canonical なメソッド (margin、padding、color、…) は IDE で実際の CSS 値の補完が並ぶ。shorthand-policy ガードもこれらに適用される。mdn-data から自動生成された残りのエントリは、(string | number) を受ける緩い形でロングテールを埋める。',
        },
        {
          id: 'longhand',
          term: 'longhand',
          body: '1 つの論理値だけを書く CSS プロパティ (paddingTop、borderColor、…)。複数を 1 度に書く shorthand (padding、border) の対になる概念。Cassida は API 面で longhand を優先し、ブラックリスト化された shorthand は型付きの cas() チェーンからコンパイル時に拒否される。',
        },
        {
          id: 'shorthand-policy',
          term: 'shorthand-policy',
          body: '同じスコープ内に shorthand と longhand が同居してよいかをビルド時に判定するガード。"strict" (デフォルト) はどちら向きでも拒否する。"shorthand-first" は longhand → shorthand の順だけ許す。"lenient" はガードを無効にする。詳細は Configuration ページ。',
        },
        {
          id: 'modifier-scope',
          term: '修飾子スコープ',
          body: '修飾子のコールバック (.hover(c => …), .media("(max-width: 480px)", c => …)) が開く領域。コールバック内の書き込みはそのスコープに記録され、コールバックから戻った時点でスコープ付きの 1 ルールとして出力される。LIFO 畳み込みは各スコープの内側で独立に走る。',
        },
        {
          id: 'cascade-layer',
          term: '@layer cas',
          body: 'Cassida が出力するすべてのルールを包む cascade layer。config.layer で名前を変えられる (デフォルトは "cas")。プリフライトや reset CSS に対して、Cassida のクラスが詳細度の小細工なしで優先されるのはこのレイヤーのおかげだ。ソース順で @layer base, cas; を宣言しておけば、セレクタの詳細度計算によらず cas が base に勝つ。',
        },
        {
          id: 'props-terminator',
          term: '.props (終端子)',
          body: 'チェーンを { className, style } の形に閉じる終端子。これは JSX が必要としている 2 属性そのもの。チェーンオブジェクトは約 460 個のメソッドハンドルを持ち、そのうち translate / disabled / color などは HTML 属性と名前が衝突するため、生のままチェーンを spread すると React の JSX 型が拒否する。.props はその union を 2 キーに絞る。',
        },
        {
          id: 'rsc-bridge',
          term: 'クロスコンパイラブリッジ (Next.js)',
          body: 'Next.js App Router の中で、@cassida/next-plugin のストアは webpack コンパイラ ("client" / "server" / "edge" / "middleware") とファイル名の 2 段で keyed される。allRules() は読み取り時にすべての namespace をマージする。このマージが、Server-only な Server Component で書かれたスタイルを Client コンパイラの virtual.css へ届ける仕組みになっている。',
        },
      ] satisfies readonly Term[],
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p {...cas().fontSize(16).color('#1c1f24').props}>{copy.lead}</p>

      <dl {...cas().display('flex').flexDirection('column').gap(20).marginTop(16).props}>
        {copy.terms.map((t) => (
          <div key={t.id} id={t.id}>
            <dt {...cas().fontSize(18).fontWeight(600).marginBottom(6).props}>
              <a
                href={`#${t.id}`}
                {...cas()
                  .color('#1c1f24')
                  .textDecorationLine('none')
                  .hover((c) => c.textDecorationLine('underline')).props}
              >
                {t.term}
              </a>
            </dt>
            <dd {...cas().fontSize(15).color('#1c1f24').marginLeft(0).props}>{t.body}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
