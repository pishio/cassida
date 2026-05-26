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
    let mut visitor = CassidaVisitor::new(metadata.comments);
    program.visit_mut_with(&mut visitor);
    program
}
