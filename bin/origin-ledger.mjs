#!/usr/bin/env node
// origin-ledger — zero-dependency ledger CLI for OriginLabs v0.0.1.
//
//   origin-ledger verify [--file .origin/events.jsonl] [--strict] [--json]
//   origin-ledger head   [--file .origin/events.jsonl]
//   origin-ledger append --type <type> --payload '<json>' [--actor <id>] [--data-class 0..4]
//   origin-ledger anchor [--file .origin/events.jsonl]

import fs from "node:fs";
import path from "node:path";

import { readLedger, appendEvent, headOf } from "../src/ledger/append.mjs";
import { verifyChain } from "../src/ledger/verify.mjs";

const DEFAULT_LEDGER = path.join(".origin", "events.jsonl");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

function ledgerPath(options) {
  return path.resolve(process.cwd(), options.file ?? DEFAULT_LEDGER);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function commandVerify(options) {
  const file = ledgerPath(options);
  let events;
  try {
    events = readLedger(file);
  } catch (error) {
    fail(`FAIL  ${error.message}`);
    return;
  }

  const result = verifyChain(events, { strict: options.strict === true });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ file, ...result }, null, 2)}\n`);
  } else if (result.ok) {
    const anchor = result.anchored
      ? " · 1 legacy anchor (pre-v1 hash is trust-on-first-use)"
      : "";
    process.stdout.write(
      `OK  ${file}\n` +
        `    events ${result.events} · verified ${result.verified} · legacy ${result.legacy}${anchor}\n` +
        `    head ${result.head}\n`,
    );
  } else if (result.breaks.length > 0) {
    const first = result.breaks[0];
    process.stdout.write(`FAIL  ${file}\n`);
    process.stdout.write(`    first break at seq ${first.seq}: ${first.reason}\n`);
    if (first.expected !== undefined) process.stdout.write(`    expected ${first.expected}\n`);
    if (first.actual !== undefined) process.stdout.write(`    actual   ${first.actual}\n`);
    if (first.detail) process.stdout.write(`    detail   ${first.detail}\n`);
  } else {
    process.stdout.write(
      `FAIL  ${file}\n    strict mode: ${result.legacy} legacy event(s) are not verifiable\n`,
    );
  }

  if (!result.ok) process.exitCode = 1;
}

function commandHead(options) {
  const file = ledgerPath(options);
  const head = headOf(file);
  process.stdout.write(`${JSON.stringify({ file, ...head }, null, 2)}\n`);
}

function commandAppend(options) {
  const file = ledgerPath(options);
  if (typeof options.type !== "string") {
    fail("append requires --type <event.type>");
    return;
  }

  let payload = {};
  if (options.payload !== undefined) {
    try {
      payload = JSON.parse(options.payload);
    } catch (error) {
      fail(`--payload is not valid JSON: ${error.message}`);
      return;
    }
  }

  const dataClass = options["data-class"] === undefined ? 0 : Number(options["data-class"]);

  try {
    const record = appendEvent({
      file,
      type: options.type,
      payload,
      actor: typeof options.actor === "string" ? options.actor : "local",
      dataClass,
    });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  } catch (error) {
    fail(`append failed: ${error.message}`);
  }
}

function commandAnchor(options) {
  const file = ledgerPath(options);
  let events;
  try {
    events = readLedger(file);
  } catch (error) {
    fail(`FAIL  ${error.message}`);
    return;
  }

  const result = verifyChain(events);
  if (!result.ok) {
    fail("refusing to anchor a broken ledger");
    return;
  }

  const directory = path.join(path.dirname(file), "checkpoints");
  fs.mkdirSync(directory, { recursive: true });
  const anchorFile = path.join(directory, `anchor-${String(result.events).padStart(6, "0")}.json`);
  const anchor = {
    schema: "origin.anchor/v1",
    seq: result.events,
    hash: result.head,
    at: new Date().toISOString(),
    verified: result.verified,
    legacy: result.legacy,
  };
  fs.writeFileSync(anchorFile, `${JSON.stringify(anchor, null, 2)}\n`);
  process.stdout.write(`${anchorFile}\n`);
}

function main() {
  const [command = "verify", ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);

  switch (command) {
    case "verify":
      commandVerify(options);
      break;
    case "head":
      commandHead(options);
      break;
    case "append":
      commandAppend(options);
      break;
    case "anchor":
      commandAnchor(options);
      break;
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(
        "origin-ledger <verify|head|append|anchor> [options]\n" +
          "  --file <path>        ledger file (default .origin/events.jsonl)\n" +
          "  --strict             fail on legacy events\n" +
          "  --json               machine-readable verify output\n" +
          "  --type <type>        event type (append)\n" +
          "  --payload <json>     event payload (append)\n" +
          "  --actor <id>         actor id (append, default local)\n" +
          "  --data-class <0..4>  data class (append, default 0)\n",
      );
      break;
    default:
      fail(`unknown command: ${command}\nTry: origin-ledger help`);
  }
}

main();
