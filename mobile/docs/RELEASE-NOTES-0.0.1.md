# OriginLabs v0.0.1

The first mobile release. A lab that can prove itself, offline, with no account
and no permission.

## What this is

OriginLabs is a local-first research ledger. You frame a question as a charter,
turn it into a falsifiable claim, attach graded evidence, record gate decisions,
and keep every step in an append-only hash chain. The chain is built and
verified by a **Rust core** compiled to WebAssembly, the same source that
compiles to the native `origin-core` CLI.

It is not a note-taking app with a "verified" badge. The verification is
recomputed on the device, and the app can show you the same ledger being
rejected after a single altered byte.

## Install

- **Android 10+ (APK):** download `OriginLabs-0.0.1.apk` and open it. You will
  need to allow installs from your browser or file manager. The app asks for no
  permissions.
- **Obtainium:** add
  `https://github.com/OriginLabs1/OriginLabs` (or open the Obtainium link in
  `DISTRIBUTION.md`). Updates arrive through GitHub Releases.
- **PWA:** open `https://originlabs1.github.io/OriginLabs/app/` and use
  "Install this PWA" or your browser's install action. Works offline after the
  first load.

Package `com.oneorigin.labs` · version `0.0.1` · `versionCode 1` ·
`minSdk 29` · `targetSdk 34` · **zero permissions**.

## Highlights

- **Rust trust boundary.** Canonical JSON, SHA-256, event construction and chain
  verification exist only in `origin-core`. The wasm module is instantiated with
  no imports; the JavaScript cannot hash on its own and refuses to run without
  the core.
- **Append-only ledger.** Corrections are new events. The UI never edits
  history. Imports are verified by the Rust core before they are accepted.
- **Adversarial check in the app.** *Tamper test* alters one byte in a copy and
  shows the original verifying and the copy failing at the first mismatch.
- **Evidence, not vibes.** Claim transitions have floors: E1 to investigate, E2
  to support, E3 to establish (E4 for high-risk charters), with confidence and
  falsifiers recorded.
- **Two-key gates.** Agents can never sign a gate, and a Transfer requires two
  distinct human signers. The gate demo shows both refusals and the accepted
  case.
- **49-capability registry.** 13 skills, 20 tools, 8 workflows and 8 models
  embedded from the repository snapshot, all FOSS-only, zero-cost and
  local-first.
- **Zero network.** No `INTERNET` permission, no `fetch` in app scripts,
  `setBlockNetworkLoads(true)` in the WebView. Diagnostics are computed locally.
- **No Gradle, no AndroidX, no npm dependencies.** The APK is built with
  `aapt2`, `javac`, D8, `zipalign` and `apksigner`; the web surface is plain
  HTML/CSS/JS.

## Verify your download

```sh
sha256sum -c SHA256SUMS
apksigner verify --verbose --print-certs OriginLabs-0.0.1.apk
```

Compare the certificate SHA-256 with `signing-certificate.txt` and the release
manifest. See `mobile/docs/SECURITY.md` for the full threat model, including
what the hash chain does and does not prove.

Known build digests:

| Artifact | SHA-256 |
| --- | --- |
| Rust core (wasm32) | `84c7e7f1a57828d3a873edd5bced9722236d3a0dd4df7fcf38eed8ee5ba3b926` |
| Demo ledger head | `9d81771fec4481ff8a5d0466cd80ab6012e1041ecdfedc0067b8b4aee9e271e9` |

The APK digest is published in `SHA256SUMS`, `release-manifest.json` and
`OriginLabs-0.0.1.apk.sha256`, because it changes with every build.

## Known limitations

- The ledger is tamper-evident, not signed. Principal labels are self-asserted;
  there is no device key or public attestation yet.
- Single device. Two people editing the same workspace produce divergent chains.
- The workspace and exports are unencrypted. The app stores data in the
  Android app sandbox with backup disabled.
- The demo workspace is synthetic and is not evidence of anything.
- APKs are not yet bit-for-bit reproducible; verify signer and checksums.
- F-Droid metadata is a draft and no listing exists.

## Thanks

Built on the doctrine in `CONTEXT.md` and `SPECS.md`: free and open source,
zero cost, local first, no telemetry, no accounts, no paid APIs. MIT licensed.

Source, registry and ledger: `https://github.com/OriginLabs1/OriginLabs`
