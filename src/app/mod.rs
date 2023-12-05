pub mod app;
pub mod util;
pub mod service;

use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    util::cmdinit(cmds);
    service::cmdinit(cmds);
    app::cmdinit(cmds);
}
