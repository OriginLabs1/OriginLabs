# SPECS.md
## OriginLabs v0.0.1 — Skills · Tools · Workflows

| Field | Value |
|---|---|
| Document | `SPECS.md` |
| Version | 0.0.1 |
| Status | Normative for v0.0.1 |
| Companion | `CONTEXT.md` (identity, constitution, doctrine) |
| Scope | Single-operator, local-first laboratory runtime |
| Parts | **I. SKILLS** · **II. TOOLS** · **III. WORKFLOWS** |

> This file contains the three normative sub-specs. Each part is self-contained and may later be split into `SKILLS.md`, `TOOLS.md` and `WORKFLOWS.md` without changing a word.
>
> **Normative keywords:** MUST, MUST NOT, SHOULD, MAY. A capability that is not registered, versioned and evaluated is not part of the lab.

---

# PART 0 — Shared model

Everything below depends on five shared constructs: identifiers, artifacts, evidence, data classes, and the ledger envelope.

## 0.1 Identifiers

| Prefix | Artifact | Example |
|---|---|---|
| `CH-` | Charter | `CH-0001` |
| `CL-` | Claim | `CL-0012` |
| `EV-` | Evidence | `EV-0044` |
| `RN-` | Run | `RN-0107` |
| `KN-` | Knowledge artifact | `KN-0009` |
| `DR-` | Decision record | `DR-0003` |
| `SK-` | Skill | `SK-06` |
| `TL-` | Tool | `TL-09` |
| `WF-` | Workflow | `WF-03` |
| `MD-` | Model registry entry | `MD-qwen3.5-4b` |

IDs are never reused. A superseded artifact keeps its ID and points to its replacement.

## 0.2 Artifact schemas

### Charter

```yaml
id: CH-0001
title: "Does constrained decoding reduce tool-call errors in 4B models?"
program: P2
question: "..."                  # one falsifiable question
why_now: "..."
scope:
  in: [...]
  out: [...]
claims: [CL-0001]                # claims this charter intends to test
evidence_bar: E2                 # minimum grade to pass the Prove gate
risk:
  class: low | moderate | high
  dual_use: false
  data_class_max: 1
budget:
  weeks: 6
  compute_hours: 40
  usd: 150
  tokens: 5000000
stop_conditions: [...]           # explicit; no charter without them
owner: principal
status: proposed | active | paused | closed | killed
```

### Claim

```yaml
id: CL-0001
charter: CH-0001
statement: "..."                 # one sentence, falsifiable
type: empirical | analytical | engineering | definitional
status: proposed | investigating | supported | established | contested | retracted | superseded
falsifier: "..."                 # what observation would kill it
evidence: [EV-0001]
confidence: 0.0                  # 0–1; calibrated, not decorative
limitations: [...]
supersedes: null
```

### Evidence

```yaml
id: EV-0001
claim: CL-0001
grade: E0 | E1 | E2 | E3 | E4
kind: measurement | proof | experiment | replication | literature | review
run: RN-0001 | null
source: { doi: "...", url: "...", artifact: "..." }
method: "..."
result: "..."
reproduces: true | false | partial
recorded_by: principal | agent
```

### Knowledge artifact

```yaml
id: KN-0001
kind: finding | method | standard | reference-impl | dataset | negative-result | decision
title: "..."
claims: [CL-0001]
summary: "..."
provenance:
  runs: [RN-0001]
  commits: ["<sha>"]
  models: [MD-qwen3.5-4b]
license: Apache-2.0 | MIT | CC-BY-4.0 | internal
reuse: internal | ecosystem | public
maintainer: principal
limitations: [...]
```

### Run manifest

```yaml
id: RN-0001
charter: CH-0001
workflow: WF-02
stage: "verify"
inputs_hash: "sha256:..."
outputs_hash: "sha256:..."
environment:
  image_digest: "sha256:..."
  lockfile_hash: "sha256:..."
models:
  - id: MD-qwen3.5-4b
    digest: "sha256:..."
    adapter: null
    sampling: { temperature: 0, top_p: 1, seed: 42 }
skills: [SK-04@1.0.0, SK-06@1.0.0]
tools: [TL-09@1.0.0, TL-06@1.0.0]
data_class: 1
approvals: [principal]
budget_used: { seconds: 812, usd: 0.00, tokens: 184320 }
status: running | succeeded | failed | aborted
started_at: "..."
ended_at: "..."
```

A run without this manifest is not a run; it is an anecdote.

### Decision record

```yaml
id: DR-0003
context: "..."
options: ["A", "B", "C"]
decision: "B"
reasons: [...]
consequences: [...]
reversibility: easy | costly | irreversible
evidence: [EV-0012]
decided_by: principal
date: "YYYY-MM-DD"
```

## 0.3 Claim lifecycle and evidence grades (normative)

```
proposed ──► investigating ──► supported ──► established
                 │                 │              │
                 └────► contested ◄┘              │
                              │                    │
                              └──► retracted ◄─────┘
                                        │
                                        └──► superseded
```

| Grade | Definition | May support |
|---|---|---|
| E0 | Assertion, no traceable support | `proposed` only |
| E1 | Traceable citation; not independently checked | `investigating` |
| E2 | Reproducible from method + artifacts by a competent operator | `supported` |
| E3 | Independent replication within stated tolerance | `established` (low/moderate risk) |
| E4 | E3 + adversarial review, external validation or field consensus | `established` (high risk) |

**Rules**

1. A claim MUST NOT be marked `supported` without at least one E2 evidence record.
2. A claim MUST NOT be marked `established` below E3; high-risk claims require E4.
3. A model output is a claim, never evidence. It may become evidence only after a run, a check, or a citation.
4. Contradictory evidence MUST be recorded against the claim, even if it is inconvenient.
5. Retraction and correction are **new events** referencing the old record. The ledger is never rewritten.
6. Negative results are `KN` artifacts with the same standing as positive findings.

## 0.4 Data classes and egress

| Class | Label | Examples | Local tiers | Remote tiers | Egress |
|---|---|---|---|---|---|
| 0 | Public | published papers, open datasets, public code | T0–T3 | T0–T3 | allowlist |
| 1 | Internal | drafts, notes, uncommitted research | T0–T3 | T2–T3 with approval | allowlist |
| 2 | Confidential | partner data, pre-publication results | T0–T2 | none by default | deny |
| 3 | Restricted | personal data, credentials, embargoed material | T0–T1 | none | deny + no telemetry |
| 4 | Regulated | export-controlled, legally restricted | T0, air-gapped | none | deny |

**Rules**

1. The workspace default is class 0. A charter raises the ceiling explicitly; nothing lowers it implicitly.
2. Every tool declares `data_class_max`. The Coordinator MUST reject a call above the ceiling.
3. Remote inference requires an explicit, logged exception for class ≥2 — never a default.
4. Prompts, completions and embeddings inherit the class of their inputs.
5. Logs and traces are data: class rules apply to observability too.

## 0.5 Ledger event envelope

Every state change is one JSON line:

```json
{
  "schema": "origin.event/v1",
  "seq": 42,
  "at": "2026-11-13T16:00:00.000Z",
  "type": "evidence.recorded",
  "actor": "principal",
  "dataClass": 1,
  "payload": { "claim": "CL-0001", "evidence": "EV-0007" },
  "prev": "<sha256 of seq 41>",
  "hash": "<sha256 of canonical event body>"
}
```

The hash is SHA-256 over **canonical JSON** of `{schema, seq, at, type, actor, dataClass, payload, prev}`: object keys sorted recursively, no whitespace, `undefined` omitted, non-finite numbers rejected. `schema`, `actor` and `dataClass` are part of the hash.

**Event types (v0.0.1):** `workspace.created`, `charter.proposed`, `charter.approved`, `run.started`, `run.finished`, `claim.created`, `claim.transitioned`, `evidence.recorded`, `artifact.published`, `gate.decided`, `route.decided`, `model.admitted`, `incident.opened`, `correction.appended`, `spec.versioned`, `budget.adjusted`.

`ledger.verify` MUST recompute the chain from genesis and fail loudly on the first mismatch.

**Payload rule.** Ledger payloads carry identifiers, decisions, hashes and metadata — never raw class ≥2 content. Restricted content lives in the artifact store, encrypted at rest, referenced by hash. The ledger proves *what happened*; it does not become a second copy of the data.

## 0.6 Versioning and deprecation

- Artifacts use **semantic versioning**; a breaking schema change is a major bump.
- Skills, tools and workflows are versioned independently of the documents.
- A run pins exact versions; it never resolves "latest".
- Deprecation requires: a replacement, a migration note, a 90-day window, and a `spec.versioned` event.
- Model entries are pinned by digest. A moving tag is not a model identity.

## 0.7 Budget defaults

| Scope | Wall clock | Compute | USD | Tokens |
|---|---|---|---|---|
| Single run | 30 min | 1 GPU-hour | 2 | 200k |
| Charter | 6 weeks | 40 GPU-hours | 150 | 5M |
| Program / quarter | 12 weeks | 200 GPU-hours | 750 | 30M |
| Exploration reserve | ≤10% of program | — | — | — |
| Replication reserve | ≥20% of program | — | — | — |

Exceeding a ceiling pauses execution and opens a `budget.adjusted` decision. Budgets are guardrails, not aspirations. USD figures account for hardware, electricity and amortisation; **no workflow may assume a paid API budget**.

---

# PART I — SKILLS

## 1.1 Definition and rules

A **skill** is a versioned *procedure with judgment*: it tells an operator (human or agent) how to move from inputs to a defensible output, including when to stop, what evidence is required, and how the skill itself is evaluated.

A skill is **not** a prompt, a tool, or a workflow.

| Concept | Answers | Has side effects | Versioned | Evaluated |
|---|---|---|---|---|
| Skill | *How should this be reasoned about?* | No (delegates) | Yes | Yes |
| Tool | *What can be done?* | Yes | Yes | Yes |
| Workflow | *In what order, with which gates?* | Through tools | Yes | Yes |

**Rules**

1. Every skill MUST declare inputs, outputs, procedure, evidence bar, guards and at least one eval.
2. A skill MUST NOT contain hidden state or ambient authority; it acts only through registered tools.
3. A skill MUST fail closed: if inputs are missing or the evidence bar cannot be met, it returns `blocked`, not a guess.
4. A skill SHOULD be small enough to review in one sitting and to replay deterministically (temperature 0 where applicable).
5. Skill text is a specification, not a magic spell. If the procedure cannot be followed by a competent stranger, it is not a skill.

## 1.2 Skill schema

```yaml
id: SK-06
name: verify.replicate
version: 1.0.0
intent: "Independently rerun a claim's evidence and report agreement or divergence."
trigger: "An evidence record at E2 is proposed for E3."
inputs:
  claim_id: CL-*
  evidence_id: EV-*
  tolerance: "..."
outputs:
  - evidence_record: EV-*
  - verdict: replicated | not-replicated | partial
tools: [TL-02, TL-04, TL-06, TL-09, TL-17]
procedure: [...]
evidence_bar: E3
guards:
  - "operator != original operator"
  - "model family != original model family when model-dependent"
  - "environment rebuilt from manifest, not reused"
evals:
  - id: EVAL-SK06-01
    pass: "seeded divergence is detected in 5/5 cases"
owner: principal
status: active | deprecated
```

## 1.3 Catalog (v0.0.1)

| ID | Skill | Gate served | Output |
|---|---|---|---|
| SK-01 | `frame.question` | Frame | Charter draft |
| SK-02 | `survey.prior-art` | Frame | Prior-art brief |
| SK-03 | `form.hypothesis` | Frame | Claims with falsifiers |
| SK-04 | `design.experiment` | Prove | Preregistered protocol |
| SK-05 | `build.slice` | Prove | Reproducible prototype |
| SK-06 | `verify.replicate` | Prove / Transfer | Replication evidence |
| SK-07 | `assess.risk` | Prove / Transfer | Risk assessment |
| SK-08 | `challenge.claim` | Prove | Adversarial review |
| SK-09 | `distill.artifact` | Prove | Knowledge artifact |
| SK-10 | `package.transfer` | Transfer | Transfer package |
| SK-11 | `route.model` | All | Route decision |
| SK-12 | `record.decision` | All | Decision record |
| SK-13 | `review.gate` | All gates | Gate packet |

## 1.4 Skill cards

### SK-01 · `frame.question` · v1.0.0

**Intent.** Turn an observation, annoyance or opportunity into one falsifiable question worth a charter.
**Procedure.** (1) State the observation without interpretation. (2) Ask "what would have to be true?" (3) Rewrite as a single question with a measurable answer. (4) Name the decision it would change. (5) Draft scope, stop conditions and budget. (6) Submit to the Frame gate.
**Evidence bar.** None yet; the output is a charter, not a finding.
**Guards.** One question per charter; no compound "and"; if the answer would not change any decision, kill it.
**Eval.** A reviewer can state the falsifier without asking a follow-up question (≥4/5 samples).

### SK-02 · `survey.prior-art` · v1.0.0

**Intent.** Establish what is already known, by whom, and what remains genuinely open.
**Procedure.** (1) Define search terms and venues. (2) Collect ≥15 sources across ≥3 communities. (3) Grade each source (peer-reviewed, preprint, vendor, anecdote). (4) Build a claim→source matrix. (5) Identify the closest prior work and the exact delta. (6) State what would change our mind.
**Evidence bar.** E1 minimum per cited source; no novelty claim above E1.
**Guards.** Vendor claims are not evidence; unread sources are not citations; "no prior art found" requires a logged query set.
**Eval.** A second searcher reproduces ≥80% of the source set from the logged queries.

### SK-03 · `form.hypothesis` · v1.0.0

**Intent.** Convert a question into claims that can lose.
**Procedure.** (1) Write the claim as one sentence. (2) Specify the mechanism. (3) Specify the falsifier. (4) Design the cheapest decisive test. (5) State the expected effect size and tolerance. (6) Record the prior probability.
**Evidence bar.** E0 at formation; the claim is `proposed`.
**Guards.** No unfalsifiable claims; "better" must name the metric; no hypothesis that requires the conclusion.
**Eval.** Independent reviewer can design the test from the card alone (≥4/5).

### SK-04 · `design.experiment` · v1.0.0

**Intent.** Produce a protocol that someone else could run without asking us anything.
**Procedure.** (1) Define variables, controls, and confounders. (2) Choose metrics and tolerance. (3) Justify sample size or state the resource bound. (4) Preregister the protocol in the ledger before running. (5) Define stop and abort rules. (6) Define the analysis plan, including what counts as failure.
**Evidence bar.** Protocol must be E2-ready before execution.
**Guards.** No metric changes after seeing data without a decision record; no p-hacking; no "we'll know it when we see it".
**Eval.** Clean-room operator executes the protocol without clarification (1/1 dry run).

### SK-05 · `build.slice` · v1.0.0

**Intent.** Build the thinnest vertical slice that can produce evidence.
**Procedure.** (1) Reduce to one user-visible or one measurable behavior. (2) Pin the environment. (3) Implement, with no unrelated refactors. (4) Capture a manifest. (5) Write the two-minute reproduction note. (6) Hand to verification.
**Evidence bar.** Prototype runs from a clean checkout.
**Guards.** No scope creep; no unregistered dependencies; no secrets in code; no "demo-only" branches that cannot be rerun.
**Eval.** Fresh environment reproduces the primary output in ≤30 minutes.

### SK-06 · `verify.replicate` · v1.0.0

**Intent.** Try honestly to break a result by rerunning it independently.
**Procedure.** (1) Read only the manifest and protocol, not the author's conclusions. (2) Rebuild the environment from digest. (3) Rerun with a different seed; different operator; different model family where model-dependent. (4) Compare within declared tolerance. (5) Record divergence, including small ones. (6) Issue `replicated`, `partial`, or `not-replicated`.
**Evidence bar.** E3 on success; a documented failure is also a valid output.
**Guards.** Independence is structural, not attitudinal; no reuse of cached outputs; no silent parameter changes.
**Eval.** Seeded numerical drift is caught in 5/5 trials; a true replication is not falsely rejected in 5/5.

### SK-07 · `assess.risk` · v1.0.0

**Intent.** Decide whether the work should proceed, and under what constraints.
**Procedure.** (1) Classify risk (low/moderate/high). (2) Enumerate harms: safety, security, privacy, dual-use, environment, dignity. (3) Identify who could be harmed and how. (4) Propose mitigations and residual risk. (5) Name the human accountable. (6) Recommend proceed / constrain / stop.
**Evidence bar.** Documented reasoning; no evidence grade required, but no hand-waving allowed.
**Guards.** "It's just research" is not a mitigation; high risk requires an independent reviewer.
**Eval.** A reviewer blind to the author's recommendation reaches the same risk class in ≥4/5 cases.

### SK-08 · `challenge.claim` · v1.0.0

**Intent.** Attack a claim before the world does.
**Procedure.** (1) Steelman the claim. (2) List assumptions. (3) Attack method, measurement, statistics, and alternative explanations. (4) Search for disconfirming evidence. (5) Test the weakest link. (6) Issue a verdict with reasons.
**Evidence bar.** Must cite specific evidence or specific missing evidence.
**Guards.** No strawmen; no rhetorical skepticism without a test; disagreement is recorded, not resolved by seniority.
**Eval.** Seeded flawed claims are flagged in ≥4/5 cases; sound claims survive in ≥4/5.

### SK-09 · `distill.artifact` · v1.0.0

**Intent.** Convert work into something another person can use without us.
**Procedure.** (1) State the claim and its grade. (2) Summarize method and evidence. (3) State limitations and uncertainties. (4) Provide provenance (runs, commits, models). (5) Choose license and reuse level. (6) Name a maintainer.
**Evidence bar.** Matches the claim's grade; no inflation.
**Guards.** No artifact without limitations; no artifact without provenance; no "misc" dumps.
**Eval.** An outsider reproduces the artifact's headline result from the artifact alone.

### SK-10 · `package.transfer` · v1.0.0

**Intent.** Move a validated result out of the lab responsibly.
**Procedure.** (1) Choose form: standard, reference implementation, dataset, publication, internal adoption. (2) Audit provenance and licenses. (3) Check IP and attribution. (4) Re-run the risk assessment for the deployment context. (5) Prepare the package and its reproduction instructions. (6) Submit to the two-key Transfer gate.
**Evidence bar.** E3 minimum (E4 for high risk).
**Guards.** No transfer without a named owner; no license ambiguity; no claim stronger than the evidence.
**Eval.** Recipient can use the package without private assistance; legal/license checklist complete.

### SK-11 · `route.model` · v1.0.0

**Intent.** Pick the cheapest adequate model for the task without violating policy.
**Procedure.** (1) Classify the task (extract, classify, draft, code, reason, verify). (2) Read the data class. (3) Filter the registry by license, tier and policy. (4) Score candidates on eval fit and cost. (5) Choose; record rationale. (6) Escalate only on a defined trigger.
**Evidence bar.** Route decision logged with model digest and reason.
**Guards.** No route above the data-class ceiling; no same-family verification; no silent fallback to a remote model.
**Eval.** ≥90% route correctness on held-out tasks; 0 policy violations in adversarial cases.

### SK-12 · `record.decision` · v1.0.0

**Intent.** Make a choice reviewable six months later.
**Procedure.** (1) State context and constraints. (2) List real options, including "do nothing". (3) State the decision and reasons. (4) State consequences and reversibility. (5) Link evidence. (6) Record in the ledger.
**Evidence bar.** Links to supporting evidence where claimed.
**Guards.** No retroactive justification; no decision without an owner; no irreversible choice without a named risk.
**Eval.** A reader can reconstruct why the decision was made without asking the author (≥4/5).

### SK-13 · `review.gate` · v1.0.0

**Intent.** Assemble and defend a gate packet, or reject it.
**Procedure.** (1) Confirm charter scope and evidence bar. (2) Verify ledger integrity for the packet. (3) Check every claim's grade against its evidence. (4) Confirm risk review and stop conditions. (5) Summarize dissent and open questions. (6) Recommend approve / revise / kill, with reasons.
**Evidence bar.** Every claim above E1 must link to an evidence record; every run must have a manifest.
**Guards.** The producer of the evidence SHOULD NOT be the sole reviewer at Transfer; an agent MUST NOT sign a gate.
**Eval.** Seeded packets with an inflated grade or a missing manifest are rejected in 5/5 cases.

## 1.5 Skill quality gates

A skill enters the registry only if it has: a schema-valid definition, at least one eval, a named owner, a stated failure mode, and a dry-run record. A skill is deprecated when its eval falls below threshold twice consecutively, when its tools are retired, or when a simpler skill subsumes it. Deprecated skills remain readable forever; they are never silently deleted.

---

# PART II — TOOLS

## 2.1 Definition and rules

A **tool** is a typed capability with declared side effects, permissions, data-class ceiling, budget and failure semantics. Tools are the only way a skill or workflow touches the world.

**Rules**

1. Every tool MUST have a machine-readable input/output schema and a declared `data_class_max`.
2. Every side-effecting tool MUST be idempotent or explicitly marked non-idempotent with a dedupe key.
3. Every tool call MUST be policy-checked before execution and ledger-logged after (including failures).
4. Tools MUST fail closed: unknown input, exceeded budget, missing approval → refuse.
5. Tools MUST NOT read ambient environment, secrets, or network beyond their declaration.
6. A tool version is immutable. Behaviour changes require a new version.

## 2.2 Tool schema

```yaml
id: TL-09
name: model.infer
version: 1.0.0
transport: mcp | local
side_effects: none | local-write | network
idempotent: true
input_schema: { ... }            # JSON Schema
output_schema: { ... }
data_class_max: 1
approval: none | principal | two-key
budget: { seconds: 120, usd: 0.50, tokens: 32000 }
failure: retry(2) | fallback | halt
audit: ledger
```

## 2.3 Registry (v0.0.1)

| ID | Tool | Side effects | Data class max | Approval | Purpose |
|---|---|---|---|---|---|
| TL-01 | `ledger.append` | local-write | 4 | none | Append one event to the hash chain |
| TL-02 | `ledger.verify` | none | 4 | none | Recompute and validate the chain |
| TL-03 | `artifact.write` | local-write | 4 | none | Write a KN/claim/evidence/run record |
| TL-04 | `artifact.query` | none | 4 | none | Query artifacts and claims by ID/tag |
| TL-05 | `citation.resolve` | network | 1 | none | Resolve DOI/URL to a stable record |
| TL-06 | `sandbox.exec` | local-write | 4 | none | Run code in an isolated, egress-limited sandbox |
| TL-07 | `repo.git` | local-write | 2 | none | Version control operations in the workspace |
| TL-08 | `bench.run` | local-write | 2 | none | Execute eval suites and record results |
| TL-09 | `model.infer` | none | 4 | none | Single inference on a registered model |
| TL-10 | `model.route` | none | 4 | none | Select a model tier/entry for a task |
| TL-11 | `model.eval` | local-write | 2 | none | Run the capability eval suite |
| TL-12 | `model.embed` | none | 4 | none | Embeddings for retrieval over the ledger |
| TL-13 | `web.fetch` | network | 0 | none | Fetch a URL into a quarantined channel |
| TL-14 | `web.search` | network | 0 | none | Search, returning citations and snippets |
| TL-15 | `human.request` | none | 4 | none | Block a workflow pending human input |
| TL-16 | `review.gate` | local-write | 4 | two-key | Record a gate decision |
| TL-17 | `checkpoint.create` | local-write | 4 | none | Snapshot workflow state for resume |
| TL-18 | `secret.use` | none | 4 | principal | Brokered, scoped, logged secret access |
| TL-19 | `workspace.init` | local-write | 0 | none | Provision `.origin` workspace and policy |
| TL-20 | `budget.check` | none | 4 | none | Read and reserve budget |

## 2.4 Core contracts

### TL-01 `ledger.append`

```json
{ "type": "evidence.recorded", "actor": "principal", "dataClass": 1,
  "payload": { "claim": "CL-0001", "evidence": "EV-0007" } }
→ { "seq": 43, "hash": "sha256:…", "prev": "sha256:…" }
```
Append-only. Rejects if `prev` does not match the current head. Deduplicates on `(type, payload_hash)` for idempotent retries.

### TL-02 `ledger.verify`

```json
{ "from": 0, "to": null }
→ { "ok": true, "events": 128, "head": "sha256:…", "breaks": [] }
```
MUST recompute every hash. A single mismatch returns `ok: false` with the sequence number and MUST halt dependent workflows.

### TL-06 `sandbox.exec`

```json
{ "image": "sha256:…", "cmd": ["python", "repro.py"],
  "inputs": ["artifacts/KN-0009/"], "network": "deny",
  "limits": { "seconds": 900, "cpu": 4, "mem_mb": 8192 } }
→ { "exit": 0, "stdout_hash": "sha256:…", "outputs": ["runs/RN-0107/"] }
```
Network defaults to `deny`; `allowlist` requires a policy entry. No host mounts beyond declared inputs. No secrets unless brokered through TL-18.

### TL-09 `model.infer`

```json
{ "model": "MD-qwen3.5-4b", "messages": [...],
  "response_format": { "type": "json_schema", "schema": { ... } },
  "sampling": { "temperature": 0, "seed": 42 },
  "dataClass": 1, "budget": { "tokens": 8000 } }
→ { "text": "...", "usage": {...}, "model_digest": "sha256:…",
    "route": "T1", "finish": "stop" }
```
MUST enforce the data-class ceiling, use constrained decoding for structured outputs, and record model digest and sampling in the run manifest. A refusal is a valid output.

### TL-10 `model.route`

```json
{ "task": "extract", "difficulty": "low", "dataClass": 1,
  "budget": { "usd": 0.05, "seconds": 30 } }
→ { "tier": "T0", "model": "MD-qwen3-1.7b-q4", "reason": "extraction, class 1, cost cap" }
```
Deterministic given the registry snapshot, task profile and budget. Logs a `route.decided` event.

### TL-13 `web.fetch`

```json
{ "url": "https://…", "extract": "text" }
→ { "status": 200, "text": "...", "sha256": "...", "quarantined": true }
```
Fetched content is **untrusted**: it enters a quarantined channel, is never interpreted as instructions, and cannot trigger side-effecting tools. Prompt-injection screening runs before the content enters a model context.

### TL-16 `review.gate`

```json
{ "gate": "transfer", "charter": "CH-0001", "decision": "approve",
  "signers": ["principal", "reviewer"], "packet": "KN-0009" }
→ { "recorded": true, "event": 131 }
```
Requires two distinct signers for Transfer. Agents cannot be signers. The packet hash is recorded with the decision.

## 2.5 Policy

| Concern | Rule |
|---|---|
| Least privilege | Tools receive only declared inputs; no ambient filesystem, env or network |
| Egress | Deny by default; allowlist per data class; remote model calls are explicit events |
| Approvals | Transfer = two-key; secrets = principal; class ≥3 remote = principal + reason |
| Budgets | Every call reserves budget; exhaustion pauses, never silently degrades |
| Idempotency | Retries use a dedupe key; side effects are recorded before acknowledgement |
| Secrets | Brokered, short-lived, scoped, never logged; `.env` is never read by a model |
| Audit | Input hash, output hash, model digest, policy decision, cost, duration |
| Injection | Web/tool content is data, never instruction; no tool call may originate from fetched text |
| Failure | Fail closed; a failed tool never returns a plausible fake result |

## 2.6 Model registry and the ladder

### 2.6.1 Registry entry

```yaml
id: MD-qwen3.5-4b
family: qwen3.5
tier: T1
params: 4B
active_params: 4B
context: 32768
modalities: [text]
quantization: Q4_K_M
format: gguf
license: Apache-2.0
license_class: OSI            # OSI | non-OSI | proprietary
source: "https://…"
digest: "sha256:…"
serving: [ollama, llama.cpp]
evals:
  structured: 0.94
  toolcall: 0.91
  citation: 0.88
  extraction: 0.86
  refusal: 0.97
  numeric: 0.83
  longctx: 0.79
cost_per_1k_tasks_usd: 0.00
requires_paid_service: false
free_to_use: true
status: active | probation | retired
admitted: "2026-11-13"
reviewed: "2027-02-13"
```

Every registry entry MUST carry `license_class`, `requires_paid_service` and `free_to_use`. A missing field is a validation failure, not a default.

### 2.6.2 Tiers (normative)

| Tier | Size class | Default use | Escalation trigger |
|---|---|---|---|
| T0 Reflex | ≤1B | route, tag, classify, extract, dedupe | schema validity <0.9 or ambiguity |
| T1 Workhorse | 1–9B / small-active MoE | draft, code, tool calls, local RAG | eval score below threshold or 2 failed retries |
| T2 Reasoner | ≥20B / ~30B-A3B / zero-cost open endpoint | synthesis, hard reasoning, red-team | only by explicit budget or risk need |
| T3 Verifier | 1–9B, different family | entailment, rubric scoring, citation checks | never used to produce the claim it verifies |

Indicative exemplars per tier are listed in `CONTEXT.md` §7.1. The registry, not the document, is authoritative. **A newer model enters a tier only by passing the eval suite; release notes are not evidence.** If no free, local T2 candidate exists, the route returns `blocked` — it does not fall back to a paid API.

Indicative exemplars per tier are listed in `CONTEXT.md` §7.1. The registry, not the document, is authoritative. **A newer model enters a tier only by passing the eval suite; release notes are not evidence.**

### 2.6.3 Eval suite (120 items, v0.0.1)

| Category | Items | Threshold |
|---|---|---|
| JSON-schema adherence | 20 | ≥0.90 |
| Tool-call validity and arguments | 20 | ≥0.85 |
| Citation faithfulness / grounded QA | 20 | ≥0.88 |
| Extraction accuracy (F1) | 15 | ≥0.80 |
| Refusal calibration (unsafe vs benign) | 15 | ≥0.95 unsafe refusal, ≤0.05 over-refusal |
| Numeric and symbolic accuracy | 15 | ≥0.80 |
| Long-context retrieval and synthesis | 15 | ≥0.75 |

The suite is versioned, held out, and refreshed quarterly. Scores are recorded per model digest, per quantization. A model that passes at Q8 and fails at Q4 is a Q8 model.

### 2.6.4 Routing algorithm

```
route(task, data_class, budget):
  tier = base_tier(task.kind)                 # extract→T0, draft→T1, reason→T2
  candidates = registry.active(tier)
  candidates = filter(candidates, license_ok, data_class_ok, context_ok)
  candidates = filter(candidates, free_to_use == true, requires_paid_service == false)
  candidates = filter(candidates, cost ≤ budget.usd, latency ≤ budget.seconds)
  if task.kind == "verify":
      candidates = filter(candidates, family != producer.family)
  if empty(candidates):
      return blocked(reason="no free, eligible candidate")    # never a paid fallback
  best = argmax(candidates, eval_fit(task) / cost)
  if confidence(best) < threshold: return escalate(tier, reason="low confidence")
  return best
```

**Escalation** is allowed only for: low confidence, two failed retries, ambiguity flagged by T0, explicit risk review, or a data class that forbids the cheaper tier (never the reverse). Every escalation logs tier, reason, delta cost, and outcome. Escalation to a paid or closed service is **not** a valid route; it is a policy violation.

### 2.6.5 Serving and efficiency

- Local serving: Ollama for T0/T1 simplicity; llama.cpp for constrained/edge; vLLM for batch eval; MLX on Apple silicon.
- Quantization: Q4_K_M default for T0/T1; Q5/Q8 for verification and numeric tasks; FP8/AWQ where supported.
- Structured output: JSON-schema or grammar-constrained decoding for every artifact and tool call. Never parse free text when a grammar will do.
- Batching and caching: prompt-prefix caching for repeated skill preambles; embed once, retrieve many.
- Speculative decoding: only with a verified draft model of the same family and a measured acceptance rate.
- Context: retrieval over the ledger beats stuffing. Long context is a fallback, not a strategy.

### 2.6.6 Adaptation policy

| Technique | Allowed when | Forbidden when |
|---|---|---|
| Retrieval (RAG) | Always first | Never |
| Prompt/skill revision | Behavior or format issue | Compensating for missing facts |
| Constrained decoding | Structured output | Open-ended synthesis |
| LoRA / QLoRA | Stable, high-volume, narrow behavior; class 0–1 data | Safety policy, facts, low-volume tasks |
| Distillation T2→T1 | Verified outputs only; passes eval gate | Unverified or contested outputs |
| Full fine-tune | Not in v0.0.1 | — |

Adapters are versioned by digest, evaluated against the base model, and rollback-able. Improvement must be shown on the lab's own eval, not on a public leaderboard.

### 2.6.7 Supply chain and licenses

- Formats: safetensors or GGUF only. No pickle. No `trust_remote_code`.
- Every weight file is checksum-pinned and scanned before admission.
- **Default tiers (active) MUST be OSI-licensed**: Apache-2.0, MIT, BSD-2/3, MPL-2.0 (file-level care). CC-BY-4.0 is acceptable for data, not for model weights.
- Free-but-non-OSI weights (Gemma Terms, LFM Open License and similar) MAY be admitted only as `probation`, flagged in the registry, license-reviewed, and never as the sole path for a required workflow.
- **No paid model may be `active`.** `requires_paid_service: true` is a validation failure for the default path; it may exist only as a manually selected, public-data exception recorded in a decision record.
- A model with unverifiable provenance is not admitted, regardless of benchmark score.
- Retirement is planned, not reactive: two candidates per tier, one probationary.

### 2.6.8 The zero-cost test

A model or tool passes only if a new operator can use it on commodity hardware with:

1. no payment, subscription or trial that expires;
2. no account, API key or vendor approval;
3. no mandatory telemetry or phone-home;
4. no closed component in the critical path;
5. a documented, reproducible local install.

This test is run in CI on a clean environment and repeated at every quarterly review. "Free tier" is not free.

## 2.7 MCP and interoperability

- Tools SHOULD expose an MCP-compatible interface; the schema in §2.2 is the canonical contract and the MCP tool definition is generated from it.
- Tool names are stable and namespaced (`origin.ledger.append`), versions are explicit, and breaking changes require a new tool ID.
- Every tool ships with: schema, policy metadata, one happy-path test, one refusal test, one budget-exhaustion test.
- Registries are plain JSON (+ JSON Schema) so they remain readable and portable outside the Coordinator. YAML examples in this document are illustrative authoring forms; the canonical registry files are `.json`.
- Every skill, tool and workflow in the registry carries a `spec_ref` pointing back to its normative section here.

## 2.8 Agents, ACP and the free-and-open rule

- Any agent used by the lab — client, runtime, adapter, or protocol bridge — MUST be FOSS, self-hostable, and usable without payment, an account, an API key, or mandatory telemetry.
- **ACP** (Agent Client Protocol and equivalent open agent protocols) is the preferred interoperability surface. Adapters MUST be replaceable; no workflow may depend on a proprietary agent runtime.
- Agent capabilities are capabilities: they are registered as tools, scoped by data class, and audited in the ledger like any other side effect.
- A remote agent service may be used only for class 0–1 data, only at zero cost, and only with a decision record. It is never a default.
- The Coordinator MUST remain runnable headless, offline, and without an account. If a UI is proprietary or unavailable, the engine still works.
- An agent that cannot be inspected, replaced or run locally is not admitted — regardless of capability.

---

# PART III — WORKFLOWS

## 3.1 Definition and rules

A **workflow** is a durable, resumable composition of skills and tools with explicit gates, budgets, checkpoints and exit criteria. It is the unit of accountable work.

**Rules**

1. Every workflow declares stages, gates, budgets, checkpoints and failure semantics.
2. Every stage transition appends a ledger event. A stage that cannot log does not run.
3. Workflows MUST be resumable from the last checkpoint without repeating side effects.
4. Gates are human. A workflow MAY pause indefinitely at a gate; it MUST NOT auto-approve.
5. A workflow that exceeds budget pauses and emits `budget.adjusted`; it never silently continues.

## 3.2 Workflow schema

```yaml
id: WF-02
name: experiment
version: 1.0.0
trigger: "Charter approved at the Frame gate."
stages: [design, preregister, build, run, analyze, verify, risk, prove-gate]
gates: [prove]
budgets: { wall_clock: 6w, usd: 150, tokens: 5000000 }
checkpoints: [after:preregister, after:run, after:verify]
on_failure: pause | rollback | kill
outputs: [RN, EV, KN, DR]
```

## 3.3 Common controls

| Control | Behaviour |
|---|---|
| Checkpoint | Snapshot state + ledger head; resume is idempotent |
| Idempotency | Stage key = `(workflow, charter, stage, inputs_hash)`; replays are safe |
| Human gate | `human.request` blocks; timeout escalates, never approves |
| Budget | Reserve → execute → settle; overrun pauses |
| Failure | Retry with backoff (≤2), then fallback, then pause with incident |
| Cancellation | Append `run.finished(status=aborted)`, keep partial artifacts |
| Concurrency | One active run per charter; parallel runs only across charters |
| Audit | Every stage records skill/tool versions and model digests |

## 3.4 Workflows (v0.0.1)

### WF-01 · `inquiry` — Frame

**Trigger.** An observation, a gap, or a program need.
**Stages.** intake → observe → question → prior art → hypothesis → charter → **Frame gate**.
**Outputs.** `CH`, prior-art brief, `CL` with falsifiers, budget.
**Exit.** Principal approves a charter with scope, evidence bar, risk class and stop conditions.
**Failure.** If no falsifier or no decision is affected, kill at intake. A killed inquiry is recorded, not deleted.

### WF-02 · `experiment` — Prove

**Trigger.** Approved charter.
**Stages.** design → preregister → build slice → run → analyze → self-verify → risk assessment → **Prove gate**.
**Outputs.** `RN` manifests, `EV` at E2, draft `KN`, risk report.
**Exit.** Evidence meets the charter bar; ledger verifies; limitations written.
**Failure.** Inconclusive is a valid outcome and becomes a negative-result `KN`. Never relabel failure as success.

### WF-03 · `replicate` — E3

**Trigger.** An E2 evidence record is nominated for independent replication.
**Stages.** select sample → rebuild environment → rerun (new seed/operator/model family) → compare → record verdict → update claim.
**Outputs.** `EV` at E3, or a documented `not-replicated` finding.
**Exit.** Verdict recorded; claim transitions or stays; divergence explained.
**Failure.** Non-replication is published internally within one week. It is not suppressed.

### WF-04 · `distill` — Knowledge

**Trigger.** A supported claim, a method worth reusing, or a negative result.
**Stages.** select → summarize → provenance assembly → limitations → license/reuse → review → publish.
**Outputs.** `KN` with claims, runs, commits, model digests, limitations.
**Exit.** A stranger can use the artifact without private help.
**Failure.** Missing provenance blocks publication; the artifact stays internal.

### WF-05 · `transfer` — Transfer

**Trigger.** A `KN` at E3+ nominated for external use.
**Stages.** choose form → provenance audit → license/IP check → deployment risk review → package → **two-key gate** → release → post-transfer review.
**Outputs.** Standard, reference implementation, dataset, publication, or internal adoption.
**Exit.** Recipient reproduces or uses the package; obligations recorded.
**Failure.** Any unresolved license or risk issue halts; the package returns to `distill`.

### WF-06 · `review` — Weekly evidence review

**Trigger.** Weekly cadence (60–90 min).
**Stages.** queue triage → ledger verify → evidence sample audit → gate decisions → budget review → incident review → registry updates.
**Outputs.** Gate packets, `DR` records, updated registries.
**Exit.** Every open claim has a next action; no gate is stale >7 days.
**Failure.** Missing quorum postpones; it does not approve.

### WF-07 · `incident` — Correction

**Trigger.** Data-class breach, bad claim, tool failure, model regression, or unsafe output.
**Stages.** detect → contain → assess → correct (append) → notify → postmortem → patch skill/tool/model.
**Outputs.** `incident.opened`, `correction.appended`, postmortem `KN`.
**Exit.** Root cause identified; a test prevents recurrence; affected claims re-graded.
**Failure.** Silence is the only unacceptable outcome. History is never edited.

### WF-08 · `evolve` — Spec change

**Trigger.** Repeated friction, new evidence, or a quarterly review.
**Stages.** proposal → impact analysis → trial → decision record → version bump → migration → deprecation window.
**Outputs.** New spec version, migration note, updated evals.
**Exit.** Old version remains readable; affected runs pinned to their original versions.
**Failure.** Constitutional changes follow §XI and require explicit, written justification.

## 3.5 Cadence and queues

| Horizon | Work | Time box |
|---|---|---|
| Daily | One workflow stage; `ledger.verify`; budget check | 2–4 h |
| Weekly | `WF-06` evidence review; gate decisions; replication sample | 60–90 min |
| Monthly | Model eval refresh; skill/tool audit; dependency count; cost per claim | 3 h |
| Quarterly | Portfolio review; license audit; spec amendment window; constitution review | 1 day |

**Queues:** `inquiry` → `approved` → `running` → `awaiting-gate` → `done | killed`. Work-in-progress limit: **two active charters per program**. A third waits; it does not start quietly.

## 3.6 Definition of Done

A claim is done when:

- [ ] It has ≥E2 evidence, or is explicitly recorded as unresolved.
- [ ] Every supporting run has a complete manifest and verifies in the ledger.
- [ ] Limitations and uncertainties are stated.
- [ ] Contradicting evidence is recorded.
- [ ] The artifact has provenance, license, reuse level and a maintainer.
- [ ] A reviewer other than the producer has signed the gate packet (Transfer: two signers).
- [ ] The next action (replicate, transfer, or stop) is recorded.

## 3.7 Metrics

**Leading:** charters framed per month · % runs reproducible · replication attempts · negative results published · route correctness · injection tests passed · gate latency.

**Lagging:** claims at E3+ · artifacts reused outside their program · transfers completed · cost per supported claim · mean time from question to E2 · incidents per quarter (target: falling severity, not zero reports).

**Anti-metrics:** number of documents, lines of spec, models tried, tokens consumed, benchmarks topped. These are costs, not achievements.

## 3.8 v0.0.1 acceptance tests

The release is accepted when all of the following pass:

- [ ] `ledger.verify` passes on 100+ events, and detects a tampered byte at the correct sequence.
- [ ] Three sampled runs reproduce from manifest alone in a clean environment.
- [ ] The full inquiry → verify loop runs offline on commodity hardware at **zero marginal cost**, with no account, API key or paid tier.
- [ ] Every active model is OSI-licensed or explicitly probationary; no `requires_paid_service: true` entry can be routed.
- [ ] A class-2 prompt is refused by the remote route; the refusal is logged.
- [ ] A class-3 request never reaches a T2+ tier; no telemetry is emitted.
- [ ] Route decisions record model digest, tier and reason; a T1 outage falls back without policy drift.
- [ ] Web content containing an injected instruction cannot trigger `sandbox.exec`, `repo.git` or `secret.use`.
- [ ] A gate cannot be approved by an agent; Transfer requires two distinct human signers.
- [ ] An ACP-compatible FOSS agent can drive a workflow headlessly; removing it does not break the Coordinator.
- [ ] Budget exhaustion pauses the workflow and opens a decision record.
- [ ] Every registered skill and tool has at least one passing eval and a refusal test.
- [ ] One claim reaches E3; one negative result is published internally.
- [ ] Every `KN` has provenance, limitations, license and maintainer.
- [ ] Specs are versioned; deprecated items remain readable and pinned.

## 3.9 Extension procedure

To add a skill, tool or workflow: (1) write the schema-valid definition; (2) implement one happy path and one refusal path; (3) add an eval; (4) dry-run on a low-risk charter; (5) record a decision; (6) bump the version; (7) announce in the weekly review. To remove one: deprecate, migrate, keep readable, never delete. The ceiling for v0.0.1 is **13 skills, 20 tools, 8 workflows**. Growth beyond it requires evidence of need, not enthusiasm.

---

## Appendix — Registry layout

```
originlabs/
├── CONTEXT.md
├── SPECS.md
├── package.json                # zero runtime dependencies
├── bin/origin-ledger.mjs       # verify | append | head | anchor
├── src/
│   ├── ledger/                 # canonical.mjs · verify.mjs · append.mjs
│   └── registry/               # load.mjs
├── scripts/seed-registry.mjs   # regenerates registry/ deterministically
├── test/                       # node:test suites
├── .origin/
│   ├── manifest.json           # workspace, policy, defaultDataFlowClass
│   ├── events.jsonl            # append-only hash chain
│   └── checkpoints/            # resumable workflow state + anchors
├── registry/
│   ├── index.json              # generated manifest of all entries
│   ├── skills/    SK-*.json
│   ├── tools/     TL-*.json
│   ├── workflows/ WF-*.json
│   └── models/    MD-*.json
├── charters/     CH-*.yaml
├── claims/       CL-*.yaml
├── evidence/     EV-*.yaml
├── artifacts/    KN-*/
├── runs/         RN-*/
└── evals/        suites + results
```

**Tooling note (this workspace).** The environment contains candidate building blocks — `ai` (v7), `@opencode-ai/sdk`, `@cline/*`, `ollama-ai-provider-v2`, `@modelcontextprotocol/sdk`, `@workflow/serde`, Fastify/Hono, and Langfuse. Treat them as available, not mandatory: each must pass the dependency budget, the zero-cost test and the FOSS test before adoption. The scaffold itself uses **Node.js standard library only**, so the lab can verify its own ledger without `npm install`. The `.origin` manifest (`origin.workspace/v1`, `policy: local-authoritative`, `defaultDataFlowClass: 0`) is the canonical workspace identity and already matches the data-class default in §0.4.

**Pre-v1 ledger note.** The existing genesis event predates the v1 envelope (it has no `schema`, `actor` or `dataClass`). The verifier treats it as a **trust anchor**: it validates chain continuity but reports the hash as `legacy`/unverifiable unless it happens to match a known legacy form. Every event appended by `origin-ledger` uses the v1 envelope, is fully verifiable, and is never written over a broken chain.

---

*End of `SPECS.md` · OriginLabs v0.0.1 · Skills 13 · Tools 20 · Workflows 8*
