DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
git clone https://github.com/mraiser/newbound.git CHUCKTHIS
cp -r CHUCKTHIS/src/* src/
cp -r CHUCKTHIS/data/* data/
mkdir -p newbound_core
cp -r CHUCKTHIS/newbound_core/* newbound_core/
cp CHUCKTHIS/Cargo.toml Cargo.toml
rm -f src/lib.rs
rustup update
cd CHUCKTHIS
cargo build --release --features="serde_support"
cd ../
CHUCKTHIS/target/release/newbound rebuild
rm -rf CHUCKTHIS
cargo run --release --features="serde_support"
