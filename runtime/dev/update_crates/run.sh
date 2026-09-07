#!/bin/sh
cd '/newbound'
D=runtime/dev/update_crates
LOG="$D/run.log"
BIN='target/release/newbound'
st() { printf '{"state":"%s","step":%s,"label":"%s","verdict":"%s","pid":%s,"time":%s}' "$1" "$2" "$3" "$4" $$ "$(date +%s)" > "$D/status.json.tmp"; mv "$D/status.json.tmp" "$D/status.json"; }
h() { if [ -f "$BIN" ]; then sha256sum "$BIN" | cut -d' ' -f1; else echo none; fi; }
H0=$(h)
st running 1 'host build with new crates' ''
echo "== STEP 1: cargo build --release --features=serde_support,python_runtime" >> "$LOG"
cargo build --release --features=serde_support,python_runtime >> "$LOG" 2>&1 || { st failed 1 'host build failed' ''; exit 1; }
st running 2 'newbound rebuild' ''
echo "== STEP 2: $BIN rebuild" >> "$LOG"
"$BIN" rebuild >> "$LOG" 2>&1 || { st failed 2 'rebuild failed' ''; exit 1; }
st running 3 'newbound recompile' ''
echo "== STEP 3: $BIN recompile" >> "$LOG"
"$BIN" recompile >> "$LOG" 2>&1 || { st failed 3 'recompile failed' ''; exit 1; }
st running 4 'final host build' ''
echo "== STEP 4: cargo build --release --features=serde_support,python_runtime" >> "$LOG"
cargo build --release --features=serde_support,python_runtime >> "$LOG" 2>&1 || { st failed 4 'final host build failed' ''; exit 1; }
H1=$(h)
if [ "$H0" = "$H1" ]; then V=no-restart; else V=restart; fi
st done 4 'complete' "$V"
echo "== DONE: verdict=$V" >> "$LOG"
