pub mod service;
pub mod peer;
pub mod reboot;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    service::cmdinit(cmds);
    reboot::cmdinit(cmds);
    peer::cmdinit(cmds);
}
