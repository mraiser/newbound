git clone https://github.com/mraiser/newbound.git
cd newbound
mkdir repositories
cd repositories
git clone https://github.com/mraiser/newbound-agent.git
cd ../
ln -s repositories/newbound-agent/agent agent
cd data
ln -s ../repositories/newbound-agent/data/agent agent
cd ../
cargo run --release --features=serde_support,python_runtime rebuild
cargo run --release --features=serde_support,python_runtime recompile
