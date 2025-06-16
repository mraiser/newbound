use std::env;
use std::path::PathBuf;

fn main() {
    // Get the root directory of the crate being compiled (e.g., /path/to/newbound).
    // This is reliably set by Cargo.
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());

    // Get the current build profile ("debug" or "release").
    // This correctly handles your debug vs. release concern.
    let profile = env::var("PROFILE").unwrap();

    // Construct the full, safe path to the 'deps' directory where the .so files live.
    // This will resolve to, for example, `/path/to/newbound/target/release/deps`.
    // It only looks down from the project root, never up or sideways.
    let deps_path = manifest_dir.join("target").join(profile).join("deps");

    // Tell the linker to add this specific directory to its search path.
    if deps_path.exists() {
        println!("cargo:rustc-link-search=native={}", deps_path.display());
    }
}
