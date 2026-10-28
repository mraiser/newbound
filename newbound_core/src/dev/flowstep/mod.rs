// This file is auto-generated and managed by the flowlang build script.
use flowlang::rustcmd::Transform;
pub mod debug_start;
pub mod debug_state;
pub mod debug_step;
pub mod debug_set_breakpoints;
pub mod debug_stop;
pub mod debug_reap;
pub mod drive;
pub mod parity;
pub mod validate;
pub mod run;
pub mod step;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("kwjhgp1a16a026788s1c8".to_string(), step::execute, "".to_string()));
    cmds.push(("qktspz1a16a0b52e9u214".to_string(), run::execute, "".to_string()));
    cmds.push(("phmyms1a16a0b6cbfw216".to_string(), validate::execute, "".to_string()));
    cmds.push(("uzuhpw1a16a0b877fz218".to_string(), parity::execute, "".to_string()));
    cmds.push(("iijpnu1a16a2cc451mc1".to_string(), drive::execute, "".to_string()));
    cmds.push(("xuyiro1a16a466259h99".to_string(), debug_reap::execute, "".to_string()));
    cmds.push(("lojxro1a16a467d30i9b".to_string(), debug_stop::execute, "".to_string()));
    cmds.push(("lyxgmp1a16a4698d4x9d".to_string(), debug_set_breakpoints::execute, "".to_string()));
    cmds.push(("wojtzq1a16a46b4bcy9f".to_string(), debug_step::execute, "".to_string()));
    cmds.push(("tgoxzr1a16a46d1d9ja2".to_string(), debug_state::execute, "".to_string()));
    cmds.push(("nmmhrq1a16a46ef33ra4".to_string(), debug_start::execute, "".to_string()));
}
