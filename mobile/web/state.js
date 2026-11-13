/*
 * Local workspace state for OriginLabs v0.0.1.
 *
 * The event log is authoritative. Everything the UI shows (claims, evidence,
 * gates, counts) is derived from the log on every change. Events are created
 * and verified by the Rust core; this file only decides *what* to ask it to
 * sign and persists the result in localStorage.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "originlabs.workspace.v1";
  var ZERO = "0000000000000000000000000000000000000000000000000000000000000000";
  var SCHEMA = "origin.mobile.workspace/v1";

  function jsonl(events) {
    return events.map(function (e) {
      return JSON.stringify(e);
    }).join("\n") + "\n";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function pad4(n) {
    return String(n).padStart(4, "0");
  }

  function nextId(prefix, map) {
    var max = 0;
    Object.keys(map || {}).forEach(function (id) {
      var m = /-(\d+)$/.exec(id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + "-" + pad4(max + 1);
  }

  function derive(state) {
    var model = {
      workspace: clone(state.workspace || {}),
      claims: {},
      claimOrder: [],
      evidence: {},
      evidenceOrder: [],
      charters: {},
      charterOrder: [],
      gates: [],
      artifacts: [],
      incidents: [],
      corrections: [],
      spec: null,
      counts: {
        events: 0,
        claims: 0,
        evidence: 0,
        charters: 0,
        gates: 0,
        artifacts: 0,
        incidents: 0,
        corrections: 0
      },
      lastEvent: null
    };

    var events = state.events || [];
    model.events = events;
    model.counts.events = events.length;
    model.lastEvent = events.length ? events[events.length - 1] : null;

    events.forEach(function (event) {
      var p = event.payload || {};
      switch (event.type) {
        case "workspace.created":
          model.workspace.name = p.name || model.workspace.name;
          model.workspace.owner = p.owner || model.workspace.owner;
          model.workspace.defaultDataClass =
            typeof p.defaultDataClass === "number" ? p.defaultDataClass : model.workspace.defaultDataClass;
          model.workspace.policy = p.policy || model.workspace.policy;
          break;
        case "spec.versioned":
          model.spec = p;
          break;
        case "charter.proposed":
          model.charters[p.charter] = {
            id: p.charter,
            title: p.title,
            question: p.question,
            whyNow: p.whyNow,
            program: p.program,
            scope: p.scope || {},
            risk: p.risk || { class: "low", dualUse: false, dataClassMax: 1 },
            evidenceBar: p.evidenceBar || "E2",
            budget: p.budget || {},
            stopConditions: p.stopConditions || [],
            owner: p.owner || "principal",
            status: "proposed",
            gates: [],
            proposedAt: event.at,
            proposedSeq: event.seq,
            event: event
          };
          model.charterOrder.push(p.charter);
          break;
        case "charter.approved":
          if (model.charters[p.charter]) {
            model.charters[p.charter].status = "active";
          }
          break;
        case "claim.created":
          model.claims[p.claim] = {
            id: p.claim,
            charter: p.charter,
            statement: p.statement,
            type: p.type || "analytical",
            status: p.status || "proposed",
            falsifier: p.falsifier,
            confidence: typeof p.confidence === "number" ? p.confidence : 0.5,
            limitations: p.limitations || [],
            supersedes: p.supersedes || null,
            evidence: [],
            transitions: [],
            corrections: [],
            createdAt: event.at,
            createdSeq: event.seq
          };
          model.claimOrder.push(p.claim);
          break;
        case "claim.transitioned":
          if (model.claims[p.claim]) {
            var claim = model.claims[p.claim];
            claim.status = p.to;
            claim.transitions.push({
              from: p.from,
              to: p.to,
              reason: p.reason,
              at: event.at,
              seq: event.seq,
              evidence: p.evidence || []
            });
          }
          break;
        case "evidence.recorded":
          model.evidence[p.evidence] = {
            id: p.evidence,
            claim: p.claim,
            grade: p.grade,
            kind: p.kind || "experiment",
            method: p.method,
            result: p.result,
            source: p.source || {},
            run: p.run || null,
            reproduces: !!p.reproduces,
            independent: !!p.independent,
            adversarial: !!p.adversarial,
            recordedBy: p.recordedBy || event.actor,
            limitations: p.limitations || [],
            at: event.at,
            seq: event.seq,
            dataClass: event.dataClass
          };
          model.evidenceOrder.push(p.evidence);
          if (model.claims[p.claim] && model.claims[p.claim].evidence.indexOf(p.evidence) < 0) {
            model.claims[p.claim].evidence.push(p.evidence);
          }
          break;
        case "gate.decided":
          model.gates.push({
            gate: p.gate,
            charter: p.charter,
            decision: p.decision,
            signers: p.signers || [],
            packet: p.packet || null,
            reasons: p.reasons || [],
            at: event.at,
            seq: event.seq,
            hash: event.hash,
            event: event
          });
          if (model.charters[p.charter]) {
            model.charters[p.charter].gates.push(model.gates[model.gates.length - 1]);
            if (p.gate === "frame" && p.decision === "approve") {
              model.charters[p.charter].status = "active";
            }
          }
          break;
        case "artifact.published":
          model.artifacts.push({
            id: p.artifact,
            kind: p.kind,
            title: p.title,
            claims: p.claims || [],
            summary: p.summary,
            license: p.license,
            reuse: p.reuse,
            maintainer: p.maintainer,
            limitations: p.limitations || [],
            at: event.at,
            seq: event.seq
          });
          break;
        case "incident.opened":
          model.incidents.push({
            id: p.incident,
            title: p.title,
            severity: p.severity,
            status: p.status,
            claim: p.claim,
            summary: p.summary,
            at: event.at,
            seq: event.seq
          });
          break;
        case "correction.appended":
          var correction = {
            id: p.correction,
            target: p.target,
            reason: p.reason,
            evidence: p.evidence,
            at: event.at,
            seq: event.seq
          };
          model.corrections.push(correction);
          if (model.claims[p.target]) model.claims[p.target].corrections.push(correction);
          break;
      }
    });

    model.counts.claims = model.claimOrder.length;
    model.counts.evidence = model.evidenceOrder.length;
    model.counts.charters = model.charterOrder.length;
    model.counts.gates = model.gates.length;
    model.counts.artifacts = model.artifacts.length;
    model.counts.incidents = model.incidents.length;
    model.counts.corrections = model.corrections.length;
    model.counts.supported = model.claimOrder.filter(function (id) {
      return ["supported", "established"].indexOf(model.claims[id].status) >= 0;
    }).length;
    model.head = events.length ? events[events.length - 1].hash : ZERO;
    return model;
  }

  function PolicyError(errors) {
    var err = new Error(errors.join(" "));
    err.name = "PolicyError";
    err.errors = errors;
    return err;
  }

  function Store(core) {
    this.core = core;
    this.state = null;
    this.model = null;
    this.storageAvailable = true;
    this.load();
  }

  Store.prototype.load = function () {
    var raw = null;
    try {
      raw = root.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      this.storageAvailable = false;
    }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.schema === SCHEMA && Array.isArray(parsed.events) && parsed.events.length) {
          this.state = parsed;
          this.model = derive(this.state);
          return true;
        }
      } catch (e) {
        /* fall through to an empty workspace */
      }
    }
    this.state = null;
    this.model = null;
    return false;
  };

  Store.prototype.hasWorkspace = function () {
    return !!(this.state && this.state.events && this.state.events.length);
  };

  Store.prototype.save = function () {
    if (!this.storageAvailable) return false;
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      return true;
    } catch (e) {
      this.storageAvailable = false;
      return false;
    }
  };

  Store.prototype.refresh = function () {
    this.model = derive(this.state);
    return this.model;
  };

  Store.prototype.verify = function () {
    var result = this.core.verify(jsonl(this.state.events));
    if (result.ok) {
      this.state.meta.lastVerifiedAt = nowIso();
      this.state.meta.lastVerifyOk = true;
      this.save();
    } else {
      this.state.meta.lastVerifyOk = false;
      this.save();
    }
    return result;
  };

  Store.prototype.tamperTest = function () {
    var lines = this.state.events.map(function (e) {
      return JSON.stringify(e);
    });
    if (!lines.length) throw new Error("There are no events to test");
    var index = lines.length - 1;
    var victim = JSON.parse(lines[index]);
    victim.payload = clone(victim.payload || {});
    victim.payload["tamper_probe"] = "altered after signing";
    lines[index] = JSON.stringify(victim);
    var broken = this.core.verify(lines.join("\n") + "\n");
    var clean = this.core.verify(jsonl(this.state.events));
    return { clean: clean, broken: broken, seq: victim.seq };
  };

  Store.prototype.append = function (type, payload, dataClass, actor) {
    if (!this.state) throw new Error("No workspace is open");
    actor = actor || "principal";
    dataClass = typeof dataClass === "number" ? dataClass : 0;
    var check = root.OriginPolicy.validateEvent(
      { type: type, payload: payload, dataClass: dataClass, actor: actor },
      this.model
    );
    if (!check.ok) throw PolicyError(check.errors);

    var events = this.state.events;
    var last = events.length ? events[events.length - 1] : null;
    var event = this.core.buildEvent({
      seq: last ? last.seq + 1 : 1,
      at: nowIso(),
      type: type,
      actor: actor,
      dataClass: dataClass,
      payload: payload,
      prev: last ? last.hash : ZERO
    });
    events.push(event);
    this.state.meta.updatedAt = nowIso();
    this.refresh();
    this.save();
    return event;
  };

  Store.prototype.exportBundle = function () {
    var events = this.state.events;
    var ledger = jsonl(events);
    return {
      schema: "origin.mobile.bundle/v1",
      app: { name: "OriginLabs", version: "0.0.1", core: this.core.version },
      demo: !!this.state.workspace.demo,
      workspace: clone(this.state.workspace),
      events: clone(events),
      meta: {
        exportedAt: nowIso(),
        eventCount: events.length,
        head: events.length ? events[events.length - 1].hash : ZERO,
        ledgerSha256: this.core.sha256(ledger),
        note: "Exported by OriginLabs. Verify with the Rust core before importing."
      }
    };
  };

  Store.prototype.exportJSONL = function () {
    return jsonl(this.state.events);
  };

  Store.prototype.importText = function (text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) throw new Error("The selected file is empty");

    var events = [];
    var workspace = null;
    var demo = false;
    var legacy = [];

    if (trimmed.charAt(0) === "{") {
      var parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        throw new Error("That file is not valid JSON");
      }
      if (parsed && Array.isArray(parsed.events)) {
        events = parsed.events;
        workspace = parsed.workspace || null;
        demo = !!parsed.demo;
      } else if (parsed && parsed.schema === "origin.event/v1") {
        events = [parsed];
      } else {
        throw new Error("That JSON is not an OriginLabs bundle or event");
      }
    } else {
      var lines = trimmed.split(/\r?\n/).filter(function (line) {
        return line.trim().length;
      });
      events = lines.map(function (line, i) {
        try {
          return JSON.parse(line);
        } catch (e) {
          throw new Error("Line " + (i + 1) + " is not valid JSON");
        }
      });
    }

    if (!events.length) throw new Error("No events found");
    var result = this.core.verify(jsonl(events));
    if (!result.ok) {
      var reason = result.breaks && result.breaks[0] ? result.breaks[0].reason : "unknown break";
      throw new Error("The Rust core rejected this ledger: " + reason);
    }
    legacy = result.legacy || [];

    if (!workspace) {
      var created = events.filter(function (e) {
        return e.type === "workspace.created";
      })[0];
      workspace = {
        id: "ws_imported_" + Date.now().toString(36),
        name: created && created.payload && created.payload.name ? created.payload.name : "Imported lab",
        createdAt: events[0].at,
        owner: "principal",
        principal: "principal",
        defaultDataClass: 0,
        policy: "local-authoritative",
        demo: false
      };
    }
    workspace = Object.assign(
      {
        id: "ws_imported_" + Date.now().toString(36),
        name: "Imported lab",
        createdAt: events[0].at,
        owner: "principal",
        principal: "principal",
        defaultDataClass: 0,
        policy: "local-authoritative"
      },
      workspace
    );
    workspace.demo = !!demo;

    this.state = {
      schema: SCHEMA,
      workspace: workspace,
      events: events,
      meta: {
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastVerifiedAt: nowIso(),
        lastVerifyOk: true,
        importedLegacy: legacy
      }
    };
    this.refresh();
    this.save();
    return { events: events.length, head: result.head, legacy: legacy, workspace: workspace };
  };

  Store.prototype.loadDemo = function () {
    if (!root.ORIGIN_DEMO_BUNDLE) throw new Error("Demo bundle is not embedded");
    return this.importText(JSON.stringify(root.ORIGIN_DEMO_BUNDLE));
  };

  Store.prototype.newWorkspace = function (name) {
    var id = "ws_" + Date.now().toString(36);
    this.state = {
      schema: SCHEMA,
      workspace: {
        id: id,
        name: name || "My OriginLab",
        createdAt: nowIso(),
        owner: "principal",
        principal: "principal",
        defaultDataClass: 0,
        policy: "local-authoritative",
        demo: false
      },
      events: [],
      meta: { createdAt: nowIso(), updatedAt: nowIso(), lastVerifyOk: true }
    };
    this.refresh();
    this.append("workspace.created", {
      name: this.state.workspace.name,
      owner: "principal",
      policy: "local-authoritative",
      defaultDataClass: 0,
      appVersion: "0.0.1"
    }, 0, "principal");
    return this.model;
  };

  Store.prototype.reset = function () {
    try {
      root.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    this.state = null;
    this.model = null;
  };

  Store.prototype.storageBytes = function () {
    if (!this.state) return 0;
    var text = JSON.stringify(this.state);
    return new TextEncoder().encode(text).length;
  };

  Store.prototype.nextClaimId = function () {
    return nextId("CL", this.model.claims);
  };
  Store.prototype.nextEvidenceId = function () {
    return nextId("EV", this.model.evidence);
  };
  Store.prototype.nextCharterId = function () {
    return nextId("CH", this.model.charters);
  };
  Store.prototype.nextCorrectionId = function () {
    var map = {};
    this.model.corrections.forEach(function (c) {
      map[c.id] = true;
    });
    return nextId("CO", map);
  };

  Store.prototype.createClaim = function (input) {
    var id = this.nextClaimId();
    this.append(
      "claim.created",
      {
        claim: id,
        charter: input.charter,
        statement: input.statement,
        type: input.type || "analytical",
        status: "proposed",
        falsifier: input.falsifier,
        confidence: input.confidence,
        limitations: input.limitations || [],
        supersedes: null
      },
      0,
      "principal"
    );
    return id;
  };

  Store.prototype.recordEvidence = function (input) {
    var id = this.nextEvidenceId();
    this.append(
      "evidence.recorded",
      {
        claim: input.claim,
        evidence: id,
        grade: input.grade,
        kind: input.kind,
        source: input.source || {},
        method: input.method,
        result: input.result,
        reproduces: !!input.reproduces,
        independent: !!input.independent,
        adversarial: !!input.adversarial,
        recordedBy: "principal",
        limitations: input.limitations || []
      },
      input.dataClass || 0,
      "principal"
    );
    return id;
  };

  Store.prototype.transitionClaim = function (claimId, to, reason, evidenceIds) {
    var claim = this.model.claims[claimId];
    if (!claim) throw new Error("Claim not found");
    this.append(
      "claim.transitioned",
      {
        claim: claimId,
        from: claim.status,
        to: to,
        reason: reason,
        evidence: evidenceIds || claim.evidence.slice()
      },
      0,
      "principal"
    );
  };

  Store.prototype.proposeCharter = function (input) {
    var id = this.nextCharterId();
    this.append(
      "charter.proposed",
      {
        charter: id,
        title: input.title,
        program: input.program || "P1",
        question: input.question,
        whyNow: input.whyNow,
        scope: { in: input.scopeIn || [], out: input.scopeOut || [] },
        risk: {
          class: input.riskClass || "low",
          dualUse: !!input.dualUse,
          dataClassMax: input.dataClassMax || 1
        },
        evidenceBar: input.evidenceBar || "E2",
        budget: {
          weeks: input.weeks || 4,
          computeHours: 0,
          usd: 0,
          tokens: 0
        },
        stopConditions: input.stopConditions || ["The question cannot be falsified"],
        owner: "principal"
      },
      0,
      "principal"
    );
    return id;
  };

  Store.prototype.signGate = function (charterId, gate, packet, reasons) {
    this.append(
      "gate.decided",
      {
        gate: gate,
        charter: charterId,
        decision: "approve",
        signers: ["principal"],
        packet: packet || null,
        reasons: reasons || ["Signed on-device by the principal."]
      },
      0,
      "principal"
    );
  };

  Store.prototype.appendCorrection = function (target, reason, evidence) {
    var id = this.nextCorrectionId();
    this.append(
      "correction.appended",
      { correction: id, target: target, reason: reason, evidence: evidence || null },
      0,
      "principal"
    );
    return id;
  };

  Store.prototype.tryTransfer = function (charterId, signers) {
    var check = root.OriginPolicy.validateSigners("transfer", signers);
    return {
      ok: check.ok,
      errors: check.errors,
      signers: signers,
      charter: charterId
    };
  };

  root.OriginState = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA: SCHEMA,
    ZERO: ZERO,
    Store: Store,
    derive: derive,
    jsonl: jsonl,
    nextId: nextId
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
