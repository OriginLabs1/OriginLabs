import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { loadRegistry } from "../src/registry/load.mjs";

const ROOT = fileURLToPath(new URL("../registry/", import.meta.url));

test("registry validates and matches its declared counts", () => {
  const result = loadRegistry(ROOT);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.index.schema, "origin.registry/v1");
  assert.equal(result.index.counts.skills, 13);
  assert.equal(result.index.counts.tools, 20);
  assert.equal(result.index.counts.workflows, 8);
  assert.equal(result.index.counts.models, 8);
  assert.equal(result.entries.length, 49);
});

test("every registered capability is free to use and has no paid path", () => {
  const { entries } = loadRegistry(ROOT);

  for (const entry of entries) {
    if (entry.kind === "tool" || entry.kind === "model") {
      assert.equal(entry.free_to_use, true, `${entry.id} must be free_to_use`);
      assert.equal(entry.requires_paid_service, false, `${entry.id} must not require payment`);
    }
  }

  const models = entries.filter((entry) => entry.kind === "model");
  assert.ok(models.length > 0);
  for (const model of models) {
    assert.ok(["T0", "T1", "T2", "T3"].includes(model.tier), `${model.id} tier`);
    assert.ok(["OSI", "non-OSI", "proprietary"].includes(model.license_class));
    if (model.status === "active") {
      assert.equal(model.license_class, "OSI", `${model.id}: active must be OSI`);
    }
  }
});

test("every skill has an eval and every workflow has outputs", () => {
  const { entries } = loadRegistry(ROOT);

  for (const skill of entries.filter((entry) => entry.kind === "skill")) {
    assert.ok(Array.isArray(skill.evals) && skill.evals.length > 0, `${skill.id} eval`);
    assert.ok(skill.outputs.length > 0, `${skill.id} outputs`);
  }

  for (const workflow of entries.filter((entry) => entry.kind === "workflow")) {
    assert.ok(workflow.stages.length > 0, `${workflow.id} stages`);
    assert.ok(workflow.outputs.length > 0, `${workflow.id} outputs`);
  }
});

test("ids are unique across every kind", () => {
  const { entries } = loadRegistry(ROOT);
  const ids = entries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});
