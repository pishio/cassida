//! Cassida SWC plugin — Phase 1.
//!
//! The current commit ships the IR + modifier table + chain walker
//! and rewrites JSX spreads to an IR-comment placeholder. The actual
//! className substitution + CSS bundling happens in a Node post-pass
//! inside `@cassida/next-plugin`; this crate only mints the IR.

use swc_core::{
    ecma::ast::Program,
    ecma::visit::VisitMutWith,
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

mod ir;
mod modifiers;
mod visitor;
mod walker;

use visitor::CassidaVisitor;

#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    metadata: TransformPluginProgramMetadata,
) -> Program {
    // `metadata.comments` is `Option<PluginCommentsProxy>`; the host
    // passes `None` when comments are disabled in its SWC config. We
    // can't proceed in that case — the IR is delivered to the JS
    // post-pass via comment annotations, and silently dropping them
    // would leave `__CAS_PLACEHOLDER_N__` strings in production
    // output uncompiled (with no warning, no error, just broken
    // styles). Hard-fail at plugin init so the misconfiguration is
    // visible at build time.
    let comments = metadata.comments.expect(
        "Cassida SWC plugin requires comments to be enabled. Set `experimental.swcPlugins` \
         in next.config.js (which @cassida/next-plugin does automatically) — do not pass \
         `comments: false` to the SWC config.",
    );
    let mut visitor = CassidaVisitor::new(comments);
    program.visit_mut_with(&mut visitor);
    program
}
