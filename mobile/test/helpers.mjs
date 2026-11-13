// Shared helpers for the OriginLabs Node test suite.
// Tests skip themselves when a generated artifact is absent, so a fresh clone
// can run `node --test` before building the Rust core.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(mobileRoot, relative), "utf8"));
}

export function exists(relative) {
  return fs.existsSync(path.join(mobileRoot, relative));
}

/** Load web/policy.js into an isolated VM and return its global API. */
export function loadPolicy() {
  const code = fs.readFileSync(path.join(mobileRoot, "web/policy.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(code, context, { filename: "policy.js" });
  return context.OriginPolicy;
}

/** Load web/state.js into an isolated VM (derive() is pure). */
export function loadState(policy) {
  const code = fs.readFileSync(path.join(mobileRoot, "web/state.js"), "utf8");
  const context = vm.createContext({ OriginPolicy: policy });
  vm.runInContext(code, context, { filename: "state.js" });
  return context.OriginState;
}

/** Instantiate build/origin_core.wasm and expose the ABI as JS functions. */
export async function loadCore() {
  const wasmPath = path.join(mobileRoot, "build/origin_core.wasm");
  if (!fs.existsSync(wasmPath)) return null;

  const bytes = fs.readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const memory = () => new Uint8Array(instance.exports.memory.buffer);

  function call(fn, text) {
    const input = encoder.encode(text);
    const ptr = instance.exports.origin_alloc(input.length);
    if (!ptr) throw new Error("origin_alloc failed");
    memory().set(input, ptr);
    let resultPtr;
    try {
      resultPtr = fn(ptr, input.length);
    } finally {
      instance.exports.origin_free(ptr, input.length);
    }
    const length = instance.exports.origin_result_len();
    return decoder.decode(new Uint8Array(instance.exports.memory.buffer, resultPtr, length));
  }

  function parse(fn, text) {
    const value = JSON.parse(call(fn, text));
    if (value && value.error) throw new Error(value.error);
    return value;
  }

  return {
    bytes,
    sha256: (text) => call(instance.exports.origin_sha256_hex, text),
    canonicalize: (text) => call(instance.exports.origin_canonicalize, text),
    buildEvent: (body) => parse(instance.exports.origin_build_event, JSON.stringify(body)),
    verify: (jsonl) => parse(instance.exports.origin_verify, jsonl),
    selfTest: () => parse(instance.exports.origin_self_test, ""),
  };
}

export function jsonl(events) {
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

export const ZERO = "0".repeat(64);

export function eventBody(overrides = {}) {
  return {
    seq: 1,
    at: "2026-11-13T00:00:00.000Z",
    type: "workspace.created",
    actor: "principal",
    dataClass: 0,
    payload: { name: "Test lab" },
    prev: ZERO,
    ...overrides,
  };
}
