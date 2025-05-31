pub mod get_library_config;
pub mod save_library_config;

pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("wjhsqs19720f20d2ct8d".to_string(), save_library_config::execute, "".to_string()));
    cmds.push(("gxysqz19721b331c9r54".to_string(), get_library_config::execute, "".to_string()));
}
