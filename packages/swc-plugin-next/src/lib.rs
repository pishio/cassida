//! Cassida SWC plugin — Next.js-targeted build (swc_core 35.0.0).
//!
//! Identical transform to the sibling `cassida_swc_plugin` crate
//! (which sits on swc_core 66.x for Rspack / @swc/core /
//! plugin-react-swc consumers). The split exists because the SWC
//! plugin ABI is version-bound: Next.js 15.x ships `@next/swc` linked
//! against swc_core 35.0.0, so a plugin compiled against 66.x panics
//! with "failed to invoke plugin" on every file. We rebuild the same
//! source against 35.0.0 here.
//!
//! Six call sites in `visitor.rs` / `walker.rs` are adapted because
//! `Atom::as_str()` returned `&str` in swc_core 35.0.0 and widened to
//! `Option<&str>` in the 66.x line (Wtf8Atom — handles lone
//! surrogates). Each adapted site is tagged
//! `// Adapter site #N (see lib.rs `as_str` note).`.
//!
//! When Next.js bumps its embedded swc_core (canary is currently at
//! 65.x), bump the pin in this crate's `Cargo.toml` to match and
//! re-verify the six adapter sites — they may converge with the
//! modern crate.

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
