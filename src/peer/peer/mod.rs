pub mod peers;
pub mod info;
pub mod discovery;
pub mod local;
pub mod remote;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("txnvil183f6ffdf58w1d".to_string(), remote::execute, "".to_string()));
    cmds.push(("ywokvt1838c110d92l8".to_string(), peers::execute, "".to_string()));
    cmds.push(("nylhvq183f6b61e43oc2".to_string(), local::execute, "".to_string()));
    cmds.push(("tkwkml18390d46728m8".to_string(), info::execute, "".to_string()));
    cmds.push(("mlrhvx183e6eabd19xb4".to_string(), discovery::execute, "".to_string()));
}
