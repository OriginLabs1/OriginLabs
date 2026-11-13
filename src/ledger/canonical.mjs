// Canonical JSON + event hashing for the OriginLabs ledger.
// Zero dependencies: Node.js standard library only.

import { createHash } from "node:crypto";

export const EVENT_SCHEMA = "origin.event/v1";
export const ZERO_HASH = "0".repeat(64);

/**
 * Deterministic JSON: object keys sorted recursively, no whitespace,
 * undefined values omitted, non-finite numbers rejected.
 * This is the canonical form hashed for every v1 event.
 */
export function canonicalJson(value) {
  if (value === null) return "null";

  const type = typeof value;
  if (type === "string" || type === "boolean") return JSON.stringify(value);
  if (type === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number in canonical JSON");
    return JSON.stringify(value);
  }
  if (type === "undefined") return undefined;
  if (type === "bigint") throw new TypeError("bigint is not canonical JSON");

  if (Array.isArray(value)) {
    const parts = value.map((item) => canonicalJson(item));
    return `[${parts.map((part) => (part === undefined ? "null" : part)).join(",")}]`;
  }

  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  const fields = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${fields.join(",")}}`;
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The v1 envelope. `schema`, `actor` and `dataClass` are part of the hash.
 * Legacy (pre-v1) events lack `schema` and are treated as a trust anchor
 * by the verifier, never silently re-hashed.
 */
export function eventBody(event) {
  return {
    schema: event.schema ?? EVENT_SCHEMA,
    seq: event.seq,
    at: event.at,
    type: event.type,
    actor: event.actor ?? "local",
    dataClass: event.dataClass ?? 0,
    payload: event.payload ?? {},
    prev: event.prev ?? ZERO_HASH,
  };
}

export function hashEvent(event) {
  return sha256(canonicalJson(eventBody(event)));
}

export function isV1(event) {
  return event?.schema === EVENT_SCHEMA;
}

export function isHash(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
