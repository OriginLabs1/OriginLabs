/*
 * OriginLabs policy — the rules the ledger refuses to break.
 *
 * This file is deliberately dependency-free and DOM-free so the same rules run
 * in the Android WebView, in the PWA and in the Node test suite.
 */
(function (root) {
  "use strict";

  var GRADES = ["E0", "E1", "E2", "E3", "E4"];
  var TERMINAL = ["superseded"];

  var TRANSITIONS = {
    proposed: ["investigating", "contested", "retracted"],
    investigating: ["supported", "contested", "retracted"],
    supported: ["established", "contested", "retracted"],
    established: ["contested", "retracted", "superseded"],
    contested: ["investigating", "supported", "established", "retracted", "superseded"],
    retracted: ["superseded"],
    superseded: []
  };

  // Keys that would smuggle raw content into the ledger. Payloads carry
  // identifiers, decisions, hashes and metadata — never the data itself.
  var RAW_KEYS = [
    "content",
    "raw",
    "text",
    "body",
    "prompt",
    "completion",
    "transcript",
    "document",
    "blob",
    "bytes",
    "message",
    "snippet",
    "attachment",
    "fileContents"
  ];

  function actorKind(actor) {
    if (typeof actor !== "string" || !actor) return "unknown";
    if (actor === "principal" || actor.indexOf("human:") === 0 || actor.indexOf("person:") === 0) {
      return "human";
    }
    if (actor.indexOf("agent:") === 0) return "agent";
    if (actor.indexOf("system:") === 0) return "system";
    // A bare identifier (reviewer, alice, lab-b) is a human principal. Agents
    // and system tasks must carry an explicit agent:/system: prefix, so a
    // machine can never be mistaken for a person here.
    if (/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(actor)) return "human";
    return "unknown";
  }

  function isHuman(actor) {
    return actorKind(actor) === "human";
  }

  function gradeRank(grade) {
    var i = GRADES.indexOf(grade);
    return i < 0 ? -1 : i;
  }

  function bestGrade(grades) {
    var best = -1;
    (grades || []).forEach(function (grade) {
      var r = gradeRank(grade);
      if (r > best) best = r;
    });
    return best < 0 ? null : GRADES[best];
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function findRawContent(value, path, found, depth) {
    if (depth > 8 || value === null || value === undefined) return found;
    if (typeof value === "string") {
      if (value.length > 1024) {
        found.push(path + " (string longer than 1024 characters)");
      }
      return found;
    }
    if (typeof value !== "object") return found;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        findRawContent(value[i], path + "[" + i + "]", found, depth + 1);
      }
      return found;
    }
    Object.keys(value).forEach(function (key) {
      var lower = key.toLowerCase();
      if (RAW_KEYS.indexOf(lower) >= 0 && value[key] !== null && value[key] !== "") {
        found.push(path + "." + key);
        return;
      }
      findRawContent(value[key], path + "." + key, found, depth + 1);
    });
    return found;
  }

  function validatePayload(payload, dataClass) {
    var errors = [];
    if (!isPlainObject(payload)) {
      return { ok: false, errors: ["payload must be a JSON object"] };
    }
    if (dataClass >= 2) {
      var found = findRawContent(payload, "payload", [], 0);
      if (found.length) {
        errors.push(
          "class " + dataClass + " payload must contain references, not raw content: " + found.join(", ")
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateSigners(gate, signers) {
    var errors = [];
    if (!Array.isArray(signers) || signers.length === 0) {
      return { ok: false, errors: ["a gate needs at least one human signer"] };
    }
    signers.forEach(function (signer) {
      if (!isHuman(signer)) {
        errors.push("gate signer '" + signer + "' is not a human principal; agents can never sign a gate");
      }
    });
    var distinct = {};
    signers.forEach(function (s) {
      distinct[s] = true;
    });
    var count = Object.keys(distinct).length;
    if (gate === "transfer" && count < 2) {
      errors.push("the Transfer gate requires two distinct human signers (two-key control)");
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function evidenceGradesFor(claim, model) {
    var ids = (claim && claim.evidence) || [];
    var grades = [];
    ids.forEach(function (id) {
      var ev = model && model.evidence && model.evidence[id];
      if (ev && ev.grade) grades.push(ev.grade);
    });
    return grades;
  }

  function canTransition(input) {
    var claim = input.claim;
    var to = input.to;
    var model = input.model || {};
    var charter = input.charter || (model.charters && model.charters[claim.charter]);
    var errors = [];

    if (!claim) return { ok: false, errors: ["claim not found"] };
    if (TERMINAL.indexOf(claim.status) >= 0) {
      return { ok: false, errors: ["claim " + claim.id + " is " + claim.status + " and cannot transition"] };
    }
    var allowed = TRANSITIONS[claim.status] || [];
    if (allowed.indexOf(to) < 0) {
      errors.push("illegal transition " + claim.status + " → " + to);
    }

    var grades = evidenceGradesFor(claim, model);
    var best = bestGrade(grades);
    var rank = best === null ? -1 : gradeRank(best);

    if (to === "investigating" && rank < gradeRank("E1")) {
      errors.push("investigating requires at least one E1 (traceable citation) evidence record");
    }
    if (to === "supported" && rank < gradeRank("E2")) {
      errors.push("supported requires at least one E2 (reproducible) evidence record");
    }
    if (to === "established") {
      var highRisk = charter && charter.risk && charter.risk.class === "high";
      var floor = highRisk ? "E4" : "E3";
      if (rank < gradeRank(floor)) {
        errors.push(
          "established requires " + floor + " evidence" + (highRisk ? " for a high-risk charter" : "")
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateEvent(event, model) {
    var errors = [];
    var type = event.type;
    var payload = event.payload;
    var dataClass = event.dataClass;
    var actor = event.actor;

    if (!type) errors.push("event type is required");
    if (!isHuman(actor) && !(actor && actor.indexOf("system:") === 0)) {
      // A local workspace may record agent activity, but never a human gate.
      if (!(actor && actor.indexOf("agent:") === 0)) errors.push("actor must be a human principal, agent:… or system:…");
    }
    if (typeof dataClass !== "number" || dataClass < 0 || dataClass > 4) {
      errors.push("dataClass must be 0–4");
    }

    var payloadCheck = validatePayload(payload, dataClass);
    if (!payloadCheck.ok) errors.push.apply(errors, payloadCheck.errors);

    if (payload && typeof payload === "object") {
      if (type === "gate.decided" || type === "charter.approved") {
        var gate = payload.gate || (type === "charter.approved" ? "frame" : "");
        var signers = payload.signers;
        if (type === "charter.approved" && !signers && payload.signer) signers = [payload.signer];
        var signerCheck = validateSigners(gate, signers);
        if (!signerCheck.ok) errors.push.apply(errors, signerCheck.errors);
      }

      if (type === "claim.created") {
        if (payload.status && payload.status !== "proposed") {
          errors.push("a new claim must start as proposed");
        }
        if (!payload.statement || !payload.falsifier) {
          errors.push("a claim needs a statement and a falsifier");
        }
      }

      if (type === "claim.transitioned") {
        var claim = model && model.claims && model.claims[payload.claim];
        if (!claim) {
          errors.push("claim " + payload.claim + " does not exist");
        } else if (claim.status !== payload.from) {
          errors.push("claim is " + claim.status + ", not " + payload.from);
        } else {
          var transition = canTransition({
            claim: claim,
            to: payload.to,
            model: model
          });
          if (!transition.ok) errors.push.apply(errors, transition.errors);
        }
      }

      if (type === "evidence.recorded") {
        if (!model || !model.claims || !model.claims[payload.claim]) {
          errors.push("evidence must reference an existing claim");
        }
        if (gradeRank(payload.grade) < 0) {
          errors.push("evidence grade must be E0–E4");
        }
        if (!payload.method || !payload.result) {
          errors.push("evidence needs a method and a result");
        }
      }

      if (type === "correction.appended" && !payload.target) {
        errors.push("a correction needs a target");
      }

      if (type === "charter.proposed") {
        if (!payload.title || !payload.question) errors.push("a charter needs a title and a question");
        if (!Array.isArray(payload.stopConditions) || payload.stopConditions.length === 0) {
          errors.push("a charter needs at least one stop condition");
        }
      }
    }

    return { ok: errors.length === 0, errors: errors };
  }

  var api = {
    GRADES: GRADES,
    TRANSITIONS: TRANSITIONS,
    actorKind: actorKind,
    isHuman: isHuman,
    gradeRank: gradeRank,
    bestGrade: bestGrade,
    validatePayload: validatePayload,
    validateSigners: validateSigners,
    canTransition: canTransition,
    validateEvent: validateEvent
  };

  root.OriginPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
