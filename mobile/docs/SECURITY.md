# Security model

OriginLabs is a local, offline tool. This document states what it protects, what
it does **not** protect, and where the trust boundary sits. It is deliberately
specific so a reviewer can check the claims against the code.

## Trust boundary

The only implementation of canonical JSON, SHA-256, v1 event construction and
chain verification is the Rust core:

- `mobile/rust/origin-core/src/lib.rs` — the source, `std` only, no crates;
- `mobile/build/origin_core.wasm` — compiled with `rustc` for
  `wasm32-unknown-unknown`, embedded as base64 in `wasm.js`;
- `mobile/build/origin-core` — the same source compiled natively for the CLI and
  the test suite.

The wasm module is instantiated with **no imports** (`WebAssembly.instantiate(bytes, {})`),
so it has no syscall, clock, random or network interface. It receives bytes,
returns bytes. The JavaScript calls hashing and verification; it never
reimplements them.

The app refuses to operate if the core is absent. There is no JavaScript
fallback for hashing: a second implementation would be a second trust boundary
and a source of silent disagreement.

## What `verify` proves

`origin_verify(jsonl)` checks:

1. every line is valid JSON with the v1 envelope shape;
2. sequence numbers are contiguous and start at 1;
3. each event's `prev` equals the previous event's `hash`;
4. each `hash` recomputes from the canonical body;
5. the genesis event uses the all-zero previous hash.

`ok: true` means **the chain is internally consistent**. It does **not** mean:

- that a particular person wrote an event;
- that an event was created at the claimed time;
- that the ledger is the only version in existence.

v0.0.1 has no per-device keypair and no asymmetric signatures. `actor` and gate
`signers` are labels, not proof of identity. Anyone who can write the workspace
JSON can also build a different chain that verifies just as well. Verification
is meaningful relative to a **head hash you already trust** — which is why the
app shows the head prominently and lets you copy it out of band.

This is an honest limitation, not an oversight. Treat the ledger as a
tamper-evident local record, not as a public attestation. Remote attestation
(signing heads with a device key, publishing anchors) is future work.

## Gate and evidence policy

The policy layer lives in `mobile/web/policy.js` and runs **before** an event is
handed to the Rust core:

- agents (`agent:*`) and system tasks (`system:*`) can never sign a gate; bare
  identifiers such as `principal` or `reviewer` are treated as humans;
- the Transfer gate requires two distinct human signers (two-key control);
- transitions have evidence floors: `investigating` needs E1, `supported` needs
  E2, `established` needs E3 (E4 when the charter is high risk);
- data class ≥ 2 payloads may contain references, hashes and short notes, but
  never raw content fields or long free text;
- evidence must reference an existing claim; grades and statuses are from fixed
  sets; corrections are appended, never edits.

The Rust core validates the envelope (types, `dataClass` 0–4, finite numbers,
UTF-8, no duplicate JSON keys, sequence and hash continuity) but it does not
interpret gate semantics. This split is deliberate: the core is small and
auditable; policy is readable JavaScript. A custom client that writes to the
same storage can bypass the policy layer. The app is a **local tool**, not a
server enforcing access control.

The UI enforces the same rules before creating an event, and refused events are
never written to the ledger. The in-app **Two-key transfer** demo shows all
three cases, including the accepted one.

## Android shell

`mobile/app/src/main/AndroidManifest.xml` declares **zero permissions**, notably
no `INTERNET`. The WebView additionally enforces defence in depth:

```
setBlockNetworkLoads(true)      no network loads, regardless of permissions
setBlockNetworkImage(true)
setAllowContentAccess(false)    no content:// reads from the page
setAllowUniversalAccessFromFileURLs(false)
setMixedContentMode(NEVER_ALLOW)
setSafeBrowsingEnabled(false)   never loads remote content to need it
setCacheMode(LOAD_NO_CACHE)
```

Navigation is restricted: `file:` stays inside the bundled app; every other URL
is handed to `OriginHost.openExternalUri`, which accepts only `https` on
`github.com`, `www.github.com`, `originlabs1.github.io` and
`apps.obtainium.imranr.dev`. Everything else is dropped. Links open in the
system browser, never in the app WebView.

`setAllowFileAccessFromFileURLs(true)` is required for the bundled
`file:///android_asset/www/` page to load its own scripts and data. Imported
files are read only through the system document picker into a string and parsed
as JSON; they are never loaded as HTML or navigated to.

### JavaScript bridge

`OriginHost` exposes exactly six methods: `appVersion`, `platform`,
`saveExport`, `shareExport`, `openExternal`, `copy` (plus `toast`). There is no
file-reading, arbitrary-intent, contacts or network method. Exports are capped
at 64 MB, filenames are reduced to `[A-Za-z0-9._-]`, and MIME types must match
`type/subtype`. `ExportProvider` is a read-only provider confined to the app
cache directory and validates the requested name against a strict pattern.

## Data at rest

The workspace is a single JSON document in WebView `localStorage` under
`originlabs.workspace.v1`. It is **not encrypted**. It lives in the app's
private data directory, which is protected by Android's per-app sandbox and,
on modern devices, by file-based encryption tied to the lock screen.

- `android:allowBackup="false"` and `data_extraction_rules.xml` exclude every
  domain from cloud backup and device transfer.
- There is no secure erase guarantee: wiping the workspace removes the
  `localStorage` key, but flash storage may retain old blocks until overwritten
  by the OS.
- Exports are plaintext. Saving writes to `Downloads/OriginLabs/` (visible to
  other apps with storage access on older Android) or to the app-specific
  external directory. Sharing grants one chosen app temporary read access via
  the share sheet.
- The app does not set `FLAG_SECURE`, so screenshots and the recents preview
  can capture ledger contents. Do not display sensitive evidence on screen if
  that matters to you.
- Clipboard content is written only when the user taps **Copy head hash**.

## Threat model

| Adversary | Capability | Mitigation | Residual risk |
| --- | --- | --- | --- |
| Network eavesdropper | observes traffic | no `INTERNET` permission; network loads blocked; no telemetry | PWA users first load the page from GitHub Pages (TLS); GitHub sees that request |
| Malicious app on device | reads shared storage, intercepts intents | app-private storage; exports only on user action; provider scoped to cache and validated names | an app the user shares an export with receives it |
| Someone with the unlocked device | opens the app | none beyond the OS lock screen | full ledger readable, by design |
| Local storage tampering | edits `localStorage` or an imported bundle | Rust recomputes every hash; import rejects a mismatching chain | a fully rewritten valid chain cannot be distinguished from the original without an external head/anchor |
| Malicious imported file | crafted JSON | strict JSON parser, duplicate-key rejection, size and schema checks, policy validation | resource exhaustion on very large input; localStorage quota rejects oversized writes |
| Supply-chain compromise | npm/crate/Gradle dependency | zero npm dependencies, zero Rust crates, no Gradle/AndroidX | the platform jar, D8 and Debian build tools are trusted at build time |

The app is not a sandbox for hostile documents. It parses JSON, renders text
through an escape helper, and stores the result. It does not execute imported
content.

## Verifying a release

1. `sha256sum -c SHA256SUMS` against the published digests.
2. `apksigner verify --print-certs` and compare the certificate SHA-256 with
   `signing-certificate.txt` and the fingerprint in the release notes.
3. Check `release-manifest.json`: the APK digest, core digest and registry
   digest must match the files in the same release.
4. In the app, run **Lab → Run self-test** and the **Tamper test**, then compare
   the demo head in the release notes if one is published.

## Reporting a vulnerability

Use GitHub's private advisory form:

`https://github.com/OriginLabs1/OriginLabs/security/advisories/new`

Please include the version, Android version, steps to reproduce, and whether
the issue affects the Rust core, the policy layer, the Android shell or the web
surface. Do not open a public issue for an unfixed vulnerability.

There is no bug bounty and no guaranteed response time. This is a FOSS project
maintained on a best-effort basis. Please give a reasonable window before
disclosure; fixes and credit will be published in the release notes if you want
them.

## Known limitations

- No signatures, no device identity, no multi-writer merge. Two people editing
  the same workspace independently produce divergent chains; v0.0.1 is
  single-device by design.
- No encryption of the workspace or exports.
- No secure deletion.
- The demo workspace is synthetic. It demonstrates the mechanics; it is not
  evidence of anything.
- WebView and OS vulnerabilities are outside this project's control. Keep the
  system WebView updated.
- Builds are not yet bit-for-bit reproducible (see `BUILD.md`); verify the
  signer and checksums rather than rebuilding and diffing bytes.
