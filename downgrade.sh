#!/bin/sh
# Pin transitive dependencies down to versions an old Rust toolchain can
# build. Optional: run it only on machines whose rustc/cargo predate 1.85;
# modern toolchains should build straight from the committed Cargo.lock.
#
# Two distinct problems, one script:
#   - Cargo < 1.85 cannot parse manifests published with edition = "2024"
#     (idna_adapter >= 1.2.1 and the ICU4X 2.x stack it drags in).
#   - Crates that declare rust-version above the active rustc are refused
#     at build time (native-tls >= 0.2.14, openssl >= 0.10.79,
#     openssl-sys >= 0.9.115 need 1.80; litemap 0.7.5 needs 1.81).
#
# The pins below are the newest versions buildable on rustc 1.73 (tested).
# Crates absent from a checkout's dependency graph are skipped, so this is
# safe to run whether or not the instance's command crates pull in TLS.
# Re-run after anything regenerates Cargo.lock.

cd "$(dirname "$0")" || exit 1

# A lockfile written by a newer cargo may use a format this cargo cannot
# read at all (e.g. v4 needs cargo >= 1.78). Regenerate it if so.
if [ -f Cargo.lock ] && ! cargo update --dry-run >/dev/null 2>&1; then
  echo "Cargo.lock is unreadable by this cargo; regenerating it."
  rm Cargo.lock
fi

pin() {
  echo "pinning $1 -> $2"
  cargo update -p "$1" --precise "$2" 2>/dev/null \
    || echo "  ($1 not in the dependency graph, or the pin no longer applies; skipped)"
}

# Order matters: the idna_adapter pin swaps ICU4X 2.x for 1.5, which is
# what puts litemap 0.7.x in the graph for the pin after it.
pin idna_adapter 1.2.0
pin litemap 0.7.4
pin native-tls 0.2.13
pin openssl 0.10.78
pin openssl-sys 0.9.114

echo "Done. Build normally, e.g.: cargo build --release --features=serde_support"
