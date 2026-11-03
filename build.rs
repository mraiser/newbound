// Records the Python the host's PyO3 was built against, so the host can
// build library dylibs against the same one (see pin_library_python in
// src/main.rs).
fn main() {
  println!("cargo:rerun-if-changed=build.rs");
  #[cfg(feature = "python_runtime")]
  if let Some(python) = pyo3_build_config::get().executable() {
    println!("cargo:rustc-env=NEWBOUND_PYO3_PYTHON={}", python);
  }
}
