/*
 * Loader for the OriginLabs Rust core compiled to wasm32-unknown-unknown.
 *
 * The core is embedded as base64 so the Android WebView can instantiate it
 * from file:// without fetch(), CORS, a server or a network. If the core is
 * missing the app refuses to trust the ledger; there is no JavaScript fallback
 * for hashing, because the trust boundary must stay in one implementation.
 */
(function (root) {
  "use strict";

  var encoder = new TextEncoder();
  var decoder = new TextDecoder();
  var instance = null;
  var loading = null;

  function b64ToBytes(b64) {
    var binary = atob(b64);
    var out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function readCString(ptr) {
    var memory = new Uint8Array(instance.exports.memory.buffer);
    var end = ptr;
    while (memory[end] !== 0) end += 1;
    return decoder.decode(memory.slice(ptr, end));
  }

  function callWithInput(fn, text) {
    var input = encoder.encode(text);
    var ptr = instance.exports.origin_alloc(input.length);
    if (!ptr) throw new Error("Rust core could not allocate input memory");
    new Uint8Array(instance.exports.memory.buffer, ptr, input.length).set(input);
    var resultPtr;
    try {
      resultPtr = fn(ptr, input.length);
    } finally {
      instance.exports.origin_free(ptr, input.length);
    }
    var length = instance.exports.origin_result_len();
    return decoder.decode(new Uint8Array(instance.exports.memory.buffer, resultPtr, length));
  }

  function parseOrThrow(text, what) {
    var value;
    try {
      value = JSON.parse(text);
    } catch (e) {
      throw new Error(what + " returned invalid JSON: " + text.slice(0, 200));
    }
    if (value && typeof value === "object" && value.error) {
      throw new Error(what + ": " + value.error);
    }
    return value;
  }

  function api(meta) {
    return {
      meta: meta,
      version: meta.version,
      sha256: function (text) {
        return callWithInput(instance.exports.origin_sha256_hex, text);
      },
      canonicalize: function (text) {
        return callWithInput(instance.exports.origin_canonicalize, text);
      },
      buildEvent: function (body) {
        var text = typeof body === "string" ? body : JSON.stringify(body);
        return parseOrThrow(callWithInput(instance.exports.origin_build_event, text), "build_event");
      },
      verify: function (jsonl) {
        return parseOrThrow(callWithInput(instance.exports.origin_verify, jsonl), "verify");
      },
      selfTest: function () {
        return parseOrThrow(readCString(instance.exports.origin_self_test()), "self_test");
      }
    };
  }

  async function load() {
    if (instance) return api(root.ORIGIN_CORE_META || { version: "0.0.1" });
    if (loading) return loading;
    loading = (async function () {
      var b64 = root.ORIGIN_WASM_BASE64;
      if (!b64) throw new Error("Rust core is not embedded (missing wasm.js)");
      var bytes = b64ToBytes(b64);
      var result = await WebAssembly.instantiate(bytes, {});
      instance = result.instance;
      var meta = root.ORIGIN_CORE_META || {};
      if (!meta.sha256 && root.crypto && root.crypto.subtle) {
        var digest = await root.crypto.subtle.digest("SHA-256", bytes);
        meta.sha256 = Array.prototype.map
          .call(new Uint8Array(digest), function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("");
      }
      meta.version = meta.version || "0.0.1";
      meta.bytes = bytes.length;
      return api(meta);
    })();
    return loading;
  }

  root.OriginCore = { load: load };
})(typeof globalThis !== "undefined" ? globalThis : this);
