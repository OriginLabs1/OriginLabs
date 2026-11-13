#!/usr/bin/env node
// Deterministically generate the OriginLabs registry from this single source.
//   node scripts/seed-registry.mjs          # write files
//   node scripts/seed-registry.mjs --check  # fail if registry is stale

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "registry");
const CHECK = process.argv.includes("--check");

const skills = [
  ["SK-01", "frame.question", "Turn an observation into one falsifiable question worth a charter.", "An observation, gap or program need.", ["observation"], ["charter_draft"], ["TL-15"], "none", ["one question per charter", "name the decision the answer would change"], "reviewer can state the falsifier unaided (4/5)"],
  ["SK-02", "survey.prior-art", "Establish what is known, by whom, and what remains genuinely open.", "A framed question.", ["question", "scope"], ["prior_art_brief", "source_matrix"], ["TL-04", "TL-13", "TL-14"], "E1 per source", ["vendor claims are not evidence", "log the query set"], "a second searcher reproduces 80% of sources"],
  ["SK-03", "form.hypothesis", "Convert a question into claims that can lose.", "A question and prior-art brief.", ["question", "prior_art"], ["claims", "falsifiers"], ["TL-15"], "E0", ["no unfalsifiable claims", "name the metric behind better"], "an independent reviewer can design the test (4/5)"],
  ["SK-04", "design.experiment", "Produce a protocol a stranger could run without asking questions.", "Approved charter.", ["charter"], ["preregistered_protocol", "analysis_plan"], ["TL-01", "TL-15"], "E2-ready", ["no metric changes after seeing data", "define failure in advance"], "clean-room operator executes the dry run without clarification"],
  ["SK-05", "build.slice", "Build the thinnest vertical slice that can produce evidence.", "A preregistered protocol.", ["protocol"], ["prototype", "run_manifest"], ["TL-06", "TL-07", "TL-17"], "runs from clean checkout", ["no scope creep", "no unregistered dependencies"], "fresh environment reproduces primary output in 30 minutes"],
  ["SK-06", "verify.replicate", "Independently rerun a claim and report agreement or divergence.", "An E2 evidence record.", ["claim", "evidence", "tolerance"], ["replication_evidence", "verdict"], ["TL-02", "TL-06", "TL-09", "TL-17"], "E3", ["operator differs from original", "model family differs when model-dependent", "environment rebuilt from manifest"], "seeded divergence detected 5/5; true replication accepted 5/5"],
  ["SK-07", "assess.risk", "Decide whether work proceeds and under what constraints.", "A charter or transfer candidate.", ["charter", "context"], ["risk_assessment", "recommendation"], ["TL-15"], "documented reasoning", ["it is just research is not a mitigation", "high risk needs an independent reviewer"], "blind reviewer reaches the same risk class (4/5)"],
  ["SK-08", "challenge.claim", "Attack a claim before the world does.", "A supported claim.", ["claim", "evidence"], ["challenge_report", "verdict"], ["TL-04", "TL-09"], "specific evidence or specific gap", ["no strawmen", "no rhetorical skepticism without a test"], "seeded flaws flagged 4/5; sound claims survive 4/5"],
  ["SK-09", "distill.artifact", "Convert work into something another person can use without us.", "A supported claim or negative result.", ["claims", "runs"], ["knowledge_artifact"], ["TL-03", "TL-04"], "matches claim grade", ["no artifact without limitations", "no artifact without provenance"], "outsider reproduces the headline result from the artifact"],
  ["SK-10", "package.transfer", "Move a validated result out of the lab responsibly.", "A knowledge artifact at E3+.", ["artifact", "license"], ["transfer_package"], ["TL-03", "TL-05", "TL-16"], "E3 (E4 for high risk)", ["named owner required", "no license ambiguity"], "recipient uses the package without private assistance"],
  ["SK-11", "route.model", "Pick the cheapest adequate free model without violating policy.", "A task and a data class.", ["task", "data_class", "budget"], ["route_decision"], ["TL-10"], "route logged with digest", ["no route above data-class ceiling", "no same-family verification", "no paid fallback"], "route correctness 90%; zero policy violations"],
  ["SK-12", "record.decision", "Make a choice reviewable six months later.", "A decision point.", ["context", "options"], ["decision_record"], ["TL-01"], "linked evidence where claimed", ["no retroactive justification", "no irreversible choice without a named risk"], "reader reconstructs the decision (4/5)"],
  ["SK-13", "review.gate", "Assemble and defend a gate packet, or reject it.", "A gate request.", ["charter", "claims", "runs"], ["gate_packet", "recommendation"], ["TL-02", "TL-04", "TL-16"], "every claim above E1 linked", ["producer is not sole Transfer reviewer", "agents cannot sign"], "seeded inflated grades rejected 5/5"],
].map(([id, name, intent, trigger, inputs, outputs, tools, evidenceBar, guards, evalPass]) => ({
  id,
  kind: "skill",
  name,
  version: "1.0.0",
  status: "active",
  intent,
  trigger,
  inputs,
  outputs,
  tools,
  evidence_bar: evidenceBar,
  guards,
  evals: [{ id: `EVAL-${id.replace("-", "")}-01`, pass: evalPass }],
  owner: "principal",
  spec_ref: `SPECS.md §1.4 (${id})`,
}));

const tools = [
  ["TL-01", "ledger.append", "local", "local-write", true, 4, "none", "halt", "Append one v1 event to the hash chain."],
  ["TL-02", "ledger.verify", "local", "none", true, 4, "none", "halt", "Recompute and validate the chain."],
  ["TL-03", "artifact.write", "local", "local-write", true, 4, "none", "halt", "Write a claim, evidence, run or knowledge artifact."],
  ["TL-04", "artifact.query", "local", "none", true, 4, "none", "halt", "Query artifacts and claims by ID or tag."],
  ["TL-05", "citation.resolve", "mcp", "network", false, 1, "none", "retry", "Resolve a DOI or URL to a stable record."],
  ["TL-06", "sandbox.exec", "local", "local-write", false, 4, "none", "halt", "Run code in an isolated, egress-limited sandbox."],
  ["TL-07", "repo.git", "local", "local-write", false, 2, "none", "halt", "Version-control operations in the workspace."],
  ["TL-08", "bench.run", "local", "local-write", false, 2, "none", "halt", "Execute eval suites and record results."],
  ["TL-09", "model.infer", "local", "none", true, 4, "none", "retry", "Single inference on a registered local model."],
  ["TL-10", "model.route", "local", "none", true, 4, "none", "halt", "Select a free, eligible model for a task."],
  ["TL-11", "model.eval", "local", "local-write", false, 2, "none", "halt", "Run the capability eval suite."],
  ["TL-12", "model.embed", "local", "none", true, 4, "none", "retry", "Embeddings for retrieval over the ledger."],
  ["TL-13", "web.fetch", "mcp", "network", false, 0, "none", "retry", "Fetch a public URL into a quarantined channel."],
  ["TL-14", "web.search", "mcp", "network", false, 0, "none", "retry", "Search public sources, returning citations."],
  ["TL-15", "human.request", "local", "none", true, 4, "none", "halt", "Block a workflow pending human input."],
  ["TL-16", "review.gate", "local", "local-write", false, 4, "two-key", "halt", "Record a human gate decision."],
  ["TL-17", "checkpoint.create", "local", "local-write", true, 4, "none", "halt", "Snapshot workflow state for resume."],
  ["TL-18", "secret.use", "local", "none", true, 4, "principal", "halt", "Brokered, scoped, logged secret access."],
  ["TL-19", "workspace.init", "local", "local-write", true, 0, "none", "halt", "Provision the .origin workspace and policy."],
  ["TL-20", "budget.check", "local", "none", true, 4, "none", "halt", "Read and reserve budget."],
].map(([id, name, transport, sideEffects, idempotent, dataClassMax, approval, failure, summary]) => ({
  id,
  kind: "tool",
  name,
  version: "1.0.0",
  status: "active",
  transport,
  side_effects: sideEffects,
  idempotent,
  data_class_max: dataClassMax,
  approval,
  failure,
  free_to_use: true,
  requires_paid_service: false,
  audit: "ledger",
  summary,
  spec_ref: `SPECS.md §2.3 (${id})`,
}));

const workflows = [
  ["WF-01", "inquiry", "An observation, gap or program need.", ["intake", "observe", "question", "prior-art", "hypothesis", "charter"], ["frame"], { wall_clock: "6w", usd: 150, tokens: 5000000 }, ["after:charter"], "pause", ["CH", "CL"]],
  ["WF-02", "experiment", "An approved charter.", ["design", "preregister", "build", "run", "analyze", "verify", "risk"], ["prove"], { wall_clock: "6w", usd: 150, tokens: 5000000 }, ["after:preregister", "after:run", "after:verify"], "pause", ["RN", "EV", "KN"]],
  ["WF-03", "replicate", "An E2 evidence record nominated for replication.", ["select", "rebuild", "rerun", "compare", "verdict"], [], { wall_clock: "2w", usd: 40, tokens: 1000000 }, ["after:rebuild", "after:rerun"], "pause", ["EV", "KN"]],
  ["WF-04", "distill", "A supported claim, reusable method, or negative result.", ["select", "summarize", "provenance", "limitations", "license", "review", "publish"], ["prove"], { wall_clock: "1w", usd: 20, tokens: 500000 }, ["after:provenance"], "pause", ["KN"]],
  ["WF-05", "transfer", "A knowledge artifact at E3+ nominated for external use.", ["form", "provenance-audit", "license-check", "risk-review", "package", "release", "review"], ["transfer"], { wall_clock: "3w", usd: 80, tokens: 1000000 }, ["after:package"], "pause", ["KN", "DR"]],
  ["WF-06", "review", "Weekly evidence review.", ["triage", "verify-ledger", "audit-sample", "gates", "budget", "incidents", "registry"], [], { wall_clock: "90m", usd: 0, tokens: 0 }, ["after:audit-sample"], "pause", ["DR"]],
  ["WF-07", "incident", "A data-class breach, bad claim, tool failure, or unsafe output.", ["detect", "contain", "assess", "correct", "notify", "postmortem", "patch"], [], { wall_clock: "72h", usd: 0, tokens: 0 }, ["after:contain", "after:postmortem"], "rollback", ["KN", "DR"]],
  ["WF-08", "evolve", "Repeated friction, new evidence, or a quarterly review.", ["proposal", "impact", "trial", "decision", "version", "migration", "deprecate"], [], { wall_clock: "4w", usd: 20, tokens: 500000 }, ["after:trial"], "pause", ["DR"]],
].map(([id, name, trigger, stages, gates, budgets, checkpoints, onFailure, outputs]) => ({
  id,
  kind: "workflow",
  name,
  version: "1.0.0",
  status: "active",
  trigger,
  stages,
  gates,
  budgets,
  checkpoints,
  on_failure: onFailure,
  outputs,
  spec_ref: `SPECS.md §3.4 (${id})`,
}));

const models = [
  ["MD-qwen3.5-0.8b", "Qwen3.5 0.8B", "qwen3.5", "T0", "0.8B", "0.8B", 32768, ["text"], "Apache-2.0", "OSI", ["ollama", "llama.cpp"], "T0 reference; Galaxy S9 / 4 GB class devices."],
  ["MD-qwen3.5-2b", "Qwen3.5 2B", "qwen3.5", "T1", "2B", "2B", 32768, ["text"], "Apache-2.0", "OSI", ["ollama", "llama.cpp"], "Constrained-device workhorse; T1 entry."],
  ["MD-qwen3.5-4b", "Qwen3.5 4B", "qwen3.5", "T1", "4B", "4B", 32768, ["text"], "Apache-2.0", "OSI", ["ollama", "llama.cpp"], "Default capable-laptop workhorse."],
  ["MD-qwen3.5-9b", "Qwen3.5 9B", "qwen3.5", "T1", "9B", "9B", 32768, ["text"], "Apache-2.0", "OSI", ["ollama", "llama.cpp", "vllm"], "Strongest general SLM in the Nov 2026 assessment; T1 premium."],
  ["MD-gemma4-4b", "Gemma 4 4B", "gemma4", "T1", "4B", "4B", 32768, ["text", "image"], "Gemma Terms", "non-OSI", ["ollama", "llama.cpp"], "Mobile multimodal contender; licence review required."],
  ["MD-lfm3-1.7b", "LFM3 1.7B", "lfm3", "T1", "1.7B", "1.7B", 32768, ["text"], "LFM Open License", "non-OSI", ["llama.cpp"], "Efficient agent / tool-execution contender."],
  ["MD-granite4.2", "Granite 4.2", "granite4.2", "T1", null, null, 32768, ["text"], "Apache-2.0", "OSI", ["ollama", "llama.cpp"], "Enterprise structured-output and tool-use family; pin size at eval."],
  ["MD-minicpm5-2b", "MiniCPM5 2B", "minicpm5", "T1", "2B", "2B", 32768, ["text"], "MiniCPM Model License", "non-OSI", ["llama.cpp"], "Efficiency-focused 2B contender; licence review required."],
].map(([id, name, family, tier, params, activeParams, context, modalities, license, licenseClass, serving, notes]) => ({
  id,
  kind: "model",
  name,
  family,
  tier,
  params,
  active_params: activeParams,
  context,
  modalities,
  quantization: "Q4_K_M",
  format: "gguf",
  license,
  license_class: licenseClass,
  license_verified: false,
  source: "https://huggingface.co/",
  digest: null,
  serving,
  evals: {},
  cost_per_1k_tasks_usd: 0,
  free_to_use: true,
  requires_paid_service: false,
  status: "probation",
  admitted: null,
  reviewed: "2026-11-13",
  notes,
  spec_ref: "SPECS.md §2.6",
}));

const policy = {
  schema: "origin.policy/v1",
  version: "0.0.1",
  updated: "2026-11-13",
  foss_only: true,
  zero_cost: true,
  agents: {
    acp_required: true,
    foss_only: true,
    self_hostable: true,
    paid_or_account_gated: false,
    mandatory_telemetry: false,
  },
  models: {
    osi_required_for_active: true,
    non_osi_status: "probation",
    paid_default_path: false,
    local_first: true,
  },
  data_classes: {
    "0": "public",
    "1": "internal",
    "2": "confidential",
    "3": "restricted",
    "4": "regulated",
  },
};

const groups = [
  ["skill", "skills", skills],
  ["tool", "tools", tools],
  ["workflow", "workflows", workflows],
  ["model", "models", models],
];

const files = new Map();
for (const [kind, directory, entries] of groups) {
  for (const entry of entries) {
    files.set(path.join(directory, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  }
}

const index = {
  schema: "origin.registry/v1",
  version: "0.0.1",
  generated: "2026-11-13",
  policy: {
    foss_only: true,
    zero_cost: true,
    default_data_class: 0,
    agents: "ACP-compatible, FOSS, self-hostable",
  },
  counts: {
    skills: skills.length,
    tools: tools.length,
    workflows: workflows.length,
    models: models.length,
  },
  entries: groups.flatMap(([kind, directory, entries]) =>
    entries.map((entry) => ({ id: entry.id, kind, path: `${directory}/${entry.id}.json` })),
  ),
};

files.set("index.json", `${JSON.stringify(index, null, 2)}\n`);
files.set("policy.json", `${JSON.stringify(policy, null, 2)}\n`);

if (CHECK) {
  const problems = [];
  for (const [relative, content] of files) {
    const absolute = path.join(ROOT, relative);
    if (!fs.existsSync(absolute)) {
      problems.push(`missing ${relative}`);
      continue;
    }
    if (fs.readFileSync(absolute, "utf8") !== content) {
      problems.push(`stale ${relative}`);
    }
  }
  for (const [kind, directory] of groups) {
    const absolute = path.join(ROOT, directory);
    if (!fs.existsSync(absolute)) continue;
    for (const file of fs.readdirSync(absolute)) {
      if (!file.endsWith(".json")) continue;
      if (!files.has(path.join(directory, file))) problems.push(`unexpected ${directory}/${file}`);
    }
  }
  if (problems.length > 0) {
    process.stderr.write(`registry is stale:\n- ${problems.join("\n- ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`registry ok (${files.size} files)\n`);
} else {
  for (const [relative, content] of files) {
    const absolute = path.join(ROOT, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  process.stdout.write(`wrote ${files.size} registry files to ${ROOT}\n`);
}
