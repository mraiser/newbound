pub mod init;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("mjkrmm183e1fdb2d2r8".to_string(), init::execute, "".to_string()));
}
