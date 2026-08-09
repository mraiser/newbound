// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod remove;
pub mod update;
pub mod list;
pub mod import;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("nnjgwh189dcdca95fq7c".to_string(), import::execute, "".to_string()));
    cmds.push(("lovuhn189dc981ebch2f".to_string(), list::execute, "".to_string()));
    cmds.push(("hioqsq19fe7789bcaj1".to_string(), update::execute, "".to_string()));
    cmds.push(("lumrkn19fe778ea1bu3".to_string(), remove::execute, "".to_string()));
}
