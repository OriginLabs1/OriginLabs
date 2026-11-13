import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { appendEvent, readLedger } from "../src/ledger/append.mjs";
import {
  EVENT_SCHEMA,
  ZERO_HASH,
  hashEvent,
} from "../src/ledger/canonical.mjs";
import { verifyChain } from "../src/ledger/verify.mjs";

function tempLedger() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "originlabs-ledger-"));
  return path.join(directory, "events.jsonl");
}

function seed(file) {
  appendEvent({ file, type: "workspace.created", payload: { name: "test" } });
  appendEvent({
    file,
    type: "charter.approved",
    payload: { charter: "CH-0001" },
    dataClass: 1,
  });
  appendEvent({ file, type: "gate.decided", payload: { gate: "frame" } });
}

test("verifies a clean v1 chain", () => {
  const file = tempLedger();
  const first = appendEvent({ file, type: "workspace.created", payload: { name: "test" } });
  const second = appendEvent({ file, type: "charter.approved", payload: { charter: "CH-0001" } });
  const third = appendEvent({ file, type: "gate.decided", payload: { gate: "frame" } });

  const result = verifyChain(readLedger(file));

  assert.equal(result.ok, true);
  assert.equal(result.events, 3);
  assert.equal(result.verified, 3);
  assert.equal(result.legacy, 0);
  assert.equal(result.head, third.hash);
  assert.equal(result.breaks.length, 0);
  assert.equal(first.seq, 1);
  assert.equal(first.prev, ZERO_HASH);
  assert.equal(second.prev, first.hash);
  assert.equal(third.prev, second.hash);
});

test("detects a tampered payload at the right sequence", () => {
  const file = tempLedger();
  seed(file);

  const events = readLedger(file);
  events[1].payload.charter = "CH-9999";

  const result = verifyChain(events);

  assert.equal(result.ok, false);
  assert.equal(result.breaks[0].reason, "hash");
  assert.equal(result.breaks[0].seq, 2);
});

test("detects a broken prev link", () => {
  const file = tempLedger();
  seed(file);

  const events = readLedger(file);
  events[2].prev = "f".repeat(64);

  const result = verifyChain(events);

  assert.equal(result.ok, false);
  assert.equal(result.breaks[0].reason, "prev");
  assert.equal(result.breaks[0].seq, 3);
});

test("detects a sequence gap", () => {
  const file = tempLedger();
  seed(file);

  const events = readLedger(file);
  events.splice(1, 1);

  const result = verifyChain(events);

  assert.equal(result.ok, false);
  assert.equal(result.breaks[0].reason, "sequence");
  assert.equal(result.breaks[0].seq, 3);
});

test("treats a pre-v1 genesis event as a trust anchor", () => {
  const file = tempLedger();
  const legacy = {
    seq: 1,
    at: "2026-11-13T15:19:28.825Z",
    type: "workspace.created",
    payload: { name: "legacy" },
    prev: ZERO_HASH,
    hash: "a".repeat(64),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(legacy)}\n`);

  const appended = appendEvent({ file, type: "charter.proposed", payload: { charter: "CH-0002" } });
  const events = readLedger(file);

  assert.equal(appended.prev, legacy.hash);

  const relaxed = verifyChain(events);
  assert.equal(relaxed.ok, true);
  assert.equal(relaxed.legacy, 1);
  assert.equal(relaxed.verified, 1);
  assert.equal(relaxed.anchored, true);

  const strict = verifyChain(events, { strict: true });
  assert.equal(strict.ok, false);
  assert.equal(strict.legacy, 1);
});

test("refuses to append to a broken chain", () => {
  const file = tempLedger();
  seed(file);

  const events = readLedger(file);
  events[1].payload.charter = "CH-9999";
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);

  assert.throws(
    () => appendEvent({ file, type: "gate.decided", payload: {} }),
    /ledger chain is broken/,
  );
});

test("canonical hashing is independent of payload key order", () => {
  const base = {
    schema: EVENT_SCHEMA,
    seq: 1,
    at: "2026-11-13T00:00:00.000Z",
    type: "claim.created",
    actor: "principal",
    dataClass: 1,
    prev: ZERO_HASH,
  };

  const a = hashEvent({ ...base, payload: { alpha: 1, beta: { x: true, y: [1, 2] } } });
  const b = hashEvent({ ...base, payload: { beta: { y: [1, 2], x: true }, alpha: 1 } });

  assert.equal(a, b);
});

test("CLI verifies a clean ledger and fails on a tampered one", () => {
  const file = tempLedger();
  seed(file);

  const cli = path.resolve("bin/origin-ledger.mjs");
  const clean = execFileSync(process.execPath, [cli, "verify", "--file", file, "--json"], {
    encoding: "utf8",
  });
  assert.equal(JSON.parse(clean).ok, true);

  const events = readLedger(file);
  events[1].payload.charter = "CH-9999";
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);

  assert.throws(
    () =>
      execFileSync(process.execPath, [cli, "verify", "--file", file], {
        encoding: "utf8",
        stdio: "pipe",
      }),
    /Command failed/,
  );
});
