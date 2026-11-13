// Safe ledger reads and appends. Append-only: nothing is ever rewritten.

import fs from "node:fs";
import path from "node:path";

import {
  EVENT_SCHEMA,
  ZERO_HASH,
  hashEvent,
} from "./canonical.mjs";
import { verifyChain } from "./verify.mjs";

export function readLedger(file) {
  if (!fs.existsSync(file)) return [];

  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSON at line ${index + 1}: ${error.message}`);
    }
  });
}

export function headOf(file) {
  const events = readLedger(file);
  if (events.length === 0) {
    return { seq: 0, hash: ZERO_HASH, at: null, type: null };
  }
  const last = events[events.length - 1];
  return { seq: last.seq, hash: last.hash, at: last.at, type: last.type };
}

/**
 * Append one v1 event. Refuses if the existing chain is broken, so a
 * corrupt ledger cannot be extended and quietly "healed".
 */
export function appendEvent({
  file,
  type,
  payload = {},
  actor = "local",
  dataClass = 0,
  at = new Date().toISOString(),
}) {
  if (!file) throw new TypeError("appendEvent requires a file");
  if (typeof type !== "string" || type.length === 0) {
    throw new TypeError("appendEvent requires a non-empty type");
  }
  if (!Number.isInteger(dataClass) || dataClass < 0 || dataClass > 4) {
    throw new RangeError("dataClass must be an integer from 0 to 4");
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("payload must be an object");
  }

  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });

  const lock = `${file}.lock`;
  let lockFd;
  try {
    lockFd = fs.openSync(lock, "wx");
  } catch {
    throw new Error(`ledger is locked by another writer: ${lock}`);
  }

  try {
    const events = readLedger(file);
    const check = verifyChain(events);
    if (!check.ok) {
      const first = check.breaks[0];
      throw new Error(
        `refusing to append: ledger chain is broken at seq ${first?.seq ?? "?"} (${first?.reason ?? "unknown"})`,
      );
    }

    const last = events[events.length - 1];
    const event = {
      schema: EVENT_SCHEMA,
      seq: last ? last.seq + 1 : 1,
      at,
      type,
      actor,
      dataClass,
      payload,
      prev: last ? last.hash : ZERO_HASH,
    };
    const record = { ...event, hash: hashEvent(event) };

    const fd = fs.openSync(file, "a");
    try {
      fs.writeSync(fd, `${JSON.stringify(record)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return record;
  } finally {
    fs.closeSync(lockFd);
    fs.rmSync(lock, { force: true });
  }
}
