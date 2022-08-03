pub mod testflow;
use flowlang::rustcmd::*;
pub struct Generated {}
impl Generated {
  pub fn init() {
    RustCmd::init();
    RustCmd::add("omvgmg1807a950539s96b".to_string(), testflow::testflow::test_rust::execute, "".to_string());
  }
}
