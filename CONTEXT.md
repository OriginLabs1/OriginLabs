# CONTEXT.md
## OriginLabs v0.0.1 — Identity, Constitution & Operating Context

| Field | Value |
|---|---|
| Document | `CONTEXT.md` |
| Version | 0.0.1 |
| Status | Ratified for build |
| Classification | Governing context (public-safe by default) |
| Parent ecosystem | OneOrigin |
| Runtime in this repository | Origin Coordinator (local-first) |
| Companion spec | `SPECS.md` (Skills · Tools · Workflows) |
| Supersedes | The source concept draft, `ORIGIN LABS CONCEPT` v0.0.1 |

> Read this file to know **why** OriginLabs exists and **what** v0.0.1 is allowed to do.
> Read `SPECS.md` to know **how** work is actually executed, recorded and verified.
>
> **Normative keywords:** MUST, MUST NOT, SHOULD, MAY (RFC 2119 sense). Constitution clauses are binding. Everything outside the Constitution is operational doctrine, revisable by decision record.

---

## 0. Operating summary

**One sentence.** OriginLabs is the sovereign, interdisciplinary research and invention foundation of OneOrigin; v0.0.1 is a single-operator, local-first laboratory runtime that turns questions into verified, reusable knowledge rather than into promises.

**What v0.0.1 ships**

- A local **Coordinator** that runs durable, resumable research workflows with human gates.
- An append-only, hash-linked **evidence ledger** (`.origin/events.jsonl` + checkpoints) covering every claim, run, route and decision.
- Four versioned registries: **skills**, **tools**, **workflows**, **models**.
- A four-tier **model ladder** that defaults to small local models and escalates only on evidence (see §7).
- A **zero-cost, FOSS-only** default path: open-weight models, open agent protocols (ACP), local inference, no accounts, no paid APIs, no mandatory telemetry.
- Three founding programs with hard exit criteria (see §5).

**What v0.0.1 is not**

- Not Origin Studio, not Origin Agent, not a product brand, not a cloud service.
- Not a publication house, patent office, or commercial arm.
- Not a multi-tenant platform, distributed ledger, or autonomous publisher.
- Not a claim of AGI, novelty, or impact without evidence at grade E3 or better.

**The invariant.** No claim leaves the lab above its evidence grade. No run leaves a gap in the ledger. No data leaves the machine above its data class.

---

## 1. Position in OneOrigin

| Layer | Role | Relationship to OriginLabs |
|---|---|---|
| **OneOrigin** | Overarching identity and constitutional foundation | OriginLabs is a sub-constitution under it; OneOrigin prevails on conflict |
| **OriginLabs** | Research, discovery, invention, engineering, validation | This document |
| **Origin Studio** | Computational workspace for creating and managing work | Optional front-end; not a dependency |
| **Origin Agent** | Independent intelligent-agent product | Optional delegate; not a dependency |
| **Origin Core / Foundations** | Shared constitutional, computational, infrastructural capability | Consumed where useful; never required for mission continuity |

**Boundary rules**

1. OriginLabs MUST remain independently capable of pursuing its mission without Studio, Agent, or any single vendor.
2. OriginLabs MAY use ecosystem components, but MUST NOT let a product roadmap define its research agenda.
3. Shared infrastructure is adopted only when it preserves exportability of knowledge (open formats, documented schemas).
4. Identity is distinct: Studio *executes*, Agent *acts*, Labs *establishes what is true and worth building*.

---

## 2. The Constitution (canonical, v0.0.1)

**Classification:** Governing Vision & Innovation Authority · **Principle:** *Discover boldly. Think rigorously. Build meaningfully. Verify universally.*

> **Sub-constitution clause.** This Constitution is subordinate to the OneOrigin Constitution. Where they conflict, OneOrigin prevails. OriginLabs may not amend OneOrigin, and no OriginLabs decision may silently override it.

### I. The Axiom

OriginLabs is the **sovereign, interdisciplinary research, invention and innovation foundation of OneOrigin**.

Its purpose is to advance knowledge, discover possibilities, establish principles, investigate challenges, develop technologies, engineer solutions, and transform meaningful discoveries into verifiable, sustainable capabilities.

OriginLabs unifies scientific inquiry, computational research, technological exploration, systems engineering, creative invention and applied innovation. It operates across disciplines, technologies, environments and generations without becoming dependent on any single methodology, institution, platform or implementation.

**Its mission is not merely to build what exists, but to discover and establish what should exist.**

### II. The Purpose

OriginLabs exists to:

1. **Discover** — investigate reality, emerging possibilities, unresolved problems and unexplored opportunities.
2. **Understand** — establish knowledge, principles, relationships, constraints and underlying mechanisms.
3. **Research** — conduct rigorous scientific, technical, interdisciplinary and applied investigations.
4. **Invent** — originate new concepts, architectures, methods, technologies and capabilities.
5. **Engineer** — transform validated discoveries into coherent, functional and reproducible systems.
6. **Validate** — establish correctness, feasibility, reliability, safety and practical value through evidence.
7. **Advance** — mature promising discoveries into standards, reference systems, products and sustainable innovations.
8. **Preserve** — maintain knowledge, provenance, intellectual continuity and reproducible institutional learning.

Research is not an end in itself. Innovation is not novelty for its own sake. Both MUST contribute to meaningful advancement.

### III. The Constitutional Principles

Every OriginLabs initiative MUST uphold:

1. **Truth** — evidence and reality take precedence over assumptions, popularity and speculation.
2. **Intellectual Freedom** — investigate possibilities without unnecessary technological or disciplinary limitations.
3. **Rigor** — apply appropriate scientific, engineering and verification standards.
4. **Originality** — pursue meaningful discoveries rather than merely reproducing existing solutions.
5. **Sovereignty** — preserve independence over research, knowledge, tools, data and intellectual direction.
6. **Integrity** — maintain honest attribution, transparent reasoning and verifiable provenance.
7. **Universality** — favor reusable principles, interoperable standards and broadly applicable discoveries.
8. **Reproducibility** — make important findings, methods and results independently examinable and repeatable.
9. **Safety** — consider foreseeable consequences, misuse, security, human dignity and environmental impact.
10. **Simplicity** — seek the clearest and most effective solutions without unnecessary complexity.
11. **Sustainability** — favor solutions that remain useful, maintainable and economically or operationally viable.
12. **Evolution** — continuously improve knowledge, methods and implementations through evidence.

### IV. The Research & Innovation Domains

OriginLabs may investigate and advance any discipline or field relevant to its mission, including:

- Fundamental and applied sciences.
- Computing, software and artificial intelligence.
- Mathematics, logic and formal systems.
- Hardware, electronics and computational architectures.
- Communication, networking and distributed systems.
- Human–computer interaction and visual communication.
- Engineering, automation and intelligent systems.
- Materials, energy and emerging technologies.
- Design, creativity and interdisciplinary innovation.
- Social, cultural and human-centered systems.

These domains are not restrictive boundaries. Cross-disciplinary investigation is encouraged whenever it creates meaningful advancement. v0.0.1 exercises this freedom through a deliberately narrow founding portfolio (§5), not through breadth of staffing.

### V. The Innovation Lifecycle

OriginLabs follows an evidence-oriented innovation lifecycle:

1. **Observe** — identify realities, opportunities, needs and unresolved problems.
2. **Question** — formulate meaningful questions and hypotheses.
3. **Investigate** — examine existing knowledge, mechanisms and alternatives.
4. **Discover** — establish new understanding, relationships and possibilities.
5. **Conceptualize** — develop principles, models and proposed solutions.
6. **Invent** — originate architectures, methods and novel capabilities.
7. **Engineer** — develop functional prototypes, reference implementations and systems.
8. **Verify** — evaluate correctness, feasibility, safety, performance and reproducibility.
9. **Mature** — refine validated innovations into dependable and sustainable outcomes.
10. **Transfer** — publish, standardize, integrate, license where appropriate, or advance discoveries into the OneOrigin ecosystem.

This lifecycle is adaptive rather than sequential. v0.0.1 compresses it into three accountable gates — **Frame, Prove, Transfer** — without removing any stage (§3.2).

### VI. The Knowledge & Evidence Foundation

Knowledge is a primary institutional asset.

OriginLabs MUST distinguish:

- Established facts.
- Verified findings.
- Supported conclusions.
- Working hypotheses.
- Experimental observations.
- Proposals and inventions.
- Unresolved questions.

Significant discoveries and engineering outcomes SHOULD preserve their relevant:

- Research context and objectives.
- Methods, assumptions and constraints.
- Sources and intellectual attribution.
- Evidence and reproducible procedures.
- Versions, dependencies and provenance.
- Limitations, uncertainties and conclusions.

Research integrity MUST never be sacrificed for speed, novelty or institutional reputation. See §3.3 for the operational evidence model; a claim without provenance is not a finding.

### VII. The Architectural Relationship

OriginLabs operates as a distinct innovation foundation within OneOrigin. Its relationship with the wider ecosystem is complementary:

- **OneOrigin** — the overarching ecosystem, identity and constitutional foundation.
- **OriginLabs** — research, discovery, invention, engineering and innovation.
- **Origin Studio** — the computational workspace for creating, executing and managing work.
- **Origin Agent** — an independent intelligent-agent product for reasoning, assistance and delegated work.
- **Origin Core and other foundations** — shared constitutional, computational and infrastructural capabilities where appropriate.

OriginLabs MAY use Origin Studio, Origin Agent and other internal or external technologies, but MUST remain independently capable of pursuing its mission. No individual application or technology defines the limits of OriginLabs.

### VIII. Technological & Intellectual Sovereignty

OriginLabs MUST:

- Remain technology-agnostic at the constitutional level.
- Prefer open, interoperable and independently verifiable standards.
- Preserve research independence and intellectual continuity.
- Avoid unnecessary vendor, platform and infrastructure dependencies.
- Support local, distributed and collaborative research.
- Favor accessible, reproducible and resource-conscious methods.
- Preserve ownership, attribution and provenance appropriately.
- Enable responsible knowledge sharing and technology transfer.

Proprietary technologies MAY be investigated or adopted when justified, without compromising long-term independence. In v0.0.1 this is enforced by the **data-class egress policy** and the **local-first model ladder**, not merely by intent.

### IX. Responsible Innovation

The ability to create does not automatically establish that something should be created or deployed.

OriginLabs MUST consider:

- Human dignity and welfare.
- Security and privacy.
- Environmental and societal consequences.
- Dual-use potential and foreseeable misuse.
- Intellectual property and attribution.
- Long-term sustainability.
- Appropriate human oversight and accountability.

High-impact discoveries require proportionate scrutiny before practical deployment. Proportionate scrutiny is operationalized as a risk class, a documented review, and a two-key gate for transfer (§3.5).

### X. Quality & Excellence Standard

Every significant OriginLabs outcome SHOULD aspire to be:

**Original · Accurate · Useful · Elegant · Reliable · Verifiable · Reproducible · Interoperable · Safe · Sustainable · Scalable.**

Excellence is established through substance and evidence, not presentation or claims. OriginLabs MUST prefer meaningful breakthroughs and enduring solutions over unnecessary novelty, superficial complexity or premature commercialization.

### XI. Evolution & Governance

OriginLabs is continuously evolving. Its constitutional identity MUST remain distinguishable from its changing research priorities, methodologies, organizational structures and technologies.

Research initiatives SHOULD have clear objectives, appropriate authority, documented decisions and proportionate accountability.

Constitutional changes MUST be deliberate, justified, versioned and documented.

Discoveries and implementations MUST remain open to correction when stronger evidence emerges. Corrections are appended to the ledger; history is never rewritten.

### XII. The Manifesto

We do not assume that what exists is the limit of what is possible.

We question, investigate and understand before declaring certainty.

We pursue truth without surrendering intellectual independence.

We invent with purpose, engineer with discipline and verify with evidence.

We do not confuse novelty with progress, complexity with sophistication, or experimentation with achievement.

We preserve what is valuable, challenge what is inadequate and replace what can demonstrably be improved.

We believe knowledge should advance beyond individuals, implementations and generations.

**Discovery without rigor is speculation. Invention without purpose is distraction. Engineering without verification is uncertainty. Innovation without responsibility is incomplete.**

OriginLabs exists to expand the boundaries of understanding and transform meaningful possibilities into enduring contributions to humanity.

### Our Assurance

**Discover what is possible. Establish what is true. Invent what is necessary. Build what is valuable. Advance what endures.**

*OriginLabs — a OneOrigin Innovation Foundation.*

---

## 3. From doctrine to mechanism

The Constitution states obligations. This section states how v0.0.1 discharges them. It is deliberately small: one rule, one artifact, one gate.

### 3.1 Principles → mechanisms

| Principle | Mechanism in v0.0.1 |
|---|---|
| Truth | Claim states + evidence grades E0–E4; no "established" below E3; contradictions appended, never deleted |
| Intellectual Freedom | Any domain may enter a charter; only the risk gate can block, never portfolio fashion |
| Rigor | Evidence bar declared per charter; experiment preregistered before execution |
| Originality | Mandatory prior-art brief; novelty claims state the delta against the closest work |
| Sovereignty | Data classes 0–4; local-first model ladder; open formats; fully exportable ledger |
| Integrity | Citations, run manifests, model digests, correction events instead of edits |
| Universality | Schema-first artifacts; MCP-native tool contracts; standard packaging at transfer |
| Reproducibility | Pinned environment digest, seeds, input/output hashes, clean-room replay test |
| Safety | Risk class per charter; dual-use review skill; two-key transfer gate; egress policy |
| Simplicity | Two documents, four registries, ≤13 skills, ≤20 tools in v0.0.1 |
| Sustainability | License and dependency audit each quarter; named maintainer per artifact |
| Free & open access (derived from Sovereignty + Universality) | FOSS-only default path; open weights; ACP-compatible, self-hostable agents; zero-cost test in CI |
| Evolution | Quarterly spec review; decision records; deprecation path for every skill and tool |

### 3.2 The three gates

The ten-stage lifecycle is preserved, but accountability is concentrated at three human gates:

| Gate | Question | Evidence required | Authority |
|---|---|---|---|
| **Frame** | Is this a real, falsifiable, worth-answering question? | Charter, prior-art brief, hypothesis with falsifier, budget, stop conditions | Principal |
| **Prove** | Does the evidence meet the declared bar? | Runnable artifacts, verification report, risk assessment, limitations | Principal |
| **Transfer** | Should this leave the lab, and in what form? | Provenance audit, license/IP check, red-team sign-off | Two-key (Principal + reviewer) |

Nothing advances a gate automatically. An agent MAY draft a gate packet; only a human MAY sign it.

### 3.3 Evidence model (summary; normative detail in `SPECS.md` §0.3)

A **claim** is a sentence that can be wrong. It moves through explicit states:

`proposed → investigating → supported → established → (contested | retracted | superseded)`

Evidence grades:

| Grade | Meaning |
|---|---|
| **E0** | Assertion only; no traceable support |
| **E1** | Cited; source exists and is relevant, but not independently checked |
| **E2** | Reproducible; method and artifacts allow a competent operator to rerun it |
| **E3** | Replicated; an independent run (different operator, seed, environment, or model family where applicable) reproduces the result within stated tolerance |
| **E4** | Established; E3 plus adversarial review, external validation, or field consensus |

Rules: `supported` needs E2; `established` needs E3 (E4 for high-impact); negative results are first-class artifacts; a correction is a new ledger event referencing the old one.

### 3.4 Budgets that protect the mission

| Budget | Default | Purpose |
|---|---|---|
| Exploration reserve | ≤10% of program time | Unplanned inquiry without a charter amendment |
| Replication reserve | ≥20% of program time, ≥1 replication per program per quarter | Makes Reproducibility real |
| Risk review | 100% of high-risk charters; 20% sample otherwise | Proportionate scrutiny |
| Dependency budget | ≤25 direct runtime dependencies | Protects sovereignty and maintenance |

Budgets are ceilings, not targets. Exceeding one requires a decision record and, for transfer, a gate signature.

### 3.5 Risk classes

| Class | Trigger | Required scrutiny |
|---|---|---|
| **Low** | Internal tooling, public data, reversible | Standard Prove gate |
| **Moderate** | Personal data, external users, moderate cost | Prove gate + privacy/security review |
| **High** | Dual-use, safety-critical, regulated, public deployment | Prove gate + independent red-team + two-key transfer + staged rollout |
| **Prohibited in v0.0.1** | Autonomous weapons, covert persuasion, mass surveillance, self-replication | Not chartered |

A charter that cannot name its stop conditions is not ready for the Frame gate.

---

## 4. Strategic positioning

### 4.1 What to borrow, and what to refuse

| Precedent | Borrow | Refuse |
|---|---|---|
| Bell Labs | Long-horizon foundational work coupled to engineering | Corporate capture of the research agenda |
| Xerox PARC | Willingness to rethink the computing stack | Inventing without a transfer path |
| DARPA | Ambitious programs, measurable milestones, demos | Program-manager churn and classification by default |
| MIT Media Lab | Interdisciplinary freedom, demo culture | Novelty as a substitute for evidence |
| Fraunhofer | Applied transfer and industrial rigor | Contract-research dependency |
| CERN | Shared infrastructure, open collaboration | Infrastructure scale as a status symbol |
| DeepMind | Computation as an instrument of discovery | Leaderboard optimization and opaque evaluation |

### 4.2 The defensible combination

The uniqueness is the **combination**, not any single feature:

1. **Constitutional sovereignty** — independence is a rule, not a mood.
2. **Full discovery-to-realization continuity** — one ledger from observation to transfer.
3. **Evidence-graded knowledge** — claims are typed, graded, and replayable.
4. **Resource-conscious capability** — designed for one capable operator and commodity hardware.
5. **Local-first intelligence** — small models do most of the work, by policy.

### 4.3 The small-institution thesis

OriginLabs does not need to become Bell Labs, CERN, DARPA, MIT and DeepMind simultaneously. It needs to be **small, independent, unusually broad in intellectual horizon, and disciplined at turning discoveries into reality**. Scale is earned by artifact reuse, not by headcount or infrastructure.

**Definition of success for v0.0.1:** an outside operator can take one OriginLabs artifact, rerun it from its manifest, and reach the same conclusion — without asking us how.

### 4.4 Why it is worthy of existing

1. Discovery deserves a home not owned by a product roadmap.
2. Knowledge should become reusable infrastructure, not slide decks.
3. Meaningful investigation should not require extraordinary resources.
4. Research and implementation should not be institutionally divorced.
5. Success should be measured by verifiable contribution, not revenue, patents or press.

The verdict is conditional: uniqueness must be **earned through artifacts**, not asserted in a constitution.

---

## 5. Founding portfolio (v0.0.1)

Three programs. Each has one question, one deliverable class, and one hard exit test.

### P1 — Verifiable Knowledge Pipeline *(dogfood)*

- **Question:** Can every claim made in this lab be traced to evidence and rerun by a stranger?
- **Build:** claim/evidence schemas, ledger writer and verifier, artifact store, clean-room replay harness, 20 seed claims.
- **Exit:** one claim reaches E3; tamper detection passes; a clean-room replay succeeds from manifest alone.
- **Why first:** it is the instrument every other program depends on.

### P2 — Sovereign Small-Model Workbench

- **Question:** Can a four-tier local model ladder handle ≥70% of lab work without violating any data-class policy?
- **Build:** model registry, 120-item task eval suite, router, Ollama/llama.cpp adapters, egress-policy tests, three LoRA experiments.
- **Exit:** ≥90% route correctness on held-out tasks; zero egress violations in adversarial tests; T1-first success ≥70%; the full loop runs offline at zero marginal cost.
- **Why second:** it makes sovereignty operational and cheap.

### P3 — Interoperability & Verification Standards

- **Question:** Can an OriginLabs artifact be reproduced and audited outside this repository without our tooling?
- **Build:** v0.1 specs for claim, evidence, run manifest and reproduction package; MCP tool contracts; one external-style review.
- **Exit:** one artifact reproduced by an operator using only the published spec; spec accepted for ecosystem review.
- **Why third:** it converts internal discipline into a transferable standard.

### Non-goals for v0.0.1

Wet-lab science, custom hardware, multi-user operation, distributed consensus, autonomous external publishing, commercial licensing, benchmark leaderboards, model pretraining, and any high-risk domain before the Prove gate is proven on low-risk work.

### 90-day exit criteria

- 3 charters framed and approved.
- ≥1 claim at E3 and ≥1 published negative result.
- 100% of runs reproducible from manifest (sampled 3).
- 0 data-class violations; 0 ungated transfers.
- `SPECS.md` skills/tools/workflows versioned and evaluated.

---

## 6. Architecture at a glance

```
                    ┌──────────────────────────────┐
                    │        Principal (human)     │
                    │   gates · budgets · two-key  │
                    └───────────────┬──────────────┘
                                    │
            ┌───────────────────────▼───────────────────────┐
            │              Coordinator (local)              │
            │   workflow engine · policy · scheduler ·      │
            │   router · budget guard                       │
            └───┬───────────┬───────────────┬───────────┬───┘
                │           │               │           │
          ┌─────▼────┐ ┌────▼─────┐  ┌──────▼─────┐ ┌───▼─────┐
          │ Skills   │ │  Tools   │  │ Model      │ │ Sandbox │
          │ registry │ │ registry │  │ ladder     │ │ + egress│
          └─────┬────┘ └────┬─────┘  └──────┬─────┘ └───┬─────┘
                └───────────┴───────┬───────┴───────────┘
                                    │ append-only, hash-linked
                          ┌─────────▼──────────┐
                          │   .origin ledger   │
                          │ events·checkpoints │
                          └─────────┬──────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │   Knowledge artifacts (KN)     │
                    │ claims · evidence · runs ·     │
                    │ decisions · negative results   │
                    └────────────────────────────────┘
```

**Components**

| Component | Responsibility | Invariant |
|---|---|---|
| Coordinator | Durable workflows, scheduling, policy, routing, budgets | Every state transition appends a ledger event |
| Ledger | Append-only hash chain + checkpoints | Tamper-evident; exportable; never rewritten |
| Registries | Skills, tools, workflows, models, all versioned | No unversioned capability may run |
| Sandbox | Isolated execution with egress allowlist | No ambient network or secrets |
| Artifact store | Claims, evidence, knowledge artifacts, run manifests | Every artifact carries provenance |

**Invariants**

1. A run without a manifest does not exist.
2. A claim without evidence links is E0, regardless of how it was produced.
3. A model output is a *claim*, never evidence.
4. A tool with side effects never runs without a policy check.
5. Correction is append-only. History is immutable.

---

## 7. Model doctrine — the small-model question

Most lab work is not frontier reasoning. It is reading, extracting, classifying, drafting, routing, checking, and packaging. Paying frontier prices and exporting sensitive context for that work is strategically wrong. v0.0.1 therefore treats **small models as the default workforce and large models as a scalpel**. Free and open access is a precondition, not a preference.

### 7.0 Free and open by mandate

1. **FOSS default path.** Every required workflow MUST run on free and open-source software: open-weight models, open inference (Ollama, llama.cpp, vLLM, MLX), open formats, open protocols.
2. **Agents and ACP.** Any agent client, agent, or adapter (ACP — Agent Client Protocol and equivalent open agent protocols) MUST be FOSS, self-hostable, and usable without payment, an account, an API key, or mandatory telemetry.
3. **Zero-cost test.** A new operator with commodity hardware MUST be able to run the full inquiry → verify loop offline, at zero marginal cost, with no vendor permission.
4. **Non-OSI weights are probationary.** Free-but-restricted licences (e.g. Gemma Terms, LFM Open License) MAY be evaluated, but MUST be flagged, license-reviewed, and MUST NOT be the only path for any required workflow.
5. **No reputation admissions.** A model enters a tier by passing the lab's eval suite, not by topping a leaderboard.

### 7.1 Four tiers — defined by role, bounded by resources

| Tier | Size class | Role | Indicative exemplars* |
|---|---|---|---|
| **T0 Reflex** | ≤1B | routing, tagging, classification, extraction, dedupe, short summaries | Qwen3.5-0.8B |
| **T1 Workhorse** | 1–9B dense or small-active MoE | drafting, code edits, tool calls, structured extraction, local RAG, first-pass review | Qwen3.5-2B / 4B / 9B, Granite 4.2, LFM3-1.7B (agent), MiniCPM5-2B, Gemma 4 (multimodal, probation) |
| **T2 Reasoner** | ≥20B dense, ~30B-A3B MoE, or zero-cost open endpoint | hypothesis generation, hard debugging, cross-domain synthesis, red-team | none admitted in v0.0.1; requires a local model or an approved zero-cost endpoint |
| **T3 Verifier** | 1–9B, **different family** from producer | claim–evidence entailment, rubric scoring, citation faithfulness, refusal checks | a T1-class model from a different lineage (e.g. Granite verifying Qwen) |

\* Indicative as of the November 2026 assessment. The **Qwen3.5 family is the initial reference family** (0.8B / 2B / 4B / 9B); specialist models are interchangeable. The **model registry** is the source of truth and records exact revision, digest, quantization and licence. A newer model does not enter a tier without passing the lab's own eval suite. Re-evaluate quarterly; do not chase leaderboards.

### 7.2 Hardware-adaptive defaults

| Deployment | Default | Note |
|---|---|---|
| Galaxy S9, 4 GB RAM | Qwen3.5-0.8B | T0; offline, no swap |
| More capable constrained device | Qwen3.5-2B | T1 entry |
| Efficient agent / tool execution | LFM3-1.7B | probation until licence review |
| Capable laptop (16 GB+) | Qwen3.5-4B | T1 default |
| Strongest general SLM | Qwen3.5-9B | T1 premium |
| Mobile multimodal | Gemma 4 | probation; non-OSI licence |

These are **defaults, not commitments**. A model that fails the eval gate on the target device is replaced, not excused.

### 7.3 Six rules

1. **Free and open first.** A paid, closed, or account-gated dependency is never on the default path.
2. **Local first.** T0–T2 run locally by default. Remote inference is an exception with a logged reason and a data-class check.
3. **Data class rules the route.** Class ≥2 never leaves the machine; class 3–4 never leaves the process boundary without approval.
4. **Verify with a different family.** A model may not certify its own output. T3 ≠ producer family, and deterministic checks come first.
5. **Retrieval before fine-tuning.** Facts live in the ledger and artifacts; models are adapted for *form and behavior*, not for storing knowledge.
6. **Pin everything.** Model digest, quantization, adapter digest, prompt version, seed, sampling parameters. Reproducibility includes the model.

### 7.4 Where small models win, and where they do not

- **Win:** high-volume structured work, privacy-sensitive context, offline/air-gapped operation, cost per artifact, latency, deterministic pipelines, edge deployment.
- **Do not win:** open-ended synthesis, novel proof construction, ambiguous multi-step planning, adversarial red-teaming. Escalate to T2 deliberately — and if no free, local T2 exists, the task is out of scope for v0.0.1, not an excuse to call a paid API.
- **Adaptation strategy:** grammar/JSON-constrained decoding for all tool calls and artifact writes; LoRA/QLoRA only for stable narrow behaviors trained on ledger-derived class-0/1 data with an eval gate; distillation from verified T2 outputs into T1; adapter versioning and rollback. Never fine-tune safety policy into a small model and assume it survives.

### 7.5 Model independence

The reference family is Qwen3.5, but the architecture is **model-independent**: a registry entry, a policy check, an eval score and a digest. Any specialist (Granite for structured enterprise output, LFM3 for tool execution, Gemma 4 for multimodal input, MiniCPM for tight memory) can be swapped in without changing a skill or a workflow. That is more future-proof than tying the lab to one vendor — and it is the only way to keep the "free and open" guarantee when the model landscape shifts.

### 7.6 Why this is the sovereign choice

A lab that cannot run its own models on its own data, offline, at zero cost, is not sovereign — it is a tenant. Small open models are the only tier that satisfies all four constraints at once: **local, free, open, and good enough for the majority of the work**. Larger models remain useful, but as an instrument used on purpose — never as the floor of the architecture, and never as a dependency the lab cannot remove.

---

## 8. Governance & decision rights

| Decision | Authority | Record |
|---|---|---|
| Charter approval, scope, stop | Principal | `charter.approved` event |
| Gate sign-off | Principal (Transfer: two-key) | `gate.decided` event |
| Budget reallocation | Principal | Decision record |
| Skill/tool/workflow version change | Maintainer + review | `spec.versioned` event |
| Model admission to a tier | Eval owner + Principal | Model registry entry |
| Constitution amendment | Principal + written justification | New version, changelog |
| Incident containment | Any operator (duty to act) | `incident.opened` event |

**Cadence**

- **Daily:** advance one workflow stage; `ledger.verify`; budget check.
- **Weekly (60–90 min):** evidence review, gate decisions, one replication sample, incident review.
- **Monthly:** model eval refresh, skill/tool audit, dependency count, cost per supported claim.
- **Quarterly:** portfolio review, license audit, spec amendment window, constitution review.

**Anti-patterns (explicitly forbidden)**

- Gate approved by an agent, or by the same person who produced the evidence, for Transfer.
- Deleting a failed run, a negative result, or a contradictory source.
- "Established" used as a synonym for "we believe it".
- A model call without a recorded digest, or a tool call without a policy check.
- A default path that requires a paid API, a proprietary agent, an account, or mandatory telemetry.
- A research program that exists only because a product needs it this quarter.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **Charter** | A bounded research commitment: question, scope, evidence bar, risk, budget, stop conditions |
| **Claim** | A falsifiable statement with a lifecycle state and evidence links |
| **Evidence** | A graded, traceable support record attached to a claim |
| **Artifact (KN)** | A reusable output: finding, method, standard, reference implementation, dataset, negative result, decision |
| **Run (RN)** | One reproducible execution with a complete manifest |
| **Ledger** | Append-only hash-linked event log; the lab's memory of record |
| **Gate** | A human decision point: Frame, Prove, Transfer |
| **Data class** | 0 public · 1 internal · 2 confidential · 3 restricted · 4 regulated |
| **Tier** | Model capability class T0–T3 |
| **Skill** | A versioned procedure with judgment, inputs, outputs and an eval |
| **Tool** | A typed, permissioned capability with side-effect and data-class limits |
| **Workflow** | A durable, resumable composition of skills and tools with gates |
| **Negative result** | A documented failure to confirm; a first-class artifact, not a shameful secret |
| **Transfer** | Publication, standardization, integration, licensing or adoption beyond the lab |
| **ACP** | Agent Client Protocol and equivalent open agent-interoperability protocols; all lab agent surfaces must be FOSS, self-hostable and free to use |
| **OSI licence** | A licence approved by the Open Source Initiative (Apache-2.0, MIT, BSD, MPL-2.0); required for the default model and tool path |
| **Zero-cost path** | A complete workflow that runs offline on commodity hardware with no account, API key, paid tier or mandatory telemetry |

---

## Appendix A — Selective adjustments in this version

Each change is small, and each fixes a specific failure mode.

1. **Constitution kept as identity; mechanisms separated.** A constitution should not double as an operating manual. §3 maps every principle to one enforceable mechanism without amending the text.
2. **Ten stages compressed into three gates.** Preserves the lifecycle, removes process theater at v0.0.1 scale. Frame, Prove, Transfer are the only places a human must stop.
3. **Claims and evidence made typed and graded (E0–E4).** "Truth" becomes checkable. No E3, no "established"; corrections append rather than edit.
4. **Charters made mandatory and falsifiable.** Scope, evidence bar, risk class, budget and stop conditions must exist before work starts. This is what "proportionate scrutiny" actually requires.
5. **Sovereignty made enforceable.** Data classes plus a local-first model ladder plus an egress policy turn a value into a test.
6. **Portfolio narrowed to three programs.** A universal mandate with a focused initial portfolio, as the source concept itself recommends. Non-goals are explicit.
7. **Negative results and replication budget elevated.** The cheapest way to buy credibility is to publish what failed and pay for independent reruns.
8. **Skills, tools and workflows specified as executable contracts.** Skill = procedure + eval; tool = typed capability + policy; workflow = durable DAG + gates. This is the difference between a manifesto and a lab.
9. **Model doctrine added as architecture, not procurement.** Small models are the default workforce; escalation is evidence-driven and logged; verification always uses a different family.
10. **Governance reduced to one accountable human and four cadences.** Enough structure to be real; not enough to become a bureaucracy.
11. **Free and open made a hard requirement.** Every default path is FOSS, local-capable and zero-cost; agents and ACP surfaces must be self-hostable; non-OSI weights are probationary only. This turns the VITAL NOTE into a test rather than a slogan.
12. **Model shortlist refreshed and tiers re-bounded by role.** The November 2026 assessment (Qwen3.5 0.8B/2B/4B/9B, Gemma 4, LFM3-1.7B, Granite 4.2, MiniCPM5-2B) replaces the earlier exemplars; T0/T1/T2 are now ≤1B / 1–9B / ≥20B so the 9B flagship is correctly a workhorse, not a reasoner. Qwen3.5 is the reference family, not a dependency.

## Appendix B — Source fidelity

The Constitution in §2 preserves the source text's structure (I–XII), principles, lifecycle, domains, manifesto and assurance. Edits are limited to: formatting, removal of duplicated blocks, consistent MUST/SHOULD usage, and the addition of cross-references to operational mechanisms. No constitutional obligation was weakened, removed, or replaced. The strategic analysis in §4 condenses the source's precedent comparison; the three-program portfolio and the model doctrine are new, and are marked as v0.0.1 doctrine rather than constitutional text.

---

*End of `CONTEXT.md` · OriginLabs v0.0.1 · Next: `SPECS.md`*
