mod cmdinit;
pub mod testflow;
pub mod imgproc;
pub mod chuckme;
pub mod discord;
pub mod nebula;
pub mod raspberry;

use flowlang::rustcmd::*;
use ndata::NDataConfig;
use crate::cmdinit::cmdinit;

#[derive(Debug)]
pub struct Initializer {
  pub data_ref: (&'static str, NDataConfig),
  pub cmds: Vec<(String, Transform, String)>,
}

#[no_mangle]
pub fn mirror(state: &mut Initializer) {
  #[cfg(feature = "reload")]
  flowlang::mirror(state.data_ref);
  state.cmds.clear();
  cmdinit(&mut state.cmds);
}

