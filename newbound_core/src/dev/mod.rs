// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod plugins;
pub mod libsettings;
pub mod github;
pub mod editcontrol;
pub mod dev;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    dev::cmdinit(cmds);
    editcontrol::cmdinit(cmds);
    github::cmdinit(cmds);
    libsettings::cmdinit(cmds);
    plugins::cmdinit(cmds);
}
