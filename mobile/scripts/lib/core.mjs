// Shared Node loader for the Rust core compiled to WebAssembly.
// Used by the demo generator, the test suite and the release verifier.
import fs from "node:fs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function loadCore(wasmPath) {
  const bytes = fs.readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports;

  function call(fn, text) {
    const input = encoder.encode(text);
    const ptr = ex.origin_alloc(input.length);
    if (!ptr) throw new Error("origin_alloc failed");
    new Uint8Array(ex.memory.buffer, ptr, input.length).set(input);
    const resultPtr = fn(ptr, input.length);
    ex.origin_free(ptr, input.length);
    const len = ex.origin_result_len();
    return decoder.decode(new Uint8Array(ex.memory.buffer, resultPtr, len));
  }

  return {
    bytes,
    version: "0.0.1",
    sha256(text) {
      return call(ex.origin_sha256_hex, text);
    },
    canonicalize(text) {
      return call(ex.origin_canonicalize, text);
    },
    buildEvent(body) {
      return call(ex.origin_build_event, typeof body === "string" ? body : JSON.stringify(body));
    },
    verify(jsonl) {
      return JSON.parse(call(ex.origin_verify, jsonl));
    },
    selfTest() {
      return JSON.parse(decoder.decode(readCString(ex, ex.origin_self_test())));
    },
  };
}

function readCString(ex, ptr) {
  const memory = new Uint8Array(ex.memory.buffer);
  let end = ptr;
  while (memory[end] !== 0) end += 1;
  return memory.slice(ptr, end);
}

export function jsonl(events) {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}
