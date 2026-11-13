# Building OriginLabs v0.0.1

The mobile app is two things in one package:

1. a vanilla HTML/CSS/JS surface with **no runtime dependencies**, loaded by an
   Android WebView from `file://`, and
2. the OriginLabs trust core written in **Rust**, compiled twice: natively for
   the CLI and tests, and to `wasm32-unknown-unknown` for the app.

There is no Gradle, no AndroidX, no Kotlin, no npm dependency and no network
access at runtime. Everything below is a short, inspectable pipeline.

## Layout

```
mobile/
  app/src/main/            Android shell (manifest, one Activity, one bridge)
    assets/www/            generated: the web surface copied into the APK
  rust/origin-core/        Rust crate (std only): JSON, SHA-256, events, verify
  web/                     PWA source; classic scripts so file:// works
  scripts/
    build-wasm.sh          cargo test + native CLI + rustc wasm32 + embed
    embed-wasm.mjs         base64-embeds the wasm and writes data/core.json
    gen-icons.mjs          renders the PNG icons from icon.svg
    build-web.mjs          registry snapshot + build metadata + hashed manifest
    gen-keys.sh            creates the PKCS#12 release keystore
    build-apk.sh           aapt2 → javac → D8 → zipalign → apksigner
    release.mjs            assembles release/ with checksums and SBOM
  site/                    GitHub Pages root; site/app/ is the deployed PWA
  test/                    node:test suites (core, policy, assets, APK)
  docs/                    this documentation
```

`mobile/toolchain/`, `mobile/build/`, `mobile/keys/`, `mobile/release/`,
`mobile/site/app/` and the generated `mobile/web/data/*.json`, `wasm.js` and
`origin_core.wasm` are build artifacts and are gitignored.

## Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 20+ (22.11 used) | no `npm install`; standard library only |
| Rust | stable, 1.100 used | `rustup target add wasm32-unknown-unknown` |
| JDK | 21 | `javac`, `keytool` |
| `aapt2` | Debian 2.19 | works with an API 34 platform jar |
| `zipalign`, `apksigner` | Debian build-tools 29.0.3 | `apksigner` is from Debian's package |
| `zip`, `unzip` | any | packaging and release checks |

The platform jar and D8 are not committed:

```sh
cd mobile
mkdir -p toolchain
curl -sSL -o toolchain/android-34.jar \
  https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar
curl -sSL -o toolchain/r8.jar \
  https://dl.google.com/dl/android/maven2/com/android/tools/r8/8.9.35/r8-8.9.35.jar
```

`r8.jar` provides D8. The Debian `aapt2` 2.19 cannot read the API 35 platform
jar (`RES_TABLE_TYPE_TYPE entry offsets overlap actual entry data`), which is
why the build pins **API 34**. Targeting SDK 34 is deliberate: the app uses no
API 35 behaviour.

## Build the trust core

```sh
cd mobile
./scripts/build-wasm.sh
```

This runs, in order:

```sh
cargo test  --manifest-path rust/origin-core/Cargo.toml        # native vectors
cargo build --release --manifest-path rust/origin-core/Cargo.toml
rustc --target wasm32-unknown-unknown --crate-type=cdylib \
  -O -C panic=abort -C lto=yes --edition 2021 \
  rust/origin-core/src/lib.rs -o build/origin_core.wasm
node scripts/embed-wasm.mjs
```

The wasm module is the trust boundary: canonical JSON, SHA-256, v1 event
construction and chain verification. The JavaScript never reimplements hashing,
so there is no second source of truth to drift.

Expected output (v0.0.1):

```
Embedded Rust core: 353668 bytes, sha256 84c7e7f1a57828d3a873edd5bced9722236d3a0dd4df7fcf38eed8ee5ba3b926
```

The digest is recorded in `web/data/core.json`, in `wasm.js` and in the shipped
`asset-manifest.json`. The tests compare all three, and compare the copy inside
the APK.

## Build the web surface

```sh
node scripts/gen-icons.mjs     # first time only, or after editing icon.svg
node scripts/build-web.mjs
```

`build-web.mjs` reads `registry/index.json`, verifies declared counts against
the individual records, embeds the registry as JSON and as a classic-script
global, records build metadata, copies `web/` into both
`app/src/main/assets/www` and `site/app`, and writes a SHA-256 manifest of every
file.

Set `SOURCE_DATE_EPOCH` to pin the `generatedAt` timestamp:

```sh
SOURCE_DATE_EPOCH=1763078400 node scripts/build-web.mjs
```

## Build and sign the APK

Create the release key once:

```sh
cd mobile
./scripts/gen-keys.sh
```

This writes `keys/originlabs.p12` and `keys/keystore.properties`. **Back the
keystore up offline.** Android refuses to install an update signed with a
different key, and there is no recovery short of a new package name.

Then:

```sh
./scripts/build-apk.sh
```

The script performs the whole pipeline:

```
aapt2 compile --dir app/src/main/res -o build/apk/res.zip
aapt2 link -I toolchain/android-34.jar --manifest ... -A app/src/main/assets ...
javac -source 8 -target 8 -classpath toolchain/android-34.jar ...
java -cp toolchain/r8.jar com.android.tools.r8.D8 --release --min-api 29 ...
zip classes.dex into the APK
zipalign -f -p 4
apksigner sign --ks keys/originlabs.p12 --v1 --v2 --v3
```

Output: `build/OriginLabs-0.0.1.apk`. The script prints the signature schemes,
the signer certificate SHA-256, the package metadata, and refuses to finish if
`aapt2 dump badging` reports **any** `uses-permission`.

v0.0.1 has `minSdkVersion 29`, `targetSdkVersion 34`, `versionCode 1`,
`versionName 0.0.1`, package `com.oneorigin.labs`, label `OriginLabs`.

## Run the tests

```sh
cd mobile
node --test test/*.test.mjs
```

| Suite | What it proves |
| --- | --- |
| `core.test.mjs` | Rust SHA-256 vectors, canonical JSON, event round-trip, tamper detection, reordering, demo and repository ledgers |
| `policy.test.mjs` | human/agent separation, two-key Transfer, evidence floors, data-class payload rules, demo derivation |
| `assets.test.mjs` | every built asset matches its manifest hash, the embedded core is the same wasm, no network client in app scripts, zero permissions in source and in the APK, APK signature verifies |

From the repository root, `npm test` runs the ledger and registry suites as
well. `npm run check` also verifies `.origin/events.jsonl` and that the registry
is not stale.

## Reproducibility

Given the same Rust toolchain, Node version, JDK, D8 version and
`SOURCE_DATE_EPOCH`, the wasm module and the JSON metadata are deterministic.
The APK is **not yet bit-for-bit reproducible**: ZIP entry timestamps and the
signing block differ between runs. Published checksums are therefore a
tamper check for the exact artifact you downloaded, not a claim that any
builder will produce the same bytes. The signing certificate fingerprint is the
stable identity to compare across releases.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `aapt2: RES_TABLE_TYPE_TYPE entry offsets overlap` | API 35 platform jar with aapt2 2.19 | use `toolchain/android-34.jar` |
| `Unable to find method metafactory` | compiling against the Android bootclasspath | do not pass `-bootclasspath`; pass the jar with `-classpath` |
| `rustc: target wasm32-unknown-unknown not found` | target not installed | `rustup target add wasm32-unknown-unknown` |
| `Refusing to ship: the APK declares a permission` | a dependency or manifest added a permission | remove it; zero permissions is a release rule |
| App shows stale files on a dev server | service worker cache | unregister the worker and clear cache, or use a fresh port |
| `Missing web/data/core.json` | web built before the core | run `scripts/build-wasm.sh` first |

## Continuous integration

`.github/workflows/ci.yml` installs the same Debian packages, downloads the
platform jar and D8, builds the core and web surface, generates a throwaway
keystore, builds an APK and runs the full test suite. It uploads the unsigned
pipeline artifacts for inspection. `.github/workflows/release.yml` does the same
on a `v*` tag with the real keystore from repository secrets and publishes the
release assets.
