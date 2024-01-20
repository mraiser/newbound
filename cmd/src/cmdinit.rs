use crate::testflow;
use crate::imgproc;
use crate::chuckme;
use crate::discord;
use crate::nebula;
use crate::raspberry;
use flowlang::rustcmd::*;
pub fn cmdinit(cmds: &mut Vec<(String, flowlang::rustcmd::Transform, String)>) {
    testflow::cmdinit(cmds);
    imgproc::cmdinit(cmds);
    chuckme::cmdinit(cmds);
    discord::cmdinit(cmds);
    nebula::cmdinit(cmds);
    raspberry::cmdinit(cmds);
}
