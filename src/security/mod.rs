pub mod security;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    security::cmdinit(cmds);
}
