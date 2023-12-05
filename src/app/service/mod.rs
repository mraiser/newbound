pub mod init;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("mjkrmm183e1fdb2d2r8".to_string(), init::execute, "".to_string()));
}
