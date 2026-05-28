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
    // `metadata.comments` is `Option<PluginCommentsProxy>`. Next.js's
    // production SWC pipeline strips comments from internal files
    // (`node_modules/next/dist/**/*.js`), and the plugin runs on
    // every file in the graph — including those. Passing `None` is
    // legitimate in that path; we simply skip the transform for
    // those files (there are no `cas()` chains inside Next.js's
    // internal sources anyway, so there's nothing to lift).
    //
    // The earlier behaviour (panicking via `.expect()`) was meant
    // to surface "consumer disabled comments globally" — but it
    // can't distinguish that footgun from Next.js's normal
    // file-by-file stripping. The right place for the footgun
    // warning is `@cassida/next-plugin`'s `withCassida` wrapper,
    // which controls the SWC config at the consumer level.
    let Some(comments) = metadata.comments else {
        return program;
    };
    let mut visitor = CassidaVisitor::new(comments);
    program.visit_mut_with(&mut visitor);
    program
}
