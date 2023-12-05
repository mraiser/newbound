pub mod dev;
pub mod editcontrol;
pub mod github;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    github::cmdinit(cmds);
    editcontrol::cmdinit(cmds);
    dev::cmdinit(cmds);
}
