// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod util;
pub mod service;
pub mod app;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    app::cmdinit(cmds);
    service::cmdinit(cmds);
    util::cmdinit(cmds);
}
