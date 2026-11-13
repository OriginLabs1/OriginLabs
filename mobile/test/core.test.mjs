import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadCore, jsonl, eventBody, readJson, exists, mobileRoot } from "./helpers.mjs";

const core = await loadCore();

test("Rust WASM core is present and self-tests", { skip: !core && "build/origin_core.wasm has not been built" }, () => {
  const result = core.selfTest();
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.checks.map((check) => check.name),
    ["sha256-abc", "canonical-json", "build-event"]
  );
});

test("SHA-256 matches published vectors", { skip: !core && "core not built" }, () => {
  assert.equal(core.sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(core.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(core.sha256("hello\n"), "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03");
});

test("canonical JSON sorts keys recursively and rejects duplicates", { skip: !core && "core not built" }, () => {
  assert.equal(
    core.canonicalize('{"b":2,"a":{"d":4,"c":3},"e":[{"z":1,"a":2}]}'),
    '{"a":{"c":3,"d":4},"b":2,"e":[{"a":2,"z":1}]}'
  );
  const duplicate = JSON.parse(core.canonicalize('{"a":1,"a":2}'));
  assert.match(duplicate.error, /duplicate/i);
});

test("a built event verifies, and one altered byte breaks it", { skip: !core && "core not built" }, () => {
  const event = core.buildEvent(eventBody());
  assert.match(event.hash, /^[0-9a-f]{64}$/);
  assert.equal(event.prev, "0".repeat(64));

  const clean = core.verify(jsonl([event]));
  assert.equal(clean.ok, true);
  assert.equal(clean.events, 1);
  assert.equal(clean.head, event.hash);

  const tampered = JSON.parse(JSON.stringify(event));
  tampered.payload.name = "Tampered";
  const broken = core.verify(jsonl([tampered]));
  assert.equal(broken.ok, false);
  assert.equal(broken.breaks[0].seq, 1);
  assert.match(broken.breaks[0].reason, /hash mismatch/);
});

test("a chain links previous hashes and rejects reordering", { skip: !core && "core not built" }, () => {
  const first = core.buildEvent(eventBody());
  const second = core.buildEvent(
    eventBody({
      seq: 2,
      type: "claim.created",
      payload: {
        claim: "CL-0001",
        charter: "CH-0001",
        statement: "The core verifies offline.",
        falsifier: "A network call is required.",
        status: "proposed",
        type: "engineering",
        confidence: 0.5,
      },
      prev: first.hash,
    })
  );
  assert.equal(second.prev, first.hash);
  assert.equal(core.verify(jsonl([first, second])).ok, true);

  const reordered = core.verify(jsonl([second, first]));
  assert.equal(reordered.ok, false);
  assert.match(reordered.breaks[0].reason, /sequence|previous/i);
});

test("the demo bundle is a valid ledger", { skip: !core && "core not built" }, () => {
  if (!exists("web/data/demo.json")) return;
  const demo = readJson("web/data/demo.json");
  assert.ok(Array.isArray(demo.events));
  assert.equal(demo.events.length, 16);
  const result = core.verify(jsonl(demo.events));
  assert.equal(result.ok, true);
  assert.equal(result.events, 16);
  assert.equal(result.head, demo.meta.head);
});

test("the repository ledger verifies when present", { skip: !core && "core not built" }, () => {
  const ledger = path.join(mobileRoot, "../.origin/events.jsonl");
  if (!exists("../.origin/events.jsonl")) return;
  const text = fs.readFileSync(ledger, "utf8");
  const result = core.verify(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.legacy, [1]);
});
