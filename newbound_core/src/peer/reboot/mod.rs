// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod reboot;
pub mod init;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("hygrki1842eac55a9w2a".to_string(), init::execute, "".to_string()));
    cmds.push(("jmhvzv1843439faa0i305".to_string(), reboot::execute, "".to_string()));
}
