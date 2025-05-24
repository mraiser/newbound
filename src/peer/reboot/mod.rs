pub mod init;
pub mod reboot;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("jmhvzv1843439faa0i305".to_string(), reboot::execute, "".to_string()));
    cmds.push(("hygrki1842eac55a9w2a".to_string(), init::execute, "".to_string()));
}
