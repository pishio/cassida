# FSS — Functional Style Sheet

Single-Class, Build-Time-Resolved CSS-in-JS.

```tsx
<div {...fss().marginTop(10, "em").color("red").color("blue")} />
```

ビルド後:

```tsx
<div className="fss-a3f9d2c1" />
```

```css
@layer fss {
  .fss-a3f9d2c1 { color: blue; margin-top: 10em }
}
```

`color("red")` は LIFO 解決により消滅し、ブラウザに渡るのは確定済みの 1 クラス・1 ルールのみ。CSS Specificity 計算は発生しません。

## Status

🚧 Pre-alpha — `@cassida/compiler` 着手段階。

## Packages

- `packages/compiler` — PropertyRegistry / Canonicalizer / Hasher / CssEmitter

## License

MIT
