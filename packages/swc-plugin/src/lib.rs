//! Cassida SWC plugin — Phase 1 scaffold.
//!
//! Current state: no-op transform that returns the program unchanged.
//! Subsequent commits will fill in the chain walker, JSX rewrite, and
//! Op[] IR serialisation. See `.claude/plans/swc-port-phase-1.md` for
//! the full design.

use swc_core::{
    ecma::ast::Program,
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program
}
