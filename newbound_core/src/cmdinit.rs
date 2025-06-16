// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
use crate::flow;
use crate::app;
use crate::security;
use crate::dev;
use crate::peer;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    flow::cmdinit(cmds);
    app::cmdinit(cmds);
    security::cmdinit(cmds);
    dev::cmdinit(cmds);
    peer::cmdinit(cmds);
}
