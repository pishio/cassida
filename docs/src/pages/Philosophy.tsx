import type React from 'react';
import { cas } from '@cassida/core';
import { useT } from '../lib/locale.js';
import { Code } from '../components/Code.js';

export default function Philosophy(): React.JSX.Element {
  const copy = useT({
    en: {
      title: 'Philosophy',
      lead: 'Cassida hands the browser one class per element, computed at build time. The cascade fight — specificity arithmetic, declaration order, source-vs-utility precedence — is resolved by the compiler before any bundle ships.',
      principlesHeading: 'Five principles',
      singleClassTitle: '1. Single Class Principle',
      singleClassBody:
        'One element, one class. No long strings of utility tokens on the class attribute. The compiler walks the chain, hashes the resolved bag, and emits a single cas-XXXXXXXX that covers every property the chain wrote.',
      zeroRuntimeTitle: '2. Zero-runtime',
      zeroRuntimeBody:
        'Chains that resolve statically vanish from the client bundle, cas() call and all. No styling logic runs in the browser. What ships is the class string and the CSS rule — nothing else.',
      lifoTitle: '3. LIFO Collapse',
      lifoBody:
        'When the same property is written twice in a chain — .color("red").color("blue") — the last write wins at build time. The earlier red is dropped by the compiler; it never reaches CSS. There is no cascade fight to resolve at runtime because the conflict was eliminated when the IR collapsed.',
      bijectionTitle: '4. Bijection',
      bijectionBody:
        'Three things — the chain shape, the emitted CSS rule body, the class hash — stand in one-to-one correspondence. The same chain shape produces the same class anywhere in the codebase; rename a variable, move the file, the hash does not move. The class you see in DevTools points back to exactly one chain in source.',
      shorthandTitle: '5. Shorthand Policy',
      shorthandBody:
        'Shorthand properties like background and margin quietly reset siblings you did not name. Cassida rejects them at the type level and accepts only the explicit longhands — backgroundColor, marginTop. The CSS that ships is deterministic; properties never reset out from under you.',
      sampleHeading: 'A chain, in and out',
      sampleNote: 'Author the chain on the JSX spread; the browser receives one class and one rule.',
      nameHeading: 'Why "Cassida"',
      nameBodyPara1:
        'The name answers a Japanese insect — toge-ari toge-nashi toge-toge, "the thorny non-thorny tortoise beetle," a name that contradicts itself twice. The CSS world wrote itself the same kind of name: utility-class strings of thirty tokens per element on one side, runtime CSS-in-JS engines on the other, each labelled as the cure for the other\'s flaw.',
      nameBodyPara2:
        'Cassida — Latin cassis, a helmet, and a genus inside the tortoise-beetle subfamily Cassidinae — picks neither side. The compiler folds the chain into one class at build time. The element wears one piece, the runtime carries no engine, and the shield is light because it is static.',
    },
    ja: {
      title: '設計思想',
      lead: 'Cassida は CSS の詳細度計算とランタイムでのスタイル生成を、コンパイラに肩代わりさせる。書いたチェーンはビルド時に 1 クラスへ畳まれ、ブラウザは出来上がったクラスを 1 つ受け取るだけになる。',
      principlesHeading: '5 つの原則',
      singleClassTitle: '1. 単一クラスの原則 (Single Class Principle)',
      singleClassBody:
        '1 つの要素には 1 つのクラスだけ。ユーティリティのトークンを長く連ねるような書き方はしない。コンパイラはチェーンを解析し、その要素のスタイルすべてを表す cas-XXXXXXXX を 1 つだけ出力する。',
      zeroRuntimeTitle: '2. ゼロランタイム (Zero-runtime)',
      zeroRuntimeBody:
        '静的に解決できるチェーンは、ブラウザに送る JS バンドルから cas() 呼び出しごと消える。スタイル生成のコードがクライアントで動くことは無い。出力されるのは class 名と CSS ルールだけだ。',
      lifoTitle: '3. LIFO 畳み込み (LIFO Collapse)',
      lifoBody:
        'cas().color("red").color("blue") のように同じプロパティが二度書かれたとき、後勝ち (Last-In wins) でビルド時に解決される。先に書いた red はコンパイラが消し、CSS には届かない。詳細度の競合が発生する余地そのものが無い。',
      bijectionTitle: '4. 全単射 (Bijection)',
      bijectionBody:
        'チェーンの形状、出力される CSS ルール、class 名のハッシュ — この三つが一対一に対応する。同じ形のチェーンはコードベースのどこに書いても同じ class を生む。変数名を変えても、ファイルを移してもハッシュは変わらない。DevTools に表示される class からソース上のチェーンへ、一意に辿り直せる。',
      shorthandTitle: '5. ショートハンド制限 (Shorthand Policy)',
      shorthandBody:
        'background や margin のような複合プロパティは、書いていない兄弟プロパティを黙ってリセットする。Cassida はこれらを型レベルで排除し、backgroundColor や marginTop など明示的な longhand のみを受け付ける。出力 CSS は決定論的になり、書いていないプロパティが勝手に戻ることは起こらない。',
      sampleHeading: 'チェーンを入れ、クラスを得る',
      sampleNote: 'JSX spread にチェーンを書けば、ブラウザは class 1 つと CSS ルール 1 つだけを受け取る。',
      nameHeading: 'なぜ "Cassida" なのか',
      nameBodyPara1:
        '名前は「トゲアリトゲナシトゲトゲ」という昆虫への返答だ。「トゲのある、トゲの無い、トゲトゲ」 — 二度自分を否定する自己矛盾の名。CSS の世界も同じ名前を自分につけてきた。要素に三十のトークンを並べる utility クラス文字列と、ランタイムでスタイルを毎度組み立てる CSS-in-JS エンジン — どちらも「相手の欠点の治療薬」を名乗ってきた。',
      nameBodyPara2:
        'Cassida はラテン語 cassis (兜) の語であり、カメノコハムシ亜科 (Cassidinae) に属する一属の名でもある。どちらの側にも与しない。コンパイラがビルド時にチェーンを 1 クラスへ畳む。要素はそれを 1 枚だけ身につけ、ランタイムにスタイル生成のエンジンは残らず、盾は静的だから軽い。',
    },
  });

  return (
    <article {...cas().display('flex').flexDirection('column').gap(16).props}>
      <h1 {...cas().fontSize(36).marginBottom(8).props}>{copy.title}</h1>
      <p {...cas().fontSize(18).color('#1c1f24').props}>{copy.lead}</p>

      <h2 {...cas().fontSize(24).marginTop(24).props}>{copy.principlesHeading}</h2>

      <section>
        <h3 {...cas().fontSize(18).marginTop(16).marginBottom(8).props}>{copy.singleClassTitle}</h3>
        <p>{copy.singleClassBody}</p>
      </section>

      <section>
        <h3 {...cas().fontSize(18).marginTop(16).marginBottom(8).props}>{copy.zeroRuntimeTitle}</h3>
        <p>{copy.zeroRuntimeBody}</p>
      </section>

      <section>
        <h3 {...cas().fontSize(18).marginTop(16).marginBottom(8).props}>{copy.lifoTitle}</h3>
        <p>{copy.lifoBody}</p>
        <Code source={`cas().color('red').color('blue')
// red is collapsed at build time; the CSS rule only carries color: blue.`} />
      </section>

      <section>
        <h3 {...cas().fontSize(18).marginTop(16).marginBottom(8).props}>{copy.bijectionTitle}</h3>
        <p>{copy.bijectionBody}</p>
      </section>

      <section>
        <h3 {...cas().fontSize(18).marginTop(16).marginBottom(8).props}>{copy.shorthandTitle}</h3>
        <p>{copy.shorthandBody}</p>
        <Code source={`// Rejected at the type level:
cas().background('#fff')
cas().margin(8)

// Accepted — explicit, deterministic:
cas().backgroundColor('#fff')
cas().marginTop(8).marginRight(8).marginBottom(8).marginLeft(8)`} />
      </section>

      <h2 {...cas().fontSize(24).marginTop(32).props}>{copy.sampleHeading}</h2>
      <p {...cas().color('#6b7280').fontSize(14).props}>{copy.sampleNote}</p>
      <Code source={`<button {...cas()
  .padding(12).backgroundColor('#1a73e8').color('white')
  .hover(c => c.backgroundColor('#1557b0'))
  .focus(c => c.backgroundColor('#0e3f87'))
  .props} />`} />
      <Code source={`<button className="cas-3702b738" />`} />
      <Code source={`@layer cas {
  .cas-3702b738        { background-color: #1a73e8; color: #fff; padding: 12px }
  .cas-3702b738:hover  { background-color: #1557b0 }
  .cas-3702b738:focus  { background-color: #0e3f87 }
}`} />

      <h2 {...cas().fontSize(24).marginTop(32).props}>{copy.nameHeading}</h2>
      <p>{copy.nameBodyPara1}</p>
      <p>{copy.nameBodyPara2}</p>
    </article>
  );
}
