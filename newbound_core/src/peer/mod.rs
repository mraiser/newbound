// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod service;
pub mod reboot;
pub mod peer;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    peer::cmdinit(cmds);
    reboot::cmdinit(cmds);
    service::cmdinit(cmds);
}
