mod cmdinit;

use flowlang::rustcmd::*;
use ndata::NDataConfig;
use crate::cmdinit::cmdinit;

mod api;
pub static API : crate::api::api = crate::api::new();

#[derive(Debug)]
pub struct Initializer {
  pub data_ref: (&'static str, NDataConfig),
  pub cmds: Vec<(String, Transform, String)>,
}

#[no_mangle]
pub fn mirror(state: &mut Initializer) {
  #[cfg(feature = "reload")]
  flowlang::mirror(state.data_ref);
  cmdinit(&mut state.cmds);
  #[cfg(feature = "reload")]
  for q in &state.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
}

