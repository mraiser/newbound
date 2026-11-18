// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod test_path_traversal;
pub mod init;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("mjkrmm183e1fdb2d2r8".to_string(), init::execute, "".to_string()));
    cmds.push(("ixvtqm1a1ee719698y4".to_string(), test_path_traversal::execute, "".to_string()));
}
