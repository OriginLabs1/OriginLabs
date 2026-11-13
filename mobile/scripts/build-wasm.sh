#!/bin/sh
# Build the portable OriginLabs core twice:
#   1. native, for the CLI and Rust tests;
#   2. wasm32-unknown-unknown, for the Android/PWA trust boundary.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if ! command -v rustc >/dev/null 2>&1; then
  if [ -x "$HOME/.cargo/bin/rustc" ]; then
    PATH="$HOME/.cargo/bin:$PATH"
    export PATH
  else
    echo "rustc not found. Install Rust from https://rustup.rs (stable, wasm32-unknown-unknown)." >&2
    exit 1
  fi
fi

if ! rustc --print target-list | grep -qx wasm32-unknown-unknown; then
  echo "Rust is present but the wasm32-unknown-unknown target is missing." >&2
  echo "Run: rustup target add wasm32-unknown-unknown" >&2
  exit 1
fi

mkdir -p build

echo "==> cargo test (native)"
cargo test --quiet --manifest-path rust/origin-core/Cargo.toml

echo "==> cargo build (native CLI)"
cargo build --quiet --release --manifest-path rust/origin-core/Cargo.toml
cp rust/origin-core/target/release/origin-core build/origin-core

echo "==> rustc (wasm32)"
rustc \
  --target wasm32-unknown-unknown \
  --crate-type=cdylib \
  -O \
  -C panic=abort \
  -C lto=yes \
  --edition 2021 \
  rust/origin-core/src/lib.rs \
  -o build/origin_core.wasm

node scripts/embed-wasm.mjs
echo "Rust core ready: build/origin_core.wasm, build/origin-core"
