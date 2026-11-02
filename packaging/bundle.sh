#!/usr/bin/env bash
# Builds a self-contained Newbound bundle with Python embedded: the newbound
# binary (built with python_runtime), a relocatable CPython next to it in
# python/ (python-build-standalone, pinned below), and the core store. No
# Rust toolchain or system Python is needed to run it.
#
#   packaging/bundle.sh <target> [outdir]
#   target: x86_64-unknown-linux-gnu | aarch64-unknown-linux-gnu | aarch64-apple-darwin
#
# Produces <outdir>/newbound-<target>/ and <outdir>/newbound-<target>.tar.gz
# (outdir defaults to dist/). Runs in the root of a newbound checkout and
# needs a Rust toolchain, curl and tar.
set -euo pipefail

TARGET="${1:?usage: packaging/bundle.sh <target> [outdir]}"
OUT="${2:-dist}"

# python-build-standalone release 20260718, CPython 3.13.14
# (install_only_stripped); sha256 from the release's SHA256SUMS.
PBS_TAG="20260718"
PY_VERSION="3.13.14"
case "$TARGET" in
  x86_64-unknown-linux-gnu)  PBS_SHA256="571a710c62520b26dbadbd16e8850e24565c01dea94440223bc16caa21614021" ;;
  aarch64-unknown-linux-gnu) PBS_SHA256="8d5ac68458a4df9bc3c349d607da2674d8390ad26162482b17215563e45aca83" ;;
  aarch64-apple-darwin)      PBS_SHA256="06469835e1b0f73bcdb6c498a1d60ce579cc43a980754490a6f1e30062f43850" ;;
  *) echo "unsupported target: $TARGET" >&2; exit 2 ;;
esac
PBS_FILE="cpython-${PY_VERSION}+${PBS_TAG}-${TARGET}-install_only_stripped.tar.gz"
PBS_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/cpython-${PY_VERSION}%2B${PBS_TAG}-${TARGET}-install_only_stripped.tar.gz"

NAME="newbound-${TARGET}"
DEST="${OUT}/${NAME}"
rm -rf "$DEST"
mkdir -p "$DEST" "${OUT}/cache"

# 1. The Python: download once, verify, extract to <bundle>/python.
if [ ! -f "${OUT}/cache/${PBS_FILE}" ]; then
  curl -sSfL -o "${OUT}/cache/${PBS_FILE}.part" "$PBS_URL"
  mv "${OUT}/cache/${PBS_FILE}.part" "${OUT}/cache/${PBS_FILE}"
fi
if command -v sha256sum >/dev/null; then SUM="sha256sum"; else SUM="shasum -a 256"; fi
echo "${PBS_SHA256}  ${OUT}/cache/${PBS_FILE}" | $SUM -c -
tar -xzf "${OUT}/cache/${PBS_FILE}" -C "$DEST"     # -> $DEST/python
PYTHON="$(cd "$DEST/python/bin" && pwd)/python3"

# 2. newbound, linked against that Python and finding it next to itself.
case "$TARGET" in
  *-apple-darwin) RPATH='@executable_path/python/lib' ;;
  *)              RPATH='$ORIGIN/python/lib' ;;
esac
# Its own target dir: these flags must not replace a development build.
BUILD_DIR="target/bundle-${TARGET}"
PYO3_PYTHON="$PYTHON" RUSTFLAGS="-C link-args=-Wl,-rpath,${RPATH}" CARGO_TARGET_DIR="$BUILD_DIR" \
  cargo build --release --features=serde_support,python_runtime
cp "$BUILD_DIR/release/newbound" "$DEST/"
if [[ "$TARGET" == *-apple-darwin ]]; then
  # Make sure the binary references libpython through its rpath.
  LIB=$(otool -L "$DEST/newbound" | awk '/libpython/ {print $1}')
  case "$LIB" in
    @rpath/*) ;;
    *) install_name_tool -change "$LIB" "@rpath/$(basename "$LIB")" "$DEST/newbound" ;;
  esac
fi

# 3. The core store and what the server serves; a starting configuration.
cp -R data html runtime "$DEST/"
cp config.properties_example "$DEST/config.properties"
cp license.md README.md "$DEST/"
cp packaging/BUNDLE.md "$DEST/"

# 4. Smoke test: the binary starts its embedded Python from the bundle (no
#    PYTHONHOME, no library path). The bundle's site-packages is empty and
#    the user's is excluded, so `newbound pytest` must report that pytest is
#    missing - naming the bundled Python's version.
SMOKE=$(cd "$DEST" && env -u PYTHONHOME -u LD_LIBRARY_PATH -u DYLD_LIBRARY_PATH PYTHONNOUSERSITE=1 ./newbound pytest 2>&1 || true)
echo "$SMOKE" | grep -q "embedded Python ${PY_VERSION}" || {
  echo "smoke test failed: the bundled binary did not start its embedded Python ${PY_VERSION}:" >&2
  echo "$SMOKE" >&2
  exit 1
}
echo "smoke test: embedded Python ${PY_VERSION} starts from the bundle"

tar -czf "${OUT}/${NAME}.tar.gz" -C "$OUT" "$NAME"
echo "${OUT}/${NAME}.tar.gz"
