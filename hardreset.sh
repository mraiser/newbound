DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
git clone https://github.com/mraiser/newbound.git CHUCKTHIS
cp -r CHUCKTHIS/src/* src/
cp -r CHUCKTHIS/data/* data/
cp -r CHUCKTHIS/cmd/src/* cmd/src/
cp CHUCKTHIS/cmd/Cargo.toml cmd/Cargo.toml
cp CHUCKTHIS/Cargo.toml Cargo.toml
rm -rf CHUCKTHIS
rustup update
cargo run --release --features="serde_support" rebuild

