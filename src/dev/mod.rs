pub mod dev;
pub mod editcontrol;
pub mod github;
pub mod libsettings;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    libsettings::cmdinit(cmds);
    github::cmdinit(cmds);
    editcontrol::cmdinit(cmds);
    dev::cmdinit(cmds);
}
