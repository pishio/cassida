//! Op-list intermediate representation produced by the chain walker
//! and consumed (after JSON serialisation) by the Node post-pass in
//! `@cassida/next-plugin`. The JSON shape mirrors the existing TS
//! `Op` discriminated union from `@cassida/compiler/types.ts`
//! byte-for-byte so the SWC and Babel parsing paths feed `compileOps`
//! the same canonical input.

use serde::Serialize;

/// Discriminated union of chain ops. JSON discrimination is by which
/// fields the object carries (untagged), matching the TS shape. Use
/// the conventional helpers (`is_method`, etc.) at consumption sites.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum Op {
    Method(MethodOp),
    Scoped(ScopedOp),
    Raw(RawOp),
}

/// A method call captured from a `cas()` chain, e.g. `color('red')`.
/// `args` carries each argument as raw JSON. Phase 1 only emits
/// literal primitives (string / number / boolean / null); Phase 2
/// will add dynamic-arg placeholders here.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MethodOp {
    pub method: String,
    pub args: Vec<serde_json::Value>,
}

/// A scope-introducing call: `.hover(c => ...)`, `.media(q, c => ...)`,
/// `.on(sel, c => ...)`, and the zero-arg pseudo-element modifiers
/// (`before`, `after`, `placeholder`, `selection`).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ScopedOp {
    pub scope: Scope,
    pub ops: Vec<Op>,
}

/// A direct CSS property write that bypasses the registry — emitted
/// by `.set(key, value)` and (in a follow-up commit) by `cas.unsafe()`.
/// `property` is kebab-case; `value` is a fully formatted CSS string.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RawOp {
    pub property: String,
    pub value: String,
}

/// One scoping layer. Serialised as `{"kind":"pseudo","selector":...}`,
/// `{"kind":"media","query":...}`, or `{"kind":"raw","selector":...}` —
/// the TS-side `Scope` union shape.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Scope {
    Pseudo { selector: String },
    Media { query: String },
    Raw { selector: String },
}

/// Convert a `Vec<Op>` to its JSON-serialised form. Used by the JSX
/// rewrite to embed the IR as a comment annotation.
pub fn serialize_ops(ops: &[Op]) -> String {
    // Failure paths here would all be encoder bugs (Op fields are
    // all `Serialize` and non-fallible); the unwrap is safe.
    serde_json::to_string(ops).expect("Op[] serialisation must not fail")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// JSON shape parity with the TS Op union. The byte-level match
    /// matters because Babel-parsed and SWC-parsed pipelines must
    /// hash to identical class names — and the hash is derived from
    /// the canonical key, which in turn is derived from this IR.
    #[test]
    fn method_op_serialises_as_method_plus_args() {
        let op = Op::Method(MethodOp {
            method: "color".into(),
            args: vec![serde_json::Value::String("red".into())],
        });
        assert_eq!(
            serde_json::to_string(&op).unwrap(),
            r#"{"method":"color","args":["red"]}"#
        );
    }

    #[test]
    fn raw_op_serialises_as_property_plus_value() {
        let op = Op::Raw(RawOp {
            property: "background-color".into(),
            value: "red".into(),
        });
        assert_eq!(
            serde_json::to_string(&op).unwrap(),
            r#"{"property":"background-color","value":"red"}"#
        );
    }

    #[test]
    fn scoped_op_carries_a_kinded_scope_and_inner_ops() {
        let op = Op::Scoped(ScopedOp {
            scope: Scope::Pseudo {
                selector: ":hover".into(),
            },
            ops: vec![Op::Method(MethodOp {
                method: "color".into(),
                args: vec![serde_json::Value::String("red".into())],
            })],
        });
        assert_eq!(
            serde_json::to_string(&op).unwrap(),
            r#"{"scope":{"kind":"pseudo","selector":":hover"},"ops":[{"method":"color","args":["red"]}]}"#
        );
    }

    #[test]
    fn args_serialise_native_primitives() {
        let op = Op::Method(MethodOp {
            method: "marginTop".into(),
            args: vec![
                serde_json::Value::Number(serde_json::Number::from(8)),
                serde_json::Value::String("em".into()),
            ],
        });
        assert_eq!(
            serde_json::to_string(&op).unwrap(),
            r#"{"method":"marginTop","args":[8,"em"]}"#
        );
    }

    #[test]
    fn op_array_serialises_in_order() {
        let ops = vec![
            Op::Method(MethodOp {
                method: "color".into(),
                args: vec![serde_json::Value::String("red".into())],
            }),
            Op::Method(MethodOp {
                method: "padding".into(),
                args: vec![serde_json::Value::Number(serde_json::Number::from(8))],
            }),
        ];
        assert_eq!(
            serialize_ops(&ops),
            r#"[{"method":"color","args":["red"]},{"method":"padding","args":[8]}]"#
        );
    }
}
