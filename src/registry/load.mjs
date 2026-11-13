// Registry loader + validator. The registry is plain JSON so it can be
// read, diffed and audited without the Coordinator.

import fs from "node:fs";
import path from "node:path";

export const REGISTRY_SCHEMA = "origin.registry/v1";

const KINDS = new Set(["skill", "tool", "workflow", "model"]);
const STATUSES = new Set(["active", "probation", "retired"]);
const TIERS = new Set(["T0", "T1", "T2", "T3"]);
const LICENSE_CLASSES = new Set(["OSI", "non-OSI", "proprietary"]);
const APPROVALS = new Set(["none", "principal", "two-key"]);
const SIDE_EFFECTS = new Set(["none", "local-write", "network"]);
const FAILURES = new Set(["halt", "retry", "fallback"]);

function requireFields(item, fields, errors, label) {
  for (const field of fields) {
    if (item[field] === undefined || item[field] === null || item[field] === "") {
      errors.push(`${label}: missing required field "${field}"`);
    }
  }
}

function validateSkill(item, errors) {
  requireFields(
    item,
    ["id", "name", "version", "status", "intent", "trigger", "outputs", "evidence_bar", "owner", "spec_ref"],
    errors,
    item.id ?? "skill",
  );
  if (!Array.isArray(item.outputs) || item.outputs.length === 0) {
    errors.push(`${item.id}: outputs must be a non-empty array`);
  }
  if (!Array.isArray(item.evals) || item.evals.length === 0) {
    errors.push(`${item.id}: every skill needs at least one eval`);
  }
}

function validateTool(item, errors) {
  requireFields(
    item,
    ["id", "name", "version", "status", "transport", "side_effects", "data_class_max", "approval", "failure", "free_to_use", "requires_paid_service", "spec_ref"],
    errors,
    item.id ?? "tool",
  );
  if (!SIDE_EFFECTS.has(item.side_effects)) errors.push(`${item.id}: invalid side_effects`);
  if (!APPROVALS.has(item.approval)) errors.push(`${item.id}: invalid approval`);
  if (!FAILURES.has(item.failure)) errors.push(`${item.id}: invalid failure mode`);
  if (!Number.isInteger(item.data_class_max) || item.data_class_max < 0 || item.data_class_max > 4) {
    errors.push(`${item.id}: data_class_max must be 0..4`);
  }
  if (item.free_to_use !== true) errors.push(`${item.id}: free_to_use must be true`);
  if (item.requires_paid_service !== false) errors.push(`${item.id}: requires_paid_service must be false`);
}

function validateWorkflow(item, errors) {
  requireFields(
    item,
    ["id", "name", "version", "status", "trigger", "stages", "gates", "budgets", "outputs", "spec_ref"],
    errors,
    item.id ?? "workflow",
  );
  if (!Array.isArray(item.stages) || item.stages.length === 0) errors.push(`${item.id}: stages required`);
  if (!Array.isArray(item.outputs) || item.outputs.length === 0) errors.push(`${item.id}: outputs required`);
}

function validateModel(item, errors) {
  requireFields(
    item,
    ["id", "family", "tier", "license", "license_class", "status", "free_to_use", "requires_paid_service", "serving", "spec_ref"],
    errors,
    item.id ?? "model",
  );
  if (!TIERS.has(item.tier)) errors.push(`${item.id}: invalid tier`);
  if (!LICENSE_CLASSES.has(item.license_class)) errors.push(`${item.id}: invalid license_class`);
  if (item.free_to_use !== true) errors.push(`${item.id}: free_to_use must be true`);
  if (item.requires_paid_service !== false) errors.push(`${item.id}: requires_paid_service must be false`);
  if (item.status === "active" && item.license_class !== "OSI") {
    errors.push(`${item.id}: an active default model must be OSI-licensed`);
  }
  if (item.status === "active" && (!item.digest || Object.keys(item.evals ?? {}).length === 0)) {
    errors.push(`${item.id}: an active model needs a pinned digest and eval scores`);
  }
}

const VALIDATORS = {
  skill: validateSkill,
  tool: validateTool,
  workflow: validateWorkflow,
  model: validateModel,
};

export function loadRegistry(root) {
  const indexPath = path.join(root, "index.json");
  const errors = [];
  const entries = [];

  if (!fs.existsSync(indexPath)) {
    return { ok: false, errors: [`missing registry index: ${indexPath}`], entries, index: null };
  }

  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch (error) {
    return { ok: false, errors: [`invalid registry index JSON: ${error.message}`], entries, index: null };
  }

  if (index.schema !== REGISTRY_SCHEMA) {
    errors.push(`index: expected schema ${REGISTRY_SCHEMA}`);
  }
  if (!Array.isArray(index.entries)) {
    return { ok: false, errors: [...errors, "index: entries must be an array"], entries, index };
  }

  const seen = new Set();
  for (const ref of index.entries) {
    if (!KINDS.has(ref.kind)) {
      errors.push(`index: invalid kind "${ref.kind}" for ${ref.id}`);
      continue;
    }
    if (seen.has(ref.id)) {
      errors.push(`index: duplicate id ${ref.id}`);
      continue;
    }
    seen.add(ref.id);

    const file = path.join(root, ref.path);
    if (!fs.existsSync(file)) {
      errors.push(`${ref.id}: missing file ${ref.path}`);
      continue;
    }

    let item;
    try {
      item = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${ref.id}: invalid JSON: ${error.message}`);
      continue;
    }

    if (item.id !== ref.id) errors.push(`${ref.id}: id does not match index (${item.id})`);
    if (item.kind !== ref.kind) errors.push(`${ref.id}: kind does not match index (${item.kind})`);
    if (!STATUSES.has(item.status)) errors.push(`${ref.id}: invalid status`);

    VALIDATORS[ref.kind](item, errors);
    entries.push(item);
  }

  for (const [kind, count] of Object.entries(index.counts ?? {})) {
    const singular = kind.endsWith("s") ? kind.slice(0, -1) : kind;
    const actual = entries.filter((entry) => entry.kind === singular).length;
    if (actual !== count) errors.push(`index: counts.${kind} says ${count}, found ${actual}`);
  }

  return { ok: errors.length === 0, errors, entries, index };
}

export function assertRegistry(root) {
  const result = loadRegistry(root);
  if (!result.ok) {
    throw new Error(`registry validation failed:\n- ${result.errors.join("\n- ")}`);
  }
  return result;
}
