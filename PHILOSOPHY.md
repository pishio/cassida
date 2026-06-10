# Cassida — Philosophy

> One element, one class. Compiled, not cascaded.

Cassida hands the browser one class per element, computed at build time. The
cascade fight — specificity arithmetic, declaration order, source-vs-utility
precedence — is resolved by the compiler before any bundle ships.

## Five principles

### 1. Single Class Principle

One element, one class. No long strings of utility tokens on the class
attribute. The compiler walks the chain, hashes the resolved bag, and emits
a single `cas-XXXXXXXX` that covers every property the chain wrote.

### 2. Zero-runtime

Chains that resolve statically vanish from the client bundle, `cas()` call
and all. No styling logic runs in the browser. What ships is the class
string and the CSS rule — nothing else.

### 3. LIFO Collapse

When the same property is written twice in a chain —
`.color('red').color('blue')` — the last write wins at build time. The
earlier `red` is dropped by the compiler; it never reaches CSS. There is no
cascade fight to resolve at runtime because the conflict was eliminated when
the IR collapsed.

### 4. Bijection

Three things — the chain shape, the emitted CSS rule body, the class hash —
stand in one-to-one correspondence. The same chain shape produces the same
class anywhere in the codebase; rename a variable, move the file, the hash
does not move. The class you see in DevTools points back to exactly one
chain in source.

### 5. Shorthand Policy

Shorthand properties like `background` and `margin` quietly reset siblings
you did not name. Cassida rejects them at the type level and accepts only
the explicit longhands — `backgroundColor`, `marginTop`. The CSS that ships
is deterministic; properties never reset out from under you.

## A chain, in and out

```tsx
<button {...cas()
  .padding(12).backgroundColor('#1a73e8').color('white')
  .hover(c => c.backgroundColor('#1557b0'))
  .focus(c => c.backgroundColor('#0e3f87'))
  .props} />
```

becomes:

```tsx
<button className="cas-3702b738" />
```

```css
@layer cas {
  .cas-3702b738        { background-color: #1a73e8; color: #fff; padding: 12px }
  .cas-3702b738:hover  { background-color: #1557b0 }
  .cas-3702b738:focus  { background-color: #0e3f87 }
}
```

## Why "Cassida"

The name answers a Japanese insect — *toge-ari toge-nashi toge-toge*, "the
thorny non-thorny tortoise beetle," a name that contradicts itself twice.
The CSS world wrote itself the same kind of name: utility-class strings of
thirty tokens per element on one side, runtime CSS-in-JS engines on the
other, each labelled as the cure for the other's flaw.

Cassida — Latin *cassis*, a helmet, and a genus inside the tortoise-beetle
subfamily *Cassidinae* — picks neither side. The compiler folds the chain
into one class at build time. The element wears one piece, the runtime
carries no engine, and the shield is light because it is static.

---

# Cassida — 設計思想

> 1 要素、1 クラス。カスケードではなく、コンパイル。

Cassida は CSS の詳細度計算とランタイムでのスタイル生成を、コンパイラに肩
代わりさせる。書いたチェーンはビルド時に 1 クラスへ畳まれ、ブラウザは出来
上がったクラスを 1 つ受け取るだけになる。

## 5 つの原則

### 1. 単一クラスの原則 (Single Class Principle)

1 つの要素には 1 つのクラスだけ。ユーティリティのトークンを長く連ねるよう
な書き方はしない。コンパイラはチェーンを解析し、その要素のスタイルすべて
を表す `cas-XXXXXXXX` を 1 つだけ出力する。

### 2. ゼロランタイム (Zero-runtime)

静的に解決できるチェーンは、ブラウザに送る JS バンドルから `cas()` 呼び出
しごと消える。スタイル生成のコードがクライアントで動くことは無い。出力さ
れるのは class 名と CSS ルールだけだ。

### 3. LIFO 畳み込み (LIFO Collapse)

`cas().color('red').color('blue')` のように同じプロパティが二度書かれた
とき、後勝ち (Last-In wins) でビルド時に解決される。先に書いた `red` は
コンパイラが消し、CSS には届かない。詳細度の競合が発生する余地そのものが
無い。

### 4. 全単射 (Bijection)

チェーンの形状、出力される CSS ルール、class 名のハッシュ — この三つが一
対一に対応する。同じ形のチェーンはコードベースのどこに書いても同じ class
を生む。変数名を変えても、ファイルを移してもハッシュは変わらない。DevTools
に表示される class からソース上のチェーンへ、一意に辿り直せる。

### 5. ショートハンド制限 (Shorthand Policy)

`background` や `margin` のような複合プロパティは、書いていない兄弟プロパ
ティを黙ってリセットする。Cassida はこれらを型レベルで排除し、`background
Color` や `marginTop` など明示的な longhand のみを受け付ける。出力 CSS は
決定論的になり、書いていないプロパティが勝手に戻ることは起こらない。

## なぜ "Cassida" なのか

名前は「トゲアリトゲナシトゲトゲ」という昆虫への返答だ。「トゲのある、ト
ゲの無い、トゲトゲ」 — 二度自分を否定する自己矛盾の名。CSS の世界も同じ
名前を自分につけてきた。要素に三十のトークンを並べる utility クラス文字
列と、ランタイムでスタイルを毎度組み立てる CSS-in-JS エンジン — どちらも
「相手の欠点の治療薬」を名乗ってきた。

Cassida はラテン語 *cassis* (兜) の語であり、カメノコハムシ亜科
*Cassidinae* に属する一属の名でもある。どちらの側にも与しない。コンパイ
ラがビルド時にチェーンを 1 クラスへ畳む。要素はそれを 1 枚だけ身につけ、
ランタイムにスタイル生成のエンジンは残らず、盾は静的だから軽い。
