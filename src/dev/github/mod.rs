pub mod list;
pub mod import;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    cmds.push(("lovuhn189dc981ebch2f".to_string(), list::execute, "".to_string()));
    cmds.push(("nnjgwh189dcdca95fq7c".to_string(), import::execute, "".to_string()));
}
