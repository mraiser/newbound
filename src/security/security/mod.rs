pub mod init;
pub mod users;
pub mod groups;
pub mod setuser;
pub mod deleteuser;
pub mod current_user;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, Transform, String)>) {
    cmds.push(("ysnihn1836b0814aen5".to_string(), users::execute, "".to_string()));
    cmds.push(("soqxoo1836bb51d5dy2".to_string(), setuser::execute, "".to_string()));
    cmds.push(("suvlkp1846cfa2235q2c".to_string(), init::execute, "".to_string()));
    cmds.push(("qjmvtm1836b1bc850o9".to_string(), groups::execute, "".to_string()));
    cmds.push(("jszjgy1836bfe023ckc".to_string(), deleteuser::execute, "".to_string()));
    cmds.push(("ihxsxh18410251dfapf7".to_string(), current_user::execute, "".to_string()));
}
