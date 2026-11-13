// Ledger verification: structure, chain continuity, and v1 hash integrity.

import {
  EVENT_SCHEMA,
  ZERO_HASH,
  hashEvent,
  isHash,
  isV1,
} from "./canonical.mjs";

/**
 * Verify an ordered array of ledger events.
 *
 * Checks, in order:
 *   1. the first event's `prev` is the zero hash (genesis);
 *   2. `seq` starts at 1 and increments by exactly 1;
 *   3. each event's `prev` equals the previous event's `hash`;
 *   4. each v1 event's stored hash matches a fresh canonical hash;
 *   5. legacy events (no schema) are counted as unverifiable trust anchors.
 *
 * A break stops verification at the first failure and reports the sequence.
 * `strict` additionally fails if any legacy event exists.
 */
export function verifyChain(events, { strict = false, allowLegacy = true } = {}) {
  const result = {
    ok: true,
    strict,
    events: events.length,
    verified: 0,
    legacy: 0,
    legacySeqs: [],
    breaks: [],
    anchored: false,
    head: ZERO_HASH,
  };

  let prevHash = ZERO_HASH;
  let expectedSeq = 1;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      result.breaks.push({
        seq: expectedSeq,
        reason: "malformed",
        detail: "event is not an object",
      });
      break;
    }

    if (event.seq !== expectedSeq) {
      result.breaks.push({
        seq: event.seq,
        reason: "sequence",
        expected: expectedSeq,
        actual: event.seq,
      });
      break;
    }

    if (typeof event.type !== "string" || event.type.length === 0) {
      result.breaks.push({ seq: event.seq, reason: "malformed", detail: "missing type" });
      break;
    }

    if (typeof event.at !== "string" || Number.isNaN(Date.parse(event.at))) {
      result.breaks.push({ seq: event.seq, reason: "malformed", detail: "invalid timestamp" });
      break;
    }

    if (event.prev !== prevHash) {
      result.breaks.push({
        seq: event.seq,
        reason: "prev",
        expected: prevHash,
        actual: event.prev ?? null,
      });
      break;
    }

    if (!isHash(event.hash)) {
      result.breaks.push({ seq: event.seq, reason: "malformed", detail: "invalid hash" });
      break;
    }

    if (isV1(event)) {
      const expected = hashEvent(event);
      if (expected !== event.hash) {
        result.breaks.push({
          seq: event.seq,
          reason: "hash",
          expected,
          actual: event.hash,
        });
        break;
      }
      result.verified += 1;
    } else {
      if (!allowLegacy) {
        result.breaks.push({
          seq: event.seq,
          reason: "legacy",
          detail: `event schema is not ${EVENT_SCHEMA}`,
        });
        break;
      }
      result.legacy += 1;
      result.legacySeqs.push(event.seq);
    }

    prevHash = event.hash;
    result.head = event.hash;
    expectedSeq += 1;
  }

  result.anchored = result.legacySeqs.includes(1);
  result.ok = result.breaks.length === 0 && (!strict || result.legacy === 0);
  return result;
}
