// Assemble the OriginLabs release directory.
//
// Reads the built APK, web surface and both core builds, then writes:
//   OriginLabs-<v>.apk                 signed package
//   OriginLabs-<v>.apk.sha256          digest only
//   SHA256SUMS                         all assets, sha256sum -c format
//   signing-certificate.txt            apksigner/keytool output
//   release-manifest.json              machine-readable release index
//   originlabs-<v>.cdx.json            CycloneDX 1.5 SBOM
//   OriginLabs-<v>-web.zip             static PWA archive
//   origin-core-<v>-wasm32.wasm        trust core for other clients
//   origin-core-<v>-<arch>.tar.gz?     no: raw native CLI binary
//
// No external dependencies: Node standard library plus the Android CLI tools
// that are already required to build the APK.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const project = path.resolve(mobile, "..");
const release = path.resolve(mobile, "release");

const read = (relative) => fs.readFileSync(path.resolve(mobile, relative));
const readJson = (relative) => JSON.parse(read(relative).toString("utf8"));
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const sha256File = (file) => sha256(fs.readFileSync(file));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return {
    ok: result.status === 0,
    out: `${result.stdout || ""}${result.stderr || ""}`.trim(),
  };
}

function toolVersion(command, args = ["--version"]) {
  // rustup installs outside the non-login PATH used by GUI/CI shells.
  const cargoBin = path.join(process.env.HOME || "", ".cargo/bin", command);
  const bin = fs.existsSync(cargoBin) ? cargoBin : command;
  const result = run(bin, args);
  if (!result.ok || !result.out) return "unknown";
  return result.out.split("\n")[0].trim();
}

function requireFile(relative, hint) {
  const file = path.resolve(mobile, relative);
  if (!fs.existsSync(file)) {
    console.error(`Missing ${relative}. ${hint}`);
    process.exit(1);
  }
  return file;
}

// ---------------------------------------------------------------- inputs

const manifestFile = requireFile(
  "app/src/main/AndroidManifest.xml",
  "The Android shell is part of the repository.",
);
const androidManifest = fs.readFileSync(manifestFile, "utf8");
const versionName = (androidManifest.match(/android:versionName="([^"]+)"/) || [])[1];
const versionCode = (androidManifest.match(/android:versionCode="(\d+)"/) || [])[1];
const minSdk = (androidManifest.match(/android:minSdkVersion="(\d+)"/) || [])[1];
const targetSdk = (androidManifest.match(/android:targetSdkVersion="(\d+)"/) || [])[1];
if (!versionName || !versionCode) {
  console.error("Could not read versionName/versionCode from AndroidManifest.xml");
  process.exit(1);
}

const apk = requireFile(
  `build/OriginLabs-${versionName}.apk`,
  "Run scripts/build-apk.sh first.",
);
const wasm = requireFile(
  "build/origin_core.wasm",
  "Run scripts/build-wasm.sh first.",
);
const nativeCore = requireFile(
  "build/origin-core",
  "Run scripts/build-wasm.sh first (cargo build --release).",
);
requireFile("site/app/index.html", "Run node scripts/build-web.mjs first.");
const site = path.resolve(mobile, "site/app");

const build = readJson("web/data/build.json");
const core = readJson("web/data/core.json");
const demo = readJson("web/data/demo.json");
const assetManifest = readJson("site/app/asset-manifest.json");
const registry = readJson("web/data/registry.json");

if (build.app.version !== versionName) {
  console.error(
    `Version mismatch: manifest says ${versionName}, build.json says ${build.app.version}`,
  );
  process.exit(1);
}
if (build.core.sha256 !== core.sha256) {
  console.error("build.json and core.json disagree about the Rust core digest.");
  process.exit(1);
}

const builtAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const archMap = { arm64: "aarch64", x64: "x86_64", ia32: "i686", arm: "armv7" };
const hostArch = archMap[process.arch] || process.arch;
const nativeName = `origin-core-${versionName}-${hostArch}-unknown-linux-gnu`;

// ------------------------------------------------------------- signature

const verify = run("apksigner", ["verify", "--verbose", "--print-certs", apk]);
if (!verify.ok) {
  console.error("apksigner rejected the APK:\n" + verify.out);
  process.exit(1);
}
const certMatch = verify.out.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/i);
if (!certMatch) {
  console.error("Could not read the signer certificate from apksigner.");
  process.exit(1);
}
const certSha256 = certMatch[1].toLowerCase();
const certPretty = certSha256.match(/.{2}/g).join(":").toUpperCase();
const schemes = ["v1", "v2", "v3"]
  .map((scheme) => {
    const match = verify.out.match(
      new RegExp(`Verified using ${scheme} scheme[^:]*:\\s*(true|false)`),
    );
    return match && match[1] === "true" ? scheme : null;
  })
  .filter(Boolean);

const keytoolOutput = path.resolve(mobile, "keys/signing-certificate.txt");
const signingCertificate = [
  `OriginLabs ${versionName} signer`,
  `certificate SHA-256: ${certPretty}`,
  `certificate SHA-256 (plain): ${certSha256}`,
  `signature schemes: ${schemes.join(", ") || "unknown"}`,
  "",
  verify.out,
  "",
  fs.existsSync(keytoolOutput) ? fs.readFileSync(keytoolOutput, "utf8").trim() : "",
  "",
].join("\n");

// -------------------------------------------------------------- git state

let git = { commit: "unknown", dirty: null };
const gitCommit = run("git", ["rev-parse", "HEAD"], { cwd: project });
if (gitCommit.ok) {
  git.commit = gitCommit.out.split("\n")[0];
  const status = run("git", ["status", "--porcelain"], { cwd: project });
  if (status.ok) git.dirty = status.out.length > 0;
}

// ------------------------------------------------------------------ zip

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

fs.rmSync(release, { recursive: true, force: true });
fs.mkdirSync(release, { recursive: true });

const webFiles = walk(site);
const webZip = path.join(release, `OriginLabs-${versionName}-web.zip`);
const zip = run("zip", ["-q", "-X", webZip, ...webFiles], { cwd: site });
if (!zip.ok) {
  console.error("Could not create the web archive:\n" + zip.out);
  process.exit(1);
}

// ------------------------------------------------------------- artifacts

const artifacts = [
  {
    kind: "android-package",
    name: `OriginLabs-${versionName}.apk`,
    from: apk,
  },
  {
    kind: "web-archive",
    name: `OriginLabs-${versionName}-web.zip`,
    from: webZip,
  },
  {
    kind: "wasm-core",
    name: `origin-core-${versionName}-wasm32-unknown-unknown.wasm`,
    from: wasm,
  },
  {
    kind: "native-core",
    name: nativeName,
    from: nativeCore,
  },
];

const copied = artifacts.map((artifact) => {
  const target = path.join(release, artifact.name);
  fs.copyFileSync(artifact.from, target);
  return {
    kind: artifact.kind,
    name: artifact.name,
    bytes: fs.statSync(target).size,
    sha256: sha256File(target),
  };
});

const apkInfo = copied.find((artifact) => artifact.kind === "android-package");
fs.writeFileSync(
  path.join(release, `OriginLabs-${versionName}.apk.sha256`),
  `${apkInfo.sha256}  ${apkInfo.name}\n`,
);
fs.writeFileSync(path.join(release, "signing-certificate.txt"), signingCertificate);

// ------------------------------------------------------------------ SBOM

const tools = [
  ["node", toolVersion("node", ["--version"])],
  ["rustc", toolVersion("rustc", ["--version"])],
  ["cargo", toolVersion("cargo", ["--version"])],
  ["java", toolVersion("java", ["-version"])],
  ["javac", toolVersion("javac", ["-version"])],
  ["aapt2", toolVersion("aapt2", ["version"])],
  ["apksigner", toolVersion("apksigner", ["version"])],
  ["d8", toolVersion("java", ["-cp", path.join(mobile, "toolchain/r8.jar"), "com.android.tools.r8.D8", "--version"])],
];

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: builtAt,
    tools: {
      components: tools.map(([name, version]) => ({
        type: "application",
        name,
        version,
      })),
    },
    component: {
      type: "application",
      "bom-ref": `pkg:android/${build.app.package}@${versionName}`,
      name: "OriginLabs",
      version: versionName,
      description:
        "Local-first, FOSS-only research ledger for Android. Rust trust core, zero permissions.",
      licenses: [{ license: { id: "MIT" } }],
      hashes: [{ alg: "SHA-256", content: apkInfo.sha256 }],
      externalReferences: [
        { type: "vcs", url: "https://github.com/OriginLabs1/OriginLabs" },
        {
          type: "distribution",
          url: "https://github.com/OriginLabs1/OriginLabs/releases/latest",
        },
      ],
      properties: [
        { name: "android:package", value: build.app.package },
        { name: "android:versionCode", value: String(versionCode) },
        { name: "android:minSdk", value: String(minSdk) },
        { name: "android:targetSdk", value: String(targetSdk) },
        { name: "android:permissions", value: "none" },
        { name: "origin:network", value: "none" },
        { name: "origin:telemetry", value: "none" },
      ],
    },
  },
  components: [
    {
      type: "library",
      "bom-ref": "origin-core-native",
      name: "origin-core",
      version: core.version,
      description:
        "Rust trust core: canonical JSON, SHA-256, v1 event construction and chain verification. No third-party crates.",
      licenses: [{ license: { id: "MIT" } }],
      hashes: [{ alg: "SHA-256", content: sha256File(nativeCore) }],
      properties: [
        { name: "origin:language", value: "rust" },
        { name: "origin:target", value: `${hostArch}-unknown-linux-gnu` },
        { name: "origin:dependencies", value: "none" },
      ],
    },
    {
      type: "library",
      "bom-ref": "origin-core-wasm",
      name: "origin-core-wasm",
      version: core.version,
      description: "The same Rust core compiled to wasm32-unknown-unknown and embedded in the app.",
      licenses: [{ license: { id: "MIT" } }],
      hashes: [{ alg: "SHA-256", content: core.sha256 }],
      properties: [
        { name: "origin:target", value: core.target },
        { name: "origin:bytes", value: String(core.bytes) },
        { name: "origin:imports", value: "none" },
      ],
    },
    {
      type: "application",
      "bom-ref": "originlabs-web",
      name: "OriginLabs web surface",
      version: versionName,
      description:
        "Vanilla HTML/CSS/JS PWA. Classic scripts, no framework, no runtime dependency.",
      licenses: [{ license: { id: "MIT" } }],
      hashes: [
        { alg: "SHA-256", content: sha256File(path.join(site, "asset-manifest.json")) },
      ],
      properties: [
        { name: "origin:assets", value: String(assetManifest.files.length) },
        { name: "origin:dependencies", value: "none" },
      ],
    },
    {
      type: "data",
      "bom-ref": "origin-registry",
      name: "OriginLabs capability registry",
      version: registry.version,
      description: "Embedded FOSS-only capability snapshot: skills, tools, workflows and models.",
      licenses: [{ license: { id: "MIT" } }],
      hashes: [{ alg: "SHA-256", content: build.registry.sha256 }],
      properties: [
        { name: "origin:skills", value: String(registry.counts.skills) },
        { name: "origin:tools", value: String(registry.counts.tools) },
        { name: "origin:workflows", value: String(registry.counts.workflows) },
        { name: "origin:models", value: String(registry.counts.models) },
      ],
    },
  ],
  dependencies: [
    {
      ref: `pkg:android/${build.app.package}@${versionName}`,
      dependsOn: ["origin-core-native", "origin-core-wasm", "originlabs-web", "origin-registry"],
    },
  ],
};
fs.writeFileSync(
  path.join(release, `originlabs-${versionName}.cdx.json`),
  JSON.stringify(sbom, null, 2) + "\n",
);

// -------------------------------------------------------------- manifest

const assetFiles = fs
  .readdirSync(release)
  .filter((name) => name !== "SHA256SUMS")
  .sort();

const sums = assetFiles.map((name) => `${sha256File(path.join(release, name))}  ${name}`);
fs.writeFileSync(path.join(release, "SHA256SUMS"), sums.join("\n") + "\n");

const releaseManifest = {
  schema: "origin.release/v1",
  app: {
    name: build.app.name,
    package: build.app.package,
    label: "OriginLabs",
    version: versionName,
    versionCode: Number(versionCode),
    minSdk: Number(minSdk),
    targetSdk: Number(targetSdk),
    permissions: [],
  },
  tag: `v${versionName}`,
  builtAt,
  git,
  core: {
    engine: core.engine,
    version: core.version,
    target: core.target,
    sha256: core.sha256,
    bytes: core.bytes,
  },
  registry: {
    version: registry.version,
    counts: registry.counts,
    sha256: build.registry.sha256,
  },
  demo: {
    events: demo.events.length,
    head: demo.meta.head,
  },
  web: {
    assets: assetManifest.files.length,
    manifestSha256: sha256File(path.join(site, "asset-manifest.json")),
  },
  signature: {
    schemes,
    certificateSha256: certSha256,
    certificateSha256Pretty: certPretty,
  },
  assets: [
    ...copied,
    ...assetFiles
      .filter((name) => !copied.some((artifact) => artifact.name === name))
      .map((name) => ({
        kind: name === "SHA256SUMS" || name.endsWith(".sha256") ? "checksum" : name.endsWith(".cdx.json") ? "sbom" : "metadata",
        name,
        bytes: fs.statSync(path.join(release, name)).size,
        sha256: sha256File(path.join(release, name)),
      })),
  ],
  links: {
    repository: "https://github.com/OriginLabs1/OriginLabs",
    releases: "https://github.com/OriginLabs1/OriginLabs/releases/latest",
    site: "https://originlabs1.github.io/OriginLabs/",
    obtainium:
      "https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/OriginLabs1/OriginLabs",
  },
  license: "MIT",
  sbom: `originlabs-${versionName}.cdx.json`,
};

fs.writeFileSync(
  path.join(release, "release-manifest.json"),
  JSON.stringify(releaseManifest, null, 2) + "\n",
);

// SHA256SUMS must include the metadata written after the first pass.
const finalFiles = fs.readdirSync(release).filter((name) => name !== "SHA256SUMS").sort();
fs.writeFileSync(
  path.join(release, "SHA256SUMS"),
  finalFiles.map((name) => `${sha256File(path.join(release, name))}  ${name}`).join("\n") + "\n",
);

// ------------------------------------------------------------------ print

console.log(`Release ${versionName} (${versionCode}) → ${path.relative(project, release)}`);
console.log(`  APK       ${apkInfo.bytes} bytes  ${apkInfo.sha256}`);
console.log(`  signer    ${certPretty}`);
console.log(`  schemes   ${schemes.join(", ")}`);
console.log(`  core      ${core.sha256}`);
console.log(`  registry  ${build.registry.sha256}`);
console.log(`  assets    ${finalFiles.length + 1} files (including SHA256SUMS)`);
if (git.dirty) {
  console.warn("  warning   the git working tree is dirty; the release is not a clean tagged build");
}
console.log("\nVerify with: cd mobile/release && sha256sum -c SHA256SUMS");
