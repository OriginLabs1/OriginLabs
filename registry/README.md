# registry/

Machine-readable catalogue for OriginLabs v0.0.1. Plain JSON, no runtime
dependencies, diff-friendly.

```
index.json      generated manifest: counts + entry paths
policy.json     FOSS-only, zero-cost, ACP and data-class policy
skills/         13 × SK-*.json
tools/          20 × TL-*.json
workflows/       8 × WF-*.json
models/          8 × MD-*.json
```

## Ground rules

- **Free and open by default.** Every tool and model declares
  `free_to_use: true` and `requires_paid_service: false`.
- **No paid default path.** A model with `requires_paid_service: true` is a
  validation failure. Paid services may be used manually only for public data,
  with a decision record, and never as a fallback.
- **OSI for active models.** Apache-2.0, MIT, BSD, MPL-2.0. Non-OSI weights
  (Gemma Terms, LFM Open License, MiniCPM terms) are `probation` only and
  cannot be the sole path for a required workflow.
- **Eval-gated.** A model is not `active` without a pinned digest and eval
  scores. Probation means "candidate", not "usable by default".
- **Licences are unverified until admission.** `license_verified: false` means
  exactly that; confirm the current licence and terms before pinning a digest.
- **ACP.** Agent clients, runtimes and adapters must be FOSS, self-hostable
  and usable without an account, API key or mandatory telemetry.

## Model shortlist (Nov 2026 assessment)

| Entry | Tier | Licence | Status | Role |
|---|---|---|---|---|
| Qwen3.5 0.8B | T0 | Apache-2.0 | probation | 4 GB / Galaxy S9 class |
| Qwen3.5 2B | T1 | Apache-2.0 | probation | constrained workhorse |
| Qwen3.5 4B | T1 | Apache-2.0 | probation | default laptop |
| Qwen3.5 9B | T1 | Apache-2.0 | probation | strongest general SLM |
| Gemma 4 4B | T1 | Gemma Terms | probation | mobile multimodal |
| LFM3 1.7B | T1 | LFM Open License | probation | agent / tool execution |
| Granite 4.2 | T1 | Apache-2.0 | probation | structured output / enterprise |
| MiniCPM5 2B | T1 | MiniCPM terms | probation | efficiency |

Qwen3.5 is the reference family, not a dependency. Swap a model by adding a
registry entry, pinning its digest, and passing the eval suite — no skill or
workflow changes.

## Regenerate

```sh
node scripts/seed-registry.mjs          # write
node scripts/seed-registry.mjs --check  # fail if stale
```

`scripts/seed-registry.mjs` is the single source of truth. Do not hand-edit
generated JSON; edit the seed and regenerate.

## Validate

```sh
npm test
```

`src/registry/load.mjs` checks IDs, kinds, counts, required fields, data
classes, approval modes, FOSS flags and the OSI rule for active models.
