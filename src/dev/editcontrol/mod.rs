pub mod appdata;
pub mod publishapp;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("iwvgmq1835bb194ffo8".to_string(), publishapp::execute, "".to_string()));
    cmds.push(("vsxqui18332a86185i159".to_string(), appdata::execute, "".to_string()));
}
