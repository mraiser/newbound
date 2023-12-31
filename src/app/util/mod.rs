pub mod zip;
pub mod init;
pub mod hash;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("guuqrj1836147b650zd".to_string(), zip::execute, "".to_string()));
    cmds.push(("thtpku18366290644p4".to_string(), init::execute, "".to_string()));
    cmds.push(("kgkxpw183664f5554q4".to_string(), hash::execute, "".to_string()));
}
