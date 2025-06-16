// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::{Transform};
pub mod peer;
pub mod dev;
pub mod security;
pub mod app;
pub mod flow;

// Each flowlang library within this crate will be added as a module here.

mod cmdinit;
pub use cmdinit::cmdinit;
mod api;
pub static API : crate::api::api = crate::api::new();

#[derive(Debug, Clone)]
pub struct Initializer {
    pub cmds: Vec<(String, Transform, String)>,
}

#[no_mangle]
pub fn mirror(state: &mut Initializer) {
    // The reload feature is now handled by the main binary.
    cmdinit(&mut state.cmds);
}
