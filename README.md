# OriginLabs v0.0.1

Local-first, **free and open source**, zero-cost research infrastructure.

- `mobile/` — the Android app and installable PWA, with a Rust trust core
- `CONTEXT.md` — identity, constitution, strategy, model doctrine
- `SPECS.md` — skills, tools, workflows
- `registry/` — machine-readable capability catalogue (JSON)
- `bin/origin-ledger.mjs` — append-only hash-chain verifier / writer

No paid service, account, API key or telemetry is required or supported on the default path.

## Mobile app

OriginLabs v0.0.1 ships as an Android app and an installable PWA. Both run the
same offline surface, and both verify the ledger with the same **Rust core**
compiled to WebAssembly.

| | |
| --- | --- |
| Android APK | `https://github.com/OriginLabs1/OriginLabs/releases/latest` |
| PWA | `https://originlabs1.github.io/OriginLabs/` |
| Obtainium | `https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/OriginLabs1/OriginLabs` |
| Package | `com.oneorigin.labs` · version `0.0.1` · `versionCode 1` · minSdk 29 · targetSdk 34 |
| Permissions | **none** — no INTERNET, storage, location, camera or telemetry |

What it does: charters frame falsifiable questions, claims carry confidence and
falsifiers, evidence is graded E1–E4 with transition floors, gates require human
signers (the Transfer gate requires two distinct humans), and every step is an
append-only event in a SHA-256 hash chain. The app can show you a tampered copy
being rejected at the first mismatch.

The Rust core is the only implementation of canonical JSON, SHA-256, event
construction and verification. It is `std`-only (zero crates), has no wasm
imports and therefore no syscall or network surface. The app refuses to run
without it. See `mobile/docs/SECURITY.md` for what the chain does and does not
prove.

Build it:

```sh
cd mobile
./scripts/build-wasm.sh          # cargo test + native CLI + wasm32 + embed
node scripts/gen-icons.mjs
node scripts/build-web.mjs
./scripts/gen-keys.sh            # once; back up mobile/keys/ offline
./scripts/build-apk.sh
node scripts/release.mjs         # checksums, manifest, CycloneDX SBOM
```

No Gradle, no AndroidX, no npm dependencies. Full prerequisites, the manual
`aapt2`/`javac`/D8/`zipalign`/`apksigner` pipeline and troubleshooting are in
`mobile/docs/BUILD.md`. Distribution, signing continuity and verification are in
`mobile/docs/DISTRIBUTION.md`; privacy is in `mobile/docs/PRIVACY.md`.

Mobile tests: `cd mobile && node --test test/*.test.mjs`.

## Quick start

```sh
node bin/origin-ledger.mjs verify          # verify .origin/events.jsonl
node bin/origin-ledger.mjs head            # show the current head
node bin/origin-ledger.mjs anchor          # write a checkpoint anchor
node bin/origin-ledger.mjs append \
  --type gate.decided \
  --payload '{"gate":"frame","decision":"approve"}' \
  --actor principal --data-class 1

node scripts/seed-registry.mjs --check     # registry is not stale
npm test                                    # node:test suites
npm run check                               # all of the above
```

No `npm install` is needed. The project uses the Node.js standard library only
(Node ≥ 20; developed on 22).

## Ledger format

Every event appended by `origin-ledger` is a v1 envelope:

```json
{
  "schema": "origin.event/v1",
  "seq": 2,
  "at": "2026-11-13T16:00:00.000Z",
  "type": "gate.decided",
  "actor": "principal",
  "dataClass": 1,
  "payload": { "gate": "frame" },
  "prev": "<sha256 of seq 1>",
  "hash": "<sha256 of canonical body>"
}
```

The hash is SHA-256 over canonical JSON: keys sorted recursively, no
whitespace, `undefined` omitted. Verification checks genesis, sequence,
`prev` continuity and every hash.

The existing genesis event was created before v1 and has no `schema`,
`actor` or `dataClass`. It is treated as a **trust anchor**: chain continuity
is still enforced, but its hash is reported as `legacy` because the original
canonicalisation is unknown. `--strict` refuses to accept it. Every event
appended now is fully verifiable, and the writer refuses to extend a broken
chain.

## Registry

`registry/index.json` is generated from `scripts/seed-registry.mjs`, which is
the single source of truth. Edit the seed data, then run `npm run seed`.
`registry/policy.json` records the FOSS / zero-cost / ACP rules.

All 20 tools and all 8 models declare `free_to_use: true` and
`requires_paid_service: false`. Models are `probation` until a digest is
pinned and the eval suite is run; non-OSI weights cannot be `active`.
The default model path is local and OSI-licensed (Qwen3.5, Granite 4.2).

## Design constraints

- Append-only history: corrections are new events, never edits.
- Local inference first; remote inference is an exception, logged.
- Data classes 0–4 gate both tools and models.
- Agents and ACP surfaces must be FOSS, self-hostable and free to use.
- Verification must work offline, on a clean machine, with no account.

## Licence

MIT. See `LICENSE`.
