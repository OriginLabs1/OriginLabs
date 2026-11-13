// Generate a deterministic, fully verifiable demo workspace for the app,
// screenshots and the test suite. Every event is built by the Rust core, so the
// demo cannot drift from the real envelope/hash rules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCore, jsonl } from "./lib/core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const wasm = path.resolve(mobile, "build/origin_core.wasm");
const outJson = path.resolve(mobile, "web/data/demo.json");
const outJs = path.resolve(mobile, "web/data/demo.js");

const core = await loadCore(wasm);
const coreSha = core.sha256("origin-core-0.0.1");
const ZERO = "0".repeat(64);
const at = (i) => new Date(Date.UTC(2026, 10, 13, 8, 0, i)).toISOString();

const defs = [
  {
    type: "workspace.created",
    payload: {
      name: "OriginLabs Demo",
      owner: "principal",
      policy: "local-authoritative",
      defaultDataClass: 0,
      note: "Synthetic demo workspace. It is safe to reset.",
    },
  },
  {
    type: "spec.versioned",
    payload: {
      version: "0.0.1",
      documents: ["CONTEXT.md", "SPECS.md"],
      registry: { skills: 13, tools: 20, workflows: 8, models: 8 },
      policy: "foss-only/zero-cost",
    },
  },
  {
    type: "charter.proposed",
    payload: {
      charter: "CH-0001",
      title: "Verifiable Knowledge Pipeline",
      program: "P1",
      question:
        "Can every claim in this lab be traced to evidence and rerun by a stranger?",
      whyNow:
        "The mobile surface must prove the same trust chain as the desktop Coordinator.",
      scope: {
        in: ["canonical JSON", "hash-chain verification", "offline replay"],
        out: ["remote inference", "multi-user sync"],
      },
      risk: { class: "low", dualUse: false, dataClassMax: 1 },
      evidenceBar: "E2",
      budget: { weeks: 6, computeHours: 0, usd: 0, tokens: 0 },
      stopConditions: [
        "A chain break cannot be localised",
        "A class-1 payload leaves the device",
        "The verifier needs a network or an account",
      ],
      owner: "principal",
    },
  },
  {
    type: "charter.approved",
    payload: {
      charter: "CH-0001",
      gate: "frame",
      signer: "principal",
      packet: "KN-0000",
      decision: "approve",
    },
  },
  {
    type: "claim.created",
    payload: {
      claim: "CL-0001",
      charter: "CH-0001",
      statement:
        "The portable Rust core verifies the OriginLabs v1 ledger offline on Android.",
      type: "engineering",
      status: "proposed",
      falsifier:
        "The verifier accepts a tampered hash, or a valid chain fails without a network.",
      confidence: 0.7,
      limitations: ["Demo workspace, one device class."],
      supersedes: null,
    },
  },
  {
    type: "evidence.recorded",
    payload: {
      claim: "CL-0001",
      evidence: "EV-0001",
      grade: "E1",
      kind: "literature",
      source: { url: "https://github.com/OriginLabs1/OriginLabs" },
      method:
        "Read the v1 envelope and canonical JSON rules in SPECS.md §0.5.",
      result: "The body fields and SHA-256 rule are specified normatively.",
      reproduces: false,
      independent: false,
      adversarial: false,
      recordedBy: "principal",
    },
  },
  {
    type: "claim.transitioned",
    payload: {
      claim: "CL-0001",
      from: "proposed",
      to: "investigating",
      reason: "The envelope is specified; a replay is next.",
      evidence: ["EV-0001"],
    },
  },
  {
    type: "evidence.recorded",
    payload: {
      claim: "CL-0001",
      evidence: "EV-0002",
      grade: "E2",
      kind: "experiment",
      run: "RN-0001",
      source: { artifact: "origin_core.wasm", sha256: coreSha },
      method:
        "Compile the core to wasm32, build a v1 event, verify the resulting JSONL, then alter one payload byte.",
      result:
        "The valid chain returned ok:true; the altered chain returned ok:false at seq 1 with a hash mismatch.",
      reproduces: true,
      independent: false,
      adversarial: false,
      recordedBy: "principal",
      limitations: ["Replay is on the same operator and device family."],
    },
  },
  {
    type: "claim.transitioned",
    payload: {
      claim: "CL-0001",
      from: "investigating",
      to: "supported",
      reason: "E2 evidence with a replayable wasm artifact.",
      evidence: ["EV-0002"],
    },
  },
  {
    type: "gate.decided",
    payload: {
      gate: "frame",
      charter: "CH-0001",
      decision: "approve",
      signers: ["principal"],
      packet: "KN-0000",
      reasons: [
        "Falsifiable question, explicit stop conditions and a zero-cost budget.",
      ],
    },
  },
  {
    type: "claim.created",
    payload: {
      claim: "CL-0002",
      charter: "CH-0001",
      statement:
        "No v0.0.1 workflow needs remote inference for class-2 data.",
      type: "analytical",
      status: "proposed",
      falsifier:
        "A required workflow demands a remote class-2 call, or the policy test allows one.",
      confidence: 0.6,
      limitations: [
        "Policy claim about the default path, not every deployment.",
      ],
      supersedes: null,
    },
  },
  {
    type: "evidence.recorded",
    payload: {
      claim: "CL-0002",
      evidence: "EV-0003",
      grade: "E1",
      kind: "review",
      source: { url: "https://github.com/OriginLabs1/OriginLabs" },
      method: "Read the data-class egress table in SPECS.md §0.4.",
      result:
        "Class 2 is local-only by default; remote inference requires an explicit logged exception.",
      reproduces: false,
      independent: false,
      adversarial: false,
      recordedBy: "principal",
    },
  },
  {
    type: "claim.transitioned",
    payload: {
      claim: "CL-0002",
      from: "proposed",
      to: "investigating",
      reason: "The policy text is traceable; adversarial policy tests are next.",
      evidence: ["EV-0003"],
    },
  },
  {
    type: "artifact.published",
    payload: {
      artifact: "KN-0001",
      kind: "negative-result",
      title: "A remote-only class-2 route was refused",
      claims: ["CL-0002"],
      summary:
        "The mobile policy check rejects a remote route for class-2 data before any model call. The negative result is kept as a first-class artifact.",
      provenance: { runs: [], commits: [], models: [] },
      license: "MIT",
      reuse: "internal",
      maintainer: "principal",
      limitations: ["Synthetic policy test, not a field study."],
    },
  },
  {
    type: "incident.opened",
    payload: {
      incident: "IN-0001",
      title: "Tamper probe detected at the expected sequence",
      severity: "low",
      status: "contained",
      claim: "CL-0001",
      summary:
        "A deliberately altered byte in the demo ledger was rejected at seq 1.",
    },
  },
  {
    type: "correction.appended",
    payload: {
      correction: "CO-0001",
      target: "CL-0002",
      reason:
        "Narrowed to the v0.0.1 policy default; it is not a claim about all deployments.",
      evidence: "EV-0003",
    },
  },
];

const events = [];
let prev = ZERO;
for (let i = 0; i < defs.length; i += 1) {
  const def = defs[i];
  const body = {
    seq: i + 1,
    at: at(i),
    type: def.type,
    actor: def.actor || "principal",
    dataClass: def.dataClass ?? 0,
    payload: def.payload,
    prev,
  };
  const built = JSON.parse(core.buildEvent(body));
  events.push(built);
  prev = built.hash;
}

const verification = core.verify(jsonl(events));
if (!verification.ok) {
  console.error(verification);
  throw new Error("generated demo does not verify");
}

const bundle = {
  schema: "origin.mobile.bundle/v1",
  app: { name: "OriginLabs", version: "0.0.1", core: "0.0.1" },
  demo: true,
  workspace: {
    id: "ws_demo_originlabs",
    name: "OriginLabs Demo",
    createdAt: at(0),
    owner: "principal",
    principal: "principal",
    defaultDataClass: 0,
    policy: "local-authoritative",
  },
  events,
  meta: {
    exportedAt: "2026-11-13T12:00:00.000Z",
    eventCount: events.length,
    head: verification.head,
    ledgerSha256: core.sha256(jsonl(events)),
    note: "Synthetic demo. Every event is built and verified by the Rust core.",
  },
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(bundle, null, 2) + "\n");
fs.writeFileSync(
  outJs,
  `/* Generated by scripts/gen-demo.mjs — do not edit. */\nwindow.ORIGIN_DEMO_BUNDLE = ${JSON.stringify(bundle)};\n`,
);

console.log(
  `Demo workspace: ${events.length} events, head ${verification.head.slice(0, 16)}…, ok=${verification.ok}`,
);
