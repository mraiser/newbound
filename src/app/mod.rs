pub mod app;
pub mod util;
pub mod service;

pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    util::cmdinit(cmds);
    service::cmdinit(cmds);
    app::cmdinit(cmds);
}
