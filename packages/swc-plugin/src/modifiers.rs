//! Canonical modifier table — port of `packages/compiler/src/modifier-spec.ts`.
//! Static slices live in `.rodata`; lookups are linear-scan over ~20
//! entries (faster than a HashMap for this size — branch-predictable
//! and cache-resident).

use crate::ir::Scope;

/// Zero-arg pseudo / pseudo-element / media modifiers. The chain
/// `.hover(c => ...)` resolves the method name to one of these scopes
/// and recurses into the callback body.
pub struct CanonicalModifier {
    pub name: &'static str,
    pub kind: ModKind,
    pub value: &'static str,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ModKind {
    Pseudo,
    Media,
}

pub const CANONICAL_MODIFIERS: &[CanonicalModifier] = &[
    // user-interaction states
    CanonicalModifier {
        name: "hover",
        kind: ModKind::Pseudo,
        value: ":hover",
    },
    CanonicalModifier {
        name: "focus",
        kind: ModKind::Pseudo,
        value: ":focus",
    },
    CanonicalModifier {
        name: "focusVisible",
        kind: ModKind::Pseudo,
        value: ":focus-visible",
    },
    CanonicalModifier {
        name: "focusWithin",
        kind: ModKind::Pseudo,
        value: ":focus-within",
    },
    CanonicalModifier {
        name: "active",
        kind: ModKind::Pseudo,
        value: ":active",
    },
    // form states
    CanonicalModifier {
        name: "disabled",
        kind: ModKind::Pseudo,
        value: ":disabled",
    },
    CanonicalModifier {
        name: "checked",
        kind: ModKind::Pseudo,
        value: ":checked",
    },
    CanonicalModifier {
        name: "required",
        kind: ModKind::Pseudo,
        value: ":required",
    },
    CanonicalModifier {
        name: "invalid",
        kind: ModKind::Pseudo,
        value: ":invalid",
    },
    // structural
    CanonicalModifier {
        name: "firstChild",
        kind: ModKind::Pseudo,
        value: ":first-child",
    },
    CanonicalModifier {
        name: "lastChild",
        kind: ModKind::Pseudo,
        value: ":last-child",
    },
    CanonicalModifier {
        name: "empty",
        kind: ModKind::Pseudo,
        value: ":empty",
    },
    // pseudo-elements
    CanonicalModifier {
        name: "before",
        kind: ModKind::Pseudo,
        value: "::before",
    },
    CanonicalModifier {
        name: "after",
        kind: ModKind::Pseudo,
        value: "::after",
    },
    CanonicalModifier {
        name: "placeholder",
        kind: ModKind::Pseudo,
        value: "::placeholder",
    },
    CanonicalModifier {
        name: "selection",
        kind: ModKind::Pseudo,
        value: "::selection",
    },
    // common media presets
    CanonicalModifier {
        name: "darkMode",
        kind: ModKind::Media,
        value: "(prefers-color-scheme: dark)",
    },
    CanonicalModifier {
        name: "reduceMotion",
        kind: ModKind::Media,
        value: "(prefers-reduced-motion: reduce)",
    },
    CanonicalModifier {
        name: "print",
        kind: ModKind::Media,
        value: "print",
    },
];

/// Returns the scope of a canonical zero-arg modifier method, or
/// `None` if the name isn't in the table. Linear scan — ~20 entries.
pub fn canonical_scope(name: &str) -> Option<Scope> {
    CANONICAL_MODIFIERS
        .iter()
        .find(|m| m.name == name)
        .map(|m| match m.kind {
            ModKind::Pseudo => Scope::Pseudo {
                selector: m.value.to_string(),
            },
            ModKind::Media => Scope::Media {
                query: m.value.to_string(),
            },
        })
}

/// Arg-modifier kinds: `.media(query, c => ...)` and `.on(selector, c => ...)`.
/// Each takes a string literal first and a callback second.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ArgModifier {
    Media,
    On,
}

pub fn arg_modifier(name: &str) -> Option<ArgModifier> {
    match name {
        "media" => Some(ArgModifier::Media),
        "on" => Some(ArgModifier::On),
        _ => None,
    }
}

/// Build the scope for an arg-modifier given the literal arg value.
/// Mirrors `inferScope` in `packages/parser/src/index.ts` — `.media`
/// accepts either `(min-width: 640px)` or `@media (min-width: 640px)`
/// (the latter has the `@media` prefix stripped); `.on` is verbatim.
pub fn arg_modifier_scope(modifier: ArgModifier, arg: &str) -> Scope {
    match modifier {
        ArgModifier::Media => {
            let trimmed = arg.trim();
            // Strip a leading `@media` (case-insensitive) so users can
            // pass either form interchangeably.
            let query = trimmed
                .strip_prefix("@media")
                .or_else(|| trimmed.strip_prefix("@MEDIA"))
                .map(|rest| rest.trim_start().to_string())
                .unwrap_or_else(|| trimmed.to_string());
            Scope::Media { query }
        }
        ArgModifier::On => {
            let trimmed = arg.trim();
            // `.on(':hover', ...)` shorthand routes to a pseudo scope;
            // arbitrary selectors stay raw. Mirror the TS parser's
            // disambiguation by leading `:` / `::`.
            if trimmed.starts_with(':') {
                Scope::Pseudo {
                    selector: trimmed.to_string(),
                }
            } else {
                Scope::Raw {
                    selector: trimmed.to_string(),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_pseudo_modifiers_resolve() {
        assert_eq!(
            canonical_scope("hover"),
            Some(Scope::Pseudo {
                selector: ":hover".into()
            })
        );
        assert_eq!(
            canonical_scope("before"),
            Some(Scope::Pseudo {
                selector: "::before".into()
            })
        );
        assert_eq!(
            canonical_scope("focusVisible"),
            Some(Scope::Pseudo {
                selector: ":focus-visible".into()
            })
        );
    }

    #[test]
    fn canonical_media_modifiers_resolve() {
        assert_eq!(
            canonical_scope("darkMode"),
            Some(Scope::Media {
                query: "(prefers-color-scheme: dark)".into()
            })
        );
        assert_eq!(
            canonical_scope("print"),
            Some(Scope::Media {
                query: "print".into()
            })
        );
    }

    #[test]
    fn unknown_modifier_returns_none() {
        assert!(canonical_scope("notReal").is_none());
        assert!(canonical_scope("media").is_none()); // arg-modifier, not canonical
    }

    #[test]
    fn media_strips_at_media_prefix() {
        assert_eq!(
            arg_modifier_scope(ArgModifier::Media, "@media (min-width: 640px)"),
            Scope::Media {
                query: "(min-width: 640px)".into()
            }
        );
        assert_eq!(
            arg_modifier_scope(ArgModifier::Media, "  (min-width: 640px)  "),
            Scope::Media {
                query: "(min-width: 640px)".into()
            }
        );
    }

    #[test]
    fn on_disambiguates_pseudo_vs_raw_by_leading_colon() {
        assert_eq!(
            arg_modifier_scope(ArgModifier::On, ":hover"),
            Scope::Pseudo {
                selector: ":hover".into()
            }
        );
        assert_eq!(
            arg_modifier_scope(ArgModifier::On, "[data-loading=true]"),
            Scope::Raw {
                selector: "[data-loading=true]".into()
            }
        );
    }
}
