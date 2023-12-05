use crate::peer;
use crate::security;
use crate::dev;
use crate::app;
use flowlang::rustcmd::Transform;

pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    security::cmdinit(cmds);
    peer::cmdinit(cmds);
    dev::cmdinit(cmds);
    app::cmdinit(cmds);
}

