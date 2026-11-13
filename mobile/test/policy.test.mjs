import test from "node:test";
import assert from "node:assert/strict";
import { loadPolicy, loadState, readJson, exists } from "./helpers.mjs";

const policy = loadPolicy();

function claim(overrides = {}) {
  return {
    id: "CL-0001",
    charter: "CH-0001",
    status: "proposed",
    evidence: [],
    ...overrides,
  };
}

function model(evidence, charter) {
  return {
    claims: { "CL-0001": claim() },
    evidence,
    charters: { "CH-0001": charter || { risk: { class: "low" } } },
  };
}

test("humans, agents and system actors are distinguished", () => {
  assert.equal(policy.actorKind("principal"), "human");
  assert.equal(policy.actorKind("human:ada"), "human");
  assert.equal(policy.actorKind("person:ada"), "human");
  assert.equal(policy.actorKind("reviewer"), "human");
  assert.equal(policy.actorKind("agent:builder"), "agent");
  assert.equal(policy.actorKind("system:clock"), "system");
  assert.equal(policy.actorKind(""), "unknown");
});

test("a gate always needs a human, and Transfer needs two distinct humans", () => {
  assert.equal(policy.validateSigners("frame", ["principal"]).ok, true);
  assert.equal(policy.validateSigners("frame", ["agent:builder"]).ok, false);
  assert.equal(policy.validateSigners("frame", []).ok, false);

  const single = policy.validateSigners("transfer", ["principal"]);
  assert.equal(single.ok, false);
  assert.match(single.errors[0], /two distinct human signers/);

  assert.equal(policy.validateSigners("transfer", ["principal", "principal"]).ok, false);
  assert.equal(policy.validateSigners("transfer", ["principal", "agent:builder"]).ok, false);
  assert.equal(policy.validateSigners("transfer", ["principal", "reviewer"]).ok, true);
});

test("evidence floors gate each transition", () => {
  const e2 = { id: "EV-0001", grade: "E2" };
  const e3 = { id: "EV-0002", grade: "E3" };
  const e4 = { id: "EV-0003", grade: "E4" };

  const noEvidence = model({});
  assert.equal(policy.canTransition({ claim: claim(), to: "investigating", model: noEvidence }).ok, false);

  const withE1 = model({ "EV-0001": { id: "EV-0001", grade: "E1" } });
  assert.equal(
    policy.canTransition({
      claim: claim({ status: "proposed", evidence: ["EV-0001"] }),
      to: "investigating",
      model: withE1,
    }).ok,
    true
  );

  assert.equal(
    policy.canTransition({
      claim: claim({ status: "investigating", evidence: ["EV-0001"] }),
      to: "supported",
      model: withE1,
    }).ok,
    false
  );

  assert.equal(
    policy.canTransition({
      claim: claim({ status: "investigating", evidence: ["EV-0001"] }),
      to: "supported",
      model: model({ "EV-0001": e2 }),
    }).ok,
    true
  );

  assert.equal(
    policy.canTransition({
      claim: claim({ status: "supported", evidence: ["EV-0001"] }),
      to: "established",
      model: model({ "EV-0001": e2 }),
    }).ok,
    false
  );

  assert.equal(
    policy.canTransition({
      claim: claim({ status: "supported", evidence: ["EV-0002"] }),
      to: "established",
      model: model({ "EV-0002": e3 }),
    }).ok,
    true
  );

  const highRisk = model({ "EV-0002": e3 }, { risk: { class: "high" } });
  assert.equal(
    policy.canTransition({
      claim: claim({ status: "supported", evidence: ["EV-0002"] }),
      to: "established",
      model: highRisk,
    }).ok,
    false
  );
  assert.equal(
    policy.canTransition({
      claim: claim({ status: "supported", evidence: ["EV-0003"] }),
      to: "established",
      model: model({ "EV-0003": e4 }, { risk: { class: "high" } }),
    }).ok,
    true
  );
});

test("illegal and terminal transitions are refused", () => {
  assert.equal(
    policy.canTransition({
      claim: claim({ status: "proposed" }),
      to: "supported",
      model: model({}),
    }).ok,
    false
  );
  assert.equal(
    policy.canTransition({
      claim: claim({ status: "superseded" }),
      to: "investigating",
      model: model({}),
    }).ok,
    false
  );
});

test("class >=2 payloads may carry references but never raw content", () => {
  assert.equal(policy.validatePayload({ ref: "KN-0001", sha256: "ab" }, 2).ok, true);
  assert.equal(policy.validatePayload({ content: "secret" }, 2).ok, false);
  assert.equal(policy.validatePayload({ text: "a short note" }, 2).ok, false);
  assert.equal(policy.validatePayload({ content: "public" }, 1).ok, true);
  assert.equal(policy.validatePayload({ note: "x".repeat(1025) }, 2).ok, false);
  assert.equal(policy.validatePayload([1, 2], 2).ok, false);
});

test("event validation enforces gates, claim shape and evidence links", () => {
  const m = model({});
  const base = { dataClass: 0, actor: "principal" };

  assert.equal(
    policy.validateEvent(
      { ...base, type: "gate.decided", payload: { gate: "frame", signers: ["agent:builder"] } },
      m
    ).ok,
    false
  );
  assert.equal(
    policy.validateEvent(
      { ...base, type: "gate.decided", payload: { gate: "transfer", signers: ["principal"] } },
      m
    ).ok,
    false
  );
  assert.equal(
    policy.validateEvent(
      { ...base, type: "gate.decided", payload: { gate: "frame", signers: ["principal"] } },
      m
    ).ok,
    true
  );

  assert.equal(
    policy.validateEvent(
      { ...base, type: "claim.created", payload: { claim: "CL-0001", statement: "s", falsifier: "f", status: "supported" } },
      m
    ).ok,
    false
  );
  assert.equal(
    policy.validateEvent(
      { ...base, type: "claim.created", payload: { claim: "CL-0001", statement: "s", falsifier: "f", status: "proposed" } },
      m
    ).ok,
    true
  );

  assert.equal(
    policy.validateEvent(
      { ...base, type: "evidence.recorded", payload: { claim: "CL-9999", grade: "E2", method: "m", result: "r" } },
      m
    ).ok,
    false
  );
  assert.equal(
    policy.validateEvent(
      { ...base, type: "evidence.recorded", payload: { claim: "CL-0001", grade: "E9", method: "m", result: "r" } },
      m
    ).ok,
    false
  );

  assert.equal(
    policy.validateEvent(
      {
        dataClass: 2,
        actor: "principal",
        type: "evidence.recorded",
        payload: { claim: "CL-0001", evidence: "EV-0001", grade: "E2", method: "m", result: "r", content: "raw" },
      },
      m
    ).ok,
    false
  );
});

test("the demo derives the same model the UI shows", { skip: !exists("web/data/demo.json") && "no demo bundle" }, () => {
  const state = loadState(policy);
  const demo = readJson("web/data/demo.json");
  const derived = state.derive({
    workspace: demo.workspace,
    events: demo.events,
    meta: {},
  });
  assert.equal(derived.counts.events, 16);
  assert.equal(derived.counts.claims, 2);
  assert.equal(derived.counts.charters, 1);
  assert.equal(derived.counts.gates, 1);
  assert.equal(derived.counts.artifacts, 1);
  assert.equal(derived.counts.incidents, 1);
  assert.equal(derived.head, demo.meta.head);
  assert.equal(derived.claims["CL-0001"].status, "supported");
});
