import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { mobileRoot, readJson, exists } from "./helpers.mjs";

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

// The generated surface lives in the Android assets after a build; fall back to
// web/ so the suite still works before the first APK build.
const surface = exists("app/src/main/assets/www/asset-manifest.json")
  ? "app/src/main/assets/www"
  : exists("web/asset-manifest.json")
    ? "web"
    : null;

const apkPath = path.join(mobileRoot, "build/OriginLabs-0.0.1.apk");
const haveApk = fs.existsSync(apkPath);
const haveZip = (() => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

test("every shipped asset matches the hashed manifest", { skip: !surface && "no built web surface" }, () => {
  const manifest = readJson(path.join(surface, "asset-manifest.json"));
  assert.equal(manifest.schema, "origin.assets/v1");
  assert.ok(manifest.files.length >= 20, "expected the full app surface");

  const listed = new Set(manifest.files.map((file) => file.path));
  for (const required of [
    "index.html",
    "app.js",
    "core.js",
    "policy.js",
    "state.js",
    "styles.css",
    "wasm.js",
    "origin_core.wasm",
    "data/core.json",
    "data/registry.json",
    "data/build.json",
    "manifest.webmanifest",
    "sw.js",
  ]) {
    assert.ok(listed.has(required), `asset manifest is missing ${required}`);
  }

  for (const file of manifest.files) {
    const full = path.join(mobileRoot, surface, file.path);
    assert.ok(fs.existsSync(full), `manifest lists a missing file: ${file.path}`);
    const bytes = fs.readFileSync(full);
    assert.equal(bytes.length, file.bytes, `size mismatch for ${file.path}`);
    assert.equal(sha256(bytes), file.sha256, `sha256 mismatch for ${file.path}`);
  }
});

test("the embedded Rust core is the one the manifest describes", { skip: !surface && "no built web surface" }, () => {
  const meta = readJson(path.join(surface, "data/core.json"));
  assert.equal(meta.engine, "rust");
  assert.equal(meta.target, "wasm32-unknown-unknown");
  assert.equal(meta.version, "0.0.1");

  const wasm = fs.readFileSync(path.join(mobileRoot, surface, "origin_core.wasm"));
  assert.equal(wasm.length, meta.bytes);
  assert.equal(sha256(wasm), meta.sha256);
  assert.equal(wasm.subarray(0, 4).toString("hex"), "0061736d", "not a WebAssembly module");

  const embed = fs.readFileSync(path.join(mobileRoot, surface, "wasm.js"), "utf8");
  assert.match(embed, new RegExp(`sha256=${meta.sha256}`));
  assert.ok(
    embed.includes(JSON.stringify(wasm.toString("base64"))),
    "wasm.js does not embed the exact core bytes"
  );

  const build = readJson(path.join(surface, "data/build.json"));
  assert.equal(build.core.sha256, meta.sha256);
  assert.deepEqual(build.privacy, {
    permissions: [],
    network: false,
    accounts: false,
    telemetry: false,
  });
});

test("the app scripts contain no network client", { skip: !surface && "no built web surface" }, () => {
  // sw.js is a cache worker: it may fetch same-origin files to stay offline.
  // Every other script is plain computation over local data.
  const scripts = ["app.js", "core.js", "policy.js", "state.js"];
  const network = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.onLine/;
  const stripComments = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const name of scripts) {
    const text = stripComments(fs.readFileSync(path.join(mobileRoot, surface, name), "utf8"));
    assert.doesNotMatch(text, network, `${name} must not contain a network client`);
    assert.doesNotMatch(text, /import\s*\(/, `${name} must stay a classic script for file://`);
  }

  const sw = fs.readFileSync(path.join(mobileRoot, surface, "sw.js"), "utf8");
  assert.match(sw, /self\.addEventListener\("fetch"/);
  assert.doesNotMatch(sw, /https?:\/\//, "the service worker must only touch same-origin assets");
});

test("the source manifest requests zero permissions", () => {
  const xml = fs.readFileSync(
    path.join(mobileRoot, "app/src/main/AndroidManifest.xml"),
    "utf8"
  );
  assert.doesNotMatch(xml, /<uses-permission/);
  assert.doesNotMatch(xml, /android\.permission\./);
  assert.match(xml, /android:minSdkVersion="29"/);
  assert.match(xml, /android:targetSdkVersion="34"/);
  assert.match(xml, /android:allowBackup="false"/);
  assert.match(xml, /android:usesCleartextTraffic="false"/);
});

test("the built APK contains the offline app and no permissions", {
  skip: !haveApk ? "build/OriginLabs-0.0.1.apk has not been built" : !haveZip ? "unzip is unavailable" : false,
}, () => {
  const entries = execFileSync("unzip", ["-Z1", apkPath], { encoding: "utf8" })
    .trim()
    .split("\n");
  for (const required of [
    "AndroidManifest.xml",
    "classes.dex",
    "resources.arsc",
    "assets/www/index.html",
    "assets/www/app.js",
    "assets/www/wasm.js",
    "assets/www/origin_core.wasm",
    "assets/www/data/core.json",
    "assets/www/data/registry.json",
  ]) {
    assert.ok(entries.includes(required), `APK is missing ${required}`);
  }
  assert.ok(
    entries.some((entry) => entry.startsWith("assets/www/sw.js")),
    "APK is missing the service worker"
  );

  // A permission string would be stored UTF-16 inside the binary XML manifest.
  const binaryManifest = execFileSync("unzip", ["-p", apkPath, "AndroidManifest.xml"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(
    binaryManifest.includes(Buffer.from("android.permission", "utf16le")),
    false,
    "the APK declares a permission"
  );

  const apkCore = execFileSync("unzip", ["-p", apkPath, "assets/www/origin_core.wasm"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const meta = readJson(path.join(surface, "data/core.json"));
  assert.equal(sha256(apkCore), meta.sha256, "APK embeds a different Rust core");
});

test("the APK signature verifies", {
  skip: !haveApk ? "APK has not been built" : false,
}, () => {
  let output;
  try {
    output = execFileSync("apksigner", ["verify", "--verbose", "--print-certs", apkPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    assert.fail(`apksigner rejected the APK: ${error.stderr || error.message}`);
  }
  assert.match(output, /Verified using v2 scheme \(APK Signature Scheme v2\): true|Verified using v3 scheme \(APK Signature Scheme v3\): true/);
  assert.match(output, /Number of signers: 1/);
});
