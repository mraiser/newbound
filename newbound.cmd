@echo off
rem Windows counterpart of newbound.sh: build if needed and run from this folder.
cd /d "%~dp0"
cargo run --release --features=serde_support %*
