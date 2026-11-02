# Newbound bundle

A self-contained Newbound with Python embedded: no Rust toolchain or system
Python needed.

- `newbound` - the server, built with the embedded Python runtime.
- `python/` - its CPython (python-build-standalone 3.13). The server finds it
  next to itself; leave the two side by side.
- `data/`, `html/`, `runtime/` - the core libraries and web UI.
- `config.properties` - settings (`http_port`, `http_address`, ...).

Run it from this directory:

    ./newbound

and open `http://localhost:8080` (the port is `http_port` in
`config.properties`).

Python packages for your commands go in a virtual environment next to
`data/`, made with the bundled Python - the server uses it automatically:

    ./python/bin/python3 -m venv venv
    ./venv/bin/pip install <packages>

Writing Rust commands needs the Rust toolchain and a source checkout; Python
and flow commands work as is. See the dev library's
`docs/python-commands.md` for Python commands.
