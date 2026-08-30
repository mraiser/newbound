// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod restart_instance;
pub mod update_crates_status;
pub mod update_crates;
pub mod crate_versions;
pub mod activate_lib;
pub mod rebuild_lib;
pub mod lib_info;
pub mod lib_archive;
pub mod install_lib;
pub mod compile_rust;
pub mod compile;
pub mod check;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("gsxkwg184e3fc96f9s2e1".to_string(), check::execute, "".to_string()));
    cmds.push(("gjssly1834862d5acg37d9".to_string(), compile::execute, "".to_string()));
    cmds.push(("mhxogz1858786d9e1scf".to_string(), compile_rust::execute, "".to_string()));
    cmds.push(("kqgjmx1840a9081cdh172".to_string(), install_lib::execute, "".to_string()));
    cmds.push(("uykmrm183dbd15cdeu7b".to_string(), lib_archive::execute, "".to_string()));
    cmds.push(("knwozu1840a764abcu135".to_string(), lib_info::execute, "".to_string()));
    cmds.push(("yypums1847731c7fap5".to_string(), rebuild_lib::execute, "".to_string()));
    cmds.push(("lrgoyo19fe9049accu1".to_string(), activate_lib::execute, "".to_string()));
    cmds.push(("wysojo1a052c43c59ha".to_string(), crate_versions::execute, "".to_string()));
    cmds.push(("mzhpqp1a052c4c270sc".to_string(), update_crates::execute, "".to_string()));
    cmds.push(("nxnqxj1a052c503b6ke".to_string(), update_crates_status::execute, "".to_string()));
    cmds.push(("zosxwm1a052c55690j10".to_string(), restart_instance::execute, "".to_string()));
}
