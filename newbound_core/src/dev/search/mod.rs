// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod status;
pub mod query;
pub mod index;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("liktqq1a1d0627555v2".to_string(), index::execute, "".to_string()));
    cmds.push(("rmyhtz1a1d062caa1m4".to_string(), query::execute, "".to_string()));
    cmds.push(("xxnqrs1a1d063005aq6".to_string(), status::execute, "".to_string()));
}
