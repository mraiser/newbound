// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod zip;
pub mod init;
pub mod hash;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("kgkxpw183664f5554q4".to_string(), hash::execute, "".to_string()));
    cmds.push(("thtpku18366290644p4".to_string(), init::execute, "".to_string()));
    cmds.push(("guuqrj1836147b650zd".to_string(), zip::execute, "".to_string()));
}
