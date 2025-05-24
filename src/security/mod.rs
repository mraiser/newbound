pub mod security;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    security::cmdinit(cmds);
}
