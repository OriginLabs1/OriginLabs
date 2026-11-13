/*
 * OriginLabs v0.0.1 — offline Android/PWA surface.
 *
 * Classic script on purpose: the Android WebView loads from file://, where ES
 * module imports are blocked. Every network-shaped dependency is absent.
 */
(function () {
  "use strict";

  var ui = {
    tab: "home",
    segment: "claims",
    ledgerFilter: "all",
    ledgerQuery: "",
    evidenceFilter: "all",
    registryKind: "all",
    registryQuery: "",
    verification: null,
    installPrompt: null,
    importFromOnboarding: false
  };

  var core = null;
  var store = null;
  var model = null;
  var els = {};
  var toastTimer = null;

  var REPO = "https://github.com/OriginLabs1/OriginLabs";
  var RELEASES = REPO + "/releases/latest";
  var SITE = "https://originlabs1.github.io/OriginLabs/";
  var OBTAINIUM =
    "https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/" + REPO;

  document.addEventListener("DOMContentLoaded", boot);

  async function boot() {
    els.boot = document.getElementById("boot");
    els.bootText = document.getElementById("boot-text");
    els.view = document.getElementById("view");
    els.tabbar = document.getElementById("tabbar");
    els.sheet = document.getElementById("sheet-root");
    els.toast = document.getElementById("toast");
    els.onboarding = document.getElementById("onboarding");
    els.file = document.getElementById("file-import");
    els.chainPill = document.getElementById("chain-pill");
    els.chainLabel = document.getElementById("chain-label");

    bindEvents();

    try {
      els.bootText.textContent = "Instantiating the Rust core…";
      core = await OriginCore.load();
    } catch (error) {
      failBoot(error);
      return;
    }

    store = new OriginState.Store(core);
    window.originAndroidBack = androidBack;
    window.OriginLabs = {
      core: core,
      store: store,
      model: function () {
        return store.refresh();
      },
      version: "0.0.1"
    };

    if (store.hasWorkspace()) {
      model = store.refresh();
      ui.verification = safeVerify();
      hideBoot();
      render();
    } else {
      hideBoot();
      showOnboarding();
    }

    registerServiceWorker();
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var el = event.target.closest("[data-action]");
      if (!el || el.disabled) return;
      var action = el.dataset.action;
      var handler = actions[action];
      if (!handler) return;
      event.preventDefault();
      try {
        handler(el, event);
      } catch (error) {
        console.error(error);
        toast(error.message || String(error), "bad");
      }
    });

    document.addEventListener("submit", function (event) {
      var form = event.target.closest("form[data-form]");
      if (!form) return;
      event.preventDefault();
      try {
        forms[form.dataset.form](form);
      } catch (error) {
        showFormError(form, error);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("sheet-open")) {
        closeSheet();
      }
    });

    els.view.addEventListener("input", function (event) {
      if (event.target.id === "ledger-search") {
        ui.ledgerQuery = event.target.value.toLowerCase().trim();
        applyLedgerFilter();
      }
      if (event.target.id === "registry-search") {
        ui.registryQuery = event.target.value.toLowerCase().trim();
        applyRegistryFilter();
      }
    });

    els.file.addEventListener("change", function () {
      var file = els.file.files && els.file.files[0];
      els.file.value = "";
      if (!file) return;
      file.text().then(function (text) {
        importText(text);
      }).catch(function (error) {
        toast("Could not read the file: " + error.message, "bad");
      });
    });

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      ui.installPrompt = event;
    });
  }

  /* ------------------------------------------------------------- lifecycle */

  function hideBoot() {
    if (els.boot) els.boot.classList.add("is-done");
  }

  function failBoot(error) {
    console.error(error);
    els.boot.classList.add("is-error");
    els.bootText.textContent =
      "The Rust core could not start. This build is incomplete or the WebAssembly runtime is unavailable. " +
      (error.message || "");
  }

  function showOnboarding() {
    els.onboarding.hidden = false;
    els.view.innerHTML = "";
  }

  function hideOnboarding() {
    els.onboarding.hidden = true;
  }

  function safeVerify() {
    try {
      return store.verify();
    } catch (error) {
      return { ok: false, events: 0, head: "", breaks: [{ reason: error.message }], legacy: [] };
    }
  }

  function afterChange(message, tone, keepScroll) {
    model = store.refresh();
    ui.verification = safeVerify();
    render({ keepScroll: keepScroll !== false });
    if (message) toast(message, tone);
  }

  function render(options) {
    if (!store || !store.hasWorkspace()) {
      els.view.innerHTML = "";
      return;
    }
    model = store.refresh();
    updateTopbar();
    updateTabs();
    var previous = options && options.keepScroll ? window.scrollY : 0;
    els.view.innerHTML = views[ui.tab] ? views[ui.tab]() : views.home();
    if (options && options.keepScroll) {
      window.scrollTo(0, previous);
    } else {
      window.scrollTo(0, 0);
    }
  }

  function updateTopbar() {
    var verified = ui.verification && ui.verification.ok;
    els.chainPill.classList.remove("is-ok", "is-bad", "is-off");
    if (!ui.verification) {
      els.chainPill.classList.add("is-off");
      els.chainLabel.textContent = "LOCAL";
    } else if (verified) {
      els.chainPill.classList.add("is-ok");
      els.chainLabel.textContent = "VERIFIED";
    } else {
      els.chainPill.classList.add("is-bad");
      els.chainLabel.textContent = "BROKEN";
    }
    els.chainPill.title = ui.verification
      ? ui.verification.events + " events · head " + (ui.verification.head || "")
      : "No verification yet";
  }

  function updateTabs() {
    Array.prototype.forEach.call(els.tabbar.querySelectorAll(".tab"), function (tab) {
      var active = tab.dataset.tab === ui.tab;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  function setTab(tab) {
    if (!views[tab]) return;
    ui.tab = tab;
    closeSheet();
    render();
  }

  function androidBack() {
    if (document.body.classList.contains("sheet-open")) {
      closeSheet();
      return true;
    }
    if (ui.tab !== "home") {
      setTab("home");
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------- views */

  var views = {
    home: homeView,
    ledger: ledgerView,
    claims: claimsView,
    registry: registryView,
    lab: labView
  };

  function homeView() {
    var m = model;
    var v = ui.verification;
    var ok = !v || v.ok;
    var demo = !!m.workspace.demo;
    var statusWord = !v ? "Local" : v.ok ? "Verified" : "Broken";
    var flight = m.claimOrder
      .map(function (id) {
        return m.claims[id];
      })
      .filter(function (c) {
        return ["proposed", "investigating", "supported"].indexOf(c.status) >= 0;
      })
      .slice(-2)
      .reverse();

    return [
      '<section class="hero ' + (ok ? "" : "is-bad") + '">',
      '<div class="hero-top"><p class="kicker">Lab status</p>',
      '<span class="badge ' + (ok ? "ok" : "bad") + '"><span class="dot"></span>' +
        (ok ? "hash chain intact" : "chain break") + "</span></div>",
      '<h1 class="hero-title">' + statusWord + ".</h1>",
      '<p class="hero-copy">' +
        esc(
          demo
            ? "Synthetic demo workspace. Every event was built and verified on this device."
            : m.workspace.name + " — local, append-only, no account."
        ) +
        "</p>",
      '<div class="hashline"><span class="hashline-label">HEAD</span><code>' +
        esc(short(m.head, 28)) +
        '</code><button class="icon-btn" data-action="copy" data-copy="' + esc(m.head) +
        '" aria-label="Copy head hash"><svg class="icon"><use href="#i-copy"></use></svg></button></div>',
      '<div class="hero-actions">',
      '<button class="btn btn-primary" data-action="verify"><svg class="icon"><use href="#i-shield"></use></svg>Verify chain</button>',
      '<button class="btn btn-ghost" data-action="tamper">Tamper test</button>',
      "</div>",
      '<div class="hero-foot"><svg class="icon"><use href="#i-offline"></use></svg> Rust core · wasm32 · zero network</div>',
      "</section>",

      '<div class="quick-grid">',
      quick("new-claim", "i-plus", "New claim", "Add to the ledger"),
      quick("record-evidence", "i-evidence", "Evidence", "Attach a record"),
      quick("new-charter", "i-flag", "Charter", "Frame a question"),
      quick(
        "nav-registry",
        "i-registry",
        "Registry",
        (window.ORIGIN_REGISTRY ? window.ORIGIN_REGISTRY.items.length : 0) + " capabilities"
      ),
      "</div>",

      sectionHead("Lab at a glance", "Ledger derived"),
      '<div class="stat-grid">',
      stat(m.counts.claims, "Claims", true),
      stat(m.counts.evidence, "Evidence"),
      stat(m.counts.gates, "Gate decisions"),
      stat(m.counts.artifacts, "Artifacts"),
      "</div>",

      '<section class="section">',
      sectionHead("Trust boundary", "Rust · WASM"),
      rustCard(),
      "</section>",

      flight.length
        ? '<section class="section">' +
          sectionHead("Claims in flight", "Open") +
          flight.map(claimCard).join("") +
          "</section>"
        : "",

      '<section class="section">',
      sectionHead("Recent activity", "Append-only"),
      '<div class="list">' +
        m.events
          .slice(-4)
          .reverse()
          .map(eventRow)
          .join("") +
        "</div>",
      "</section>",

      m.artifacts.length ? artifactCard(m.artifacts[m.artifacts.length - 1]) : "",
      m.incidents.length ? incidentCard(m.incidents[m.incidents.length - 1]) : ""
    ].join("");
  }

  function ledgerView() {
    var m = model;
    return [
      '<div class="section-head"><div><p class="kicker">Append-only</p><h2>Ledger</h2></div>',
      '<span class="badge">' + m.counts.events + " events</span></div>",
      '<div class="toolbar">',
      '<label class="search"><svg class="icon"><use href="#i-search"></use></svg>',
      '<input id="ledger-search" type="search" placeholder="Search events, actors, payloads" value="' +
        esc(ui.ledgerQuery) + '" autocomplete="off"></label>',
      '<button class="icon-btn" data-action="verify" aria-label="Verify chain"><svg class="icon"><use href="#i-shield"></use></svg></button>',
      '<button class="icon-btn" data-action="export-bundle" aria-label="Export bundle"><svg class="icon"><use href="#i-download"></use></svg></button>',
      "</div>",
      '<div class="chips" id="ledger-chips">' +
        ledgerChip("all", "All") +
        ledgerChip("claim", "Claims") +
        ledgerChip("evidence", "Evidence") +
        ledgerChip("gate", "Gates") +
        ledgerChip("charter", "Charters") +
        ledgerChip("correction", "Corrections") +
        ledgerChip("artifact", "Artifacts") +
        "</div>",
      '<div class="list" id="ledger-list">' + m.events.slice().reverse().map(eventRow).join("") + "</div>",
      '<div class="empty hidden" id="ledger-empty"><h3>No matching events</h3><p>Try a different filter or search term.</p></div>',
      '<p class="center mt-16 small faint mono">GENESIS → ' + esc(short(m.head, 30)) + "</p>"
    ].join("");
  }

  function claimsView() {
    var body;
    if (ui.segment === "evidence") body = evidenceSegment();
    else if (ui.segment === "gates") body = gatesSegment();
    else body = claimsSegment();

    return [
      '<div class="section-head"><div><p class="kicker">Knowledge</p><h2>Claims</h2></div>',
      '<span class="badge">' + model.counts.supported + " supported</span></div>",
      '<div class="segmented">',
      segmentButton("claims", "Claims"),
      segmentButton("evidence", "Evidence"),
      segmentButton("gates", "Gates"),
      "</div>",
      body
    ].join("");
  }

  function claimsSegment() {
    var m = model;
    if (!m.claimOrder.length) {
      return emptyState(
        "i-claim",
        "No claims yet",
        "Frame a charter, then turn its question into a falsifiable claim.",
        m.charterOrder.length
          ? '<button class="btn btn-primary btn-sm" data-action="new-claim">Create a claim</button>'
          : '<button class="btn btn-primary btn-sm" data-action="new-charter">Propose a charter</button>'
      );
    }
    return [
      '<div class="row-between mb-12"><span class="small muted">' + m.counts.claims +
        ' claims · ' + m.counts.evidence + ' evidence records</span>',
      '<button class="btn btn-sm btn-primary" data-action="new-claim"><svg class="icon"><use href="#i-plus"></use></svg>Claim</button></div>',
      m.claimOrder
        .slice()
        .reverse()
        .map(function (id) {
          return claimCard(m.claims[id]);
        })
        .join("")
    ].join("");
  }

  function evidenceSegment() {
    var m = model;
    var items = m.evidenceOrder.slice().reverse().filter(function (id) {
      return ui.evidenceFilter === "all" || (m.evidence[id] && m.evidence[id].grade === ui.evidenceFilter);
    });
    return [
      '<div class="row-between mb-12"><span class="small muted">' + m.counts.evidence +
        ' records</span><button class="btn btn-sm btn-primary" data-action="record-evidence">' +
        '<svg class="icon"><use href="#i-plus"></use></svg>Evidence</button></div>',
      '<div class="chips">' +
        ["all", "E1", "E2", "E3", "E4"]
          .map(function (grade) {
            return (
              '<button class="chip ' + (ui.evidenceFilter === grade ? "is-active" : "") +
              '" data-action="evidence-filter" data-grade="' + grade + '">' +
              (grade === "all" ? "All grades" : grade) + "</button>"
            );
          })
          .join("") +
        "</div>",
      items.length
        ? items
            .map(function (id) {
              return evidenceCard(m.evidence[id]);
            })
            .join("")
        : emptyState("i-evidence", "No evidence here", "Record a measurement, proof, experiment, replication, literature review or review.")
    ].join("");
  }

  function gatesSegment() {
    var m = model;
    var charters = m.charterOrder
      .slice()
      .reverse()
      .map(function (id) {
        return m.charters[id];
      });
    return [
      '<div class="policy-card">',
      '<p class="kicker mb-8">Gate policy · enforced in Rust and before append</p>',
      '<div class="policy-rule"><svg class="icon"><use href="#i-shield"></use></svg><span>An agent can never sign a gate. Signers must be human principals.</span></div>',
      '<div class="policy-rule"><svg class="icon"><use href="#i-key"></use></svg><span>The Transfer gate requires two distinct human signers.</span></div>',
      '<button class="btn btn-sm btn-ghost mt-8" data-action="transfer-test">Test the two-key rule</button>',
      "</div>",
      '<div class="row-between mb-12"><span class="small muted">' + m.counts.charters +
        ' charters · ' + m.counts.gates + ' decisions</span>',
      '<button class="btn btn-sm btn-primary" data-action="new-charter"><svg class="icon"><use href="#i-plus"></use></svg>Charter</button></div>',
      charters.length
        ? charters.map(charterCard).join("")
        : emptyState("i-flag", "No charters", "A charter names the question, the evidence bar and the stop conditions.")
    ].join("");
  }

  function registryView() {
    var reg = window.ORIGIN_REGISTRY;
    if (!reg || !reg.items || !reg.items.length) {
      return emptyState("i-registry", "Registry unavailable", "This build did not embed the capability snapshot.");
    }
    var counts = { all: reg.items.length, skill: 0, tool: 0, workflow: 0, model: 0 };
    reg.items.forEach(function (item) {
      if (counts[item.kind] !== undefined) counts[item.kind] += 1;
    });
    return [
      '<div class="section-head"><div><p class="kicker">Capability snapshot</p><h2>Registry</h2></div>',
      '<span class="badge">' + reg.items.length + " entries</span></div>",
      '<div class="policy-card"><div class="row wrap">',
      '<span class="badge acid"><span class="dot"></span>FOSS only</span>',
      '<span class="badge ok"><span class="dot"></span>Zero cost</span>',
      '<span class="badge info"><span class="dot"></span>Local first</span>',
      '<span class="badge">v' + esc(reg.version) + "</span>",
      "</div><p class=\"small faint mt-8\">Admission requires a schema-valid definition, an eval, a named owner, a failure mode and a dry run. Agents must be ACP-compatible, self-hostable and free of mandatory telemetry.</p></div>",
      '<div class="toolbar"><label class="search"><svg class="icon"><use href="#i-search"></use></svg>',
      '<input id="registry-search" type="search" placeholder="Search skills, tools, workflows, models" value="' +
        esc(ui.registryQuery) + '" autocomplete="off"></label></div>',
      '<div class="chips" id="registry-chips">' +
        registryChip("all", "All", counts.all) +
        registryChip("skill", "Skills", counts.skill) +
        registryChip("tool", "Tools", counts.tool) +
        registryChip("workflow", "Workflows", counts.workflow) +
        registryChip("model", "Models", counts.model) +
        "</div>",
      '<div id="registry-list">' + reg.items.map(registryCard).join("") + "</div>",
      '<div class="empty hidden" id="registry-empty"><h3>No matching entries</h3><p>Try another kind or search term.</p></div>'
    ].join("");
  }

  function labView() {
    var m = model;
    var build = window.ORIGIN_BUILD || {};
    var coreSha = core.meta.sha256 || "unknown";
    return [
      '<div class="section-head"><div><p class="kicker">Device</p><h2>Lab</h2></div>',
      '<span class="badge">' + esc(platformName()) + "</span></div>",

      '<section class="card">',
      '<div class="card-top"><div><div class="card-title">' + esc(m.workspace.name) + "</div>",
      '<div class="card-sub">' + esc(m.workspace.id) + "</div></div>",
      '<span class="badge ' + (m.workspace.demo ? "warn" : "ok") + '">' + (m.workspace.demo ? "DEMO" : "LOCAL") + "</span></div>",
      '<dl class="kv mt-12">',
      kv("Principal", "principal · human"),
      kv("Created", m.workspace.createdAt ? dateLong(m.workspace.createdAt) : "—"),
      kv("Policy", m.workspace.policy || "local-authoritative"),
      kv("Default class", "0 · public"),
      kv("On disk", bytes(store.storageBytes())),
      "</dl>",
      "</section>",

      '<section class="section">',
      sectionHead("Trust boundary", "Rust core"),
      '<div class="card rust-card">',
      '<div class="card-top"><div class="row"><div class="rust-mark"><svg class="icon"><use href="#i-cpu"></use></svg></div>',
      '<div><div class="card-title">origin-core ' + esc(core.version) + "</div>",
      '<div class="card-sub">Compiled to wasm32-unknown-unknown</div></div></div>',
      '<span class="badge ok"><span class="dot"></span>running</span></div>',
      '<div class="rust-meta"><span class="badge">0 dependencies</span><span class="badge">' +
        esc(Math.round((core.meta.bytes || 0) / 1024)) + " KB</span><span class=\"badge\">no network</span></div>",
      '<p class="mono-line mt-12">sha256 <b>' + esc(coreSha) + "</b></p>",
      '<p class="small faint mt-8">The same source compiles to the native <span class="mono">origin-core</span> CLI and to this WebAssembly module. Canonical JSON, SHA-256, event construction and chain verification live only here.</p>',
      '<div class="card-actions"><button class="btn btn-sm" data-action="selftest">Run self-test</button>',
      '<button class="btn btn-sm btn-ghost" data-action="verify">Verify chain</button></div>',
      "</div>",
      "</section>",

      '<section class="section">',
      sectionHead("Data", "Yours"),
      '<div class="action-list">',
      actionRow("export-bundle", "i-download", "Export bundle", "JSON with workspace, events and ledger digest"),
      actionRow("share-bundle", "i-share", "Share bundle", "Send through the Android share sheet"),
      actionRow("export-jsonl", "i-terminal", "Export JSONL", "Raw append-only event lines"),
      actionRow("import", "i-upload", "Import backup", "Verifies the chain before accepting"),
      actionRow("load-demo", "i-reset", "Reload demo lab", "Replace this workspace with synthetic data"),
      "</div>",
      "</section>",

      '<section class="section">',
      sectionHead("Distribution", "GitHub · Obtainium"),
      '<div class="card">',
      '<div class="card-title">OriginLabs1/OriginLabs</div>',
      '<div class="card-sub">Signed APK, checksums, release manifest, SBOM and the PWA.</div>',
      '<div class="action-list">',
      actionRow("external", "i-download", "Latest release", "Signed Android package and checksums", 'data-url="' + esc(RELEASES) + '"'),
      actionRow("external", "i-external", "Project repository", "Source, doctrine, registry and ledger", 'data-url="' + esc(REPO) + '"'),
      actionRow("external", "i-external", "Web app", "Installable PWA on GitHub Pages", 'data-url="' + esc(SITE) + '"'),
      actionRow("external", "i-download", "Add with Obtainium", "Track releases without an account", 'data-url="' + esc(OBTAINIUM) + '"'),
      actionRow("install", "i-plus", "Install this PWA", "Add the web app to your home screen"),
      "</div>",
      "</div>",
      "</section>",

      '<section class="section">',
      sectionHead("Privacy", "By construction"),
      '<div class="card">',
      '<div class="trust-list">',
      trustLine("No INTERNET permission in the Android shell"),
      trustLine("No accounts, telemetry, analytics or crash reporting"),
      trustLine("No paid API, model download or remote inference on the default path"),
      trustLine("Class ≥2 payloads are rejected if they contain raw content"),
      trustLine("Corrections are appended; history is never rewritten"),
      "</div>",
      "</div>",
      "</section>",

      '<section class="section">',
      sectionHead("About", "v0.0.1"),
      '<div class="card">',
      '<dl class="kv">',
      kv("App", "OriginLabs " + esc(build.version || "0.0.1")),
      kv("Build", esc(build.generatedAt || "local development")),
      kv("Core", "Rust " + esc(core.version) + " · wasm32"),
      kv("Registry", window.ORIGIN_REGISTRY ? String(window.ORIGIN_REGISTRY.items.length) + " entries" : "not embedded"),
      kv("License", "MIT"),
      kv("Package", "com.oneorigin.labs"),
      "</dl>",
      '<p class="small faint mt-12">Local-first research infrastructure. Free and open source, zero cost, no telemetry on the default path.</p>',
      "</div>",
      "</section>",

      '<section class="section">',
      sectionHead("Danger zone", "Irreversible"),
      '<button class="btn btn-danger btn-block" data-action="reset"><svg class="icon"><use href="#i-trash"></use></svg>Wipe this device’s workspace</button>',
      "</section>"
    ].join("");
  }

  /* ------------------------------------------------------------- fragments */

  function quick(action, icon, label, sub) {
    if (action === "nav-registry") {
      return (
        '<button class="quick" data-action="nav" data-tab="registry"><span class="quick-icon"><svg class="icon"><use href="#' +
        icon + '"></use></svg></span><span><span class="quick-label">' + label +
        '</span><span class="quick-sub">' + sub + "</span></span></button>"
      );
    }
    return (
      '<button class="quick" data-action="' + action + '"><span class="quick-icon"><svg class="icon"><use href="#' +
      icon + '"></use></svg></span><span><span class="quick-label">' + label +
      '</span><span class="quick-sub">' + sub + "</span></span></button>"
    );
  }

  function sectionHead(title, kicker) {
    return (
      '<div class="section-head"><h2>' + esc(title) + '</h2><span class="kicker">' + esc(kicker || "") + "</span></div>"
    );
  }

  function stat(value, label, accent) {
    return (
      '<div class="stat ' + (accent ? "accent" : "") + '"><span class="stat-value">' + esc(value) +
      '</span><span class="stat-label">' + esc(label) + "</span></div>"
    );
  }

  function rustCard() {
    return (
      '<div class="card rust-card">' +
      '<div class="card-top"><div class="row"><div class="rust-mark"><svg class="icon"><use href="#i-cpu"></use></svg></div>' +
      '<div><div class="card-title">Rust trust core</div><div class="card-sub">Canonical JSON · SHA-256 · chain verify</div></div></div>' +
      '<span class="badge ok"><span class="dot"></span>wasm</span></div>' +
      '<div class="rust-meta"><span class="badge">v' + esc(core.version) + '</span><span class="badge">' +
      Math.round((core.meta.bytes || 0) / 1024) + ' KB</span><span class="badge">0 deps</span></div>' +
      '<div class="card-actions"><button class="btn btn-sm" data-action="selftest">Run self-test</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="nav" data-tab="lab">Core details</button></div>' +
      "</div>"
    );
  }

  function claimCard(claim) {
    if (!claim) return "";
    var grades = claimGrades(claim);
    return (
      '<button class="claim-card" data-action="open-claim" data-id="' + esc(claim.id) + '">' +
      '<div class="claim-top"><span class="claim-id">' + esc(claim.id) + "</span>" + statusBadge(claim.status) +
      '<span class="badge">' + esc(claim.type) + "</span></div>" +
      '<p class="claim-statement">' + esc(claim.statement) + "</p>" +
      '<div class="claim-foot"><span>' + esc(claim.charter || "no charter") + '</span><span class="sep"></span>' +
      "<span>" + claim.evidence.length + " evidence</span><span class=\"sep\"></span>" +
      gradeDots(grades) + '<span class="sep"></span><span>conf ' + Math.round(claim.confidence * 100) + "%</span></div>" +
      "</button>"
    );
  }

  function evidenceCard(evidence) {
    if (!evidence) return "";
    return (
      '<button class="evidence-card" data-action="open-evidence" data-id="' + esc(evidence.id) + '">' +
      '<span class="grade ' + esc(evidence.grade) + '">' + esc(evidence.grade) + "</span>" +
      '<span class="evidence-main"><span class="evidence-title">' + esc(evidence.id) + " · " + esc(evidence.kind) +
      '</span><span class="evidence-sub">' + esc(evidence.claim) + " · " + esc(truncate(evidence.method, 96)) + "</span>" +
      '<span class="evidence-flags">' +
      (evidence.reproduces ? '<span class="badge ok">reproduces</span>' : "") +
      (evidence.independent ? '<span class="badge info">independent</span>' : "") +
      (evidence.adversarial ? '<span class="badge violet">adversarial</span>' : "") +
      "</span></span></button>"
    );
  }

  function charterCard(charter) {
    var frame = charter.gates.filter(function (g) {
      return g.gate === "frame" && g.decision === "approve";
    })[0];
    return (
      '<div class="charter-card">' +
      '<div class="row-between"><span class="badge ' + (charter.status === "active" ? "ok" : "warn") + '">' +
      esc(charter.status) + '</span><span class="badge">' + esc(charter.id) + " · " + esc(charter.risk.class) + " risk</span></div>" +
      '<h3 class="charter-title">' + esc(charter.title) + "</h3>" +
      '<p class="charter-q">' + esc(charter.question) + "</p>" +
      '<div class="charter-meta"><span class="badge">bar ' + esc(charter.evidenceBar) + "</span>" +
      '<span class="badge">' + charter.stopConditions.length + " stop conditions</span>" +
      (charter.risk.dualUse ? '<span class="badge warn">dual use</span>' : "") + "</div>" +
      '<div class="charter-gates">' +
      (charter.gates.length
        ? charter.gates
            .map(function (gate) {
              return (
                '<div class="gate-line"><svg class="icon"><use href="#i-check"></use></svg>' +
                esc(gate.gate) + " gate · " + esc(gate.decision) + " · " + esc(gate.signers.join(" + ")) +
                " · #" + gate.seq + "</div>"
              );
            })
            .join("")
        : '<div class="gate-line faint"><svg class="icon"><use href="#i-clock"></use></svg>No gate decision recorded</div>') +
      "</div>" +
      '<div class="card-actions"><button class="btn btn-sm btn-ghost" data-action="open-charter" data-id="' +
      esc(charter.id) + '">Charter detail</button>' +
      (frame
        ? ""
        : '<button class="btn btn-sm btn-primary" data-action="sign-gate" data-id="' +
          esc(charter.id) + '" data-gate="frame">Sign frame gate</button>') +
      "</div></div>"
    );
  }

  function artifactCard(artifact) {
    return (
      '<section class="section"><div class="section-head"><h2>Latest artifact</h2><span class="kicker">' +
      esc(artifact.id) + "</span></div>" +
      '<div class="card"><div class="card-top"><div><div class="card-title">' + esc(artifact.title) +
      '</div><div class="card-sub">' + esc(artifact.kind) + " · " + esc(artifact.license || "license unset") +
      '</div></div><span class="badge violet">' + esc(artifact.id) + "</span></div>" +
      '<p class="small muted mt-8">' + esc(artifact.summary) + "</p></div></section>"
    );
  }

  function incidentCard(incident) {
    return (
      '<section class="section"><div class="section-head"><h2>Incident</h2><span class="kicker">' +
      esc(incident.id) + "</span></div>" +
      '<div class="card"><div class="card-top"><span class="badge warn">' + esc(incident.severity) +
      ' severity</span><span class="badge">' + esc(incident.status) + "</span></div>" +
      '<div class="card-title mt-8">' + esc(incident.title) + "</div>" +
      '<p class="small muted mt-8">' + esc(incident.summary) + "</p></div></section>"
    );
  }

  function eventRow(event) {
    var meta = eventMeta(event.type);
    var summary = eventSummary(event);
    return (
      '<button class="event-row" data-action="open-event" data-seq="' + event.seq +
      '" data-group="' + esc(meta.group) + '" data-search="' + esc(searchText(event)) + '">' +
      '<span class="event-icon tone-' + meta.tone + '"><svg class="icon"><use href="#' + meta.icon + '"></use></svg></span>' +
      '<span class="event-main"><span class="event-title">' + esc(meta.label) + '</span><span class="event-sub">' +
      esc(summary) + "</span></span>" +
      '<span class="event-right"><span class="event-seq">#' + event.seq + '</span><span class="event-time">' +
      timeShort(event.at) + "</span></span></button>"
    );
  }

  function segmentButton(segment, label) {
    return (
      '<button class="' + (ui.segment === segment ? "is-active" : "") + '" data-action="segment" data-segment="' +
      segment + '">' + label + "</button>"
    );
  }

  function ledgerChip(filter, label) {
    return (
      '<button class="chip ' + (ui.ledgerFilter === filter ? "is-active" : "") +
      '" data-action="ledger-filter" data-filter="' + filter + '">' + label + "</button>"
    );
  }

  function registryChip(kind, label, count) {
    return (
      '<button class="chip ' + (ui.registryKind === kind ? "is-active" : "") +
      '" data-action="registry-kind" data-kind="' + kind + '">' + label + " " + count + "</button>"
    );
  }

  function registryCard(item) {
    var summary =
      item.summary || item.intent || item.trigger || item.notes || "";
    return (
      '<button class="reg-card" data-action="open-registry" data-id="' + esc(item.id) +
      '" data-kind="' + esc(item.kind) + '" data-search="' + esc(registrySearch(item)) + '">' +
      '<div class="reg-top"><span class="reg-id">' + esc(item.id) + '</span><span class="badge">' +
      esc(item.kind) + '</span><span class="badge ' + (item.status === "active" ? "ok" : "warn") + '">' +
      esc(item.status || "—") + "</span></div>" +
      '<div class="reg-name">' + esc(item.name) + "</div>" +
      '<div class="reg-summary">' + esc(truncate(summary, 150)) + "</div></button>"
    );
  }

  function emptyState(icon, title, copy, action) {
    return (
      '<div class="empty"><svg class="icon"><use href="#' + icon + '"></use></svg><h3>' + esc(title) +
      "</h3><p>" + esc(copy) + "</p>" + (action ? '<div class="mt-12">' + action + "</div>" : "") + "</div>"
    );
  }

  function actionRow(action, icon, title, sub, extra) {
    return (
      '<button class="action-row" data-action="' + action + '" ' + (extra || "") +
      '><svg class="icon"><use href="#' + icon + '"></use></svg><span class="grow"><span class="title">' +
      esc(title) + '</span><span class="sub">' + esc(sub) + "</span></span>" +
      '<svg class="icon"><use href="#i-chevron"></use></svg></button>'
    );
  }

  function trustLine(text) {
    return '<div class="trust-line"><svg class="icon"><use href="#i-check"></use></svg><span>' + esc(text) + "</span></div>";
  }

  function kv(key, value) {
    return "<dt>" + esc(key) + "</dt><dd>" + esc(value) + "</dd>";
  }

  function gradeDots(grades) {
    return (
      '<span class="grade-dots">' +
      ["E1", "E2", "E3", "E4"]
        .map(function (grade) {
          var on = grades.indexOf(grade) >= 0;
          return (
            '<span class="grade-dot ' + (on ? "on " + grade.toLowerCase() : "") +
            '" title="' + grade + (on ? " recorded" : " missing") + '">' + grade.slice(1) + "</span>"
          );
        })
        .join("") +
      "</span>"
    );
  }

  function statusBadge(status) {
    return '<span class="status ' + esc(status) + '">' + esc(status) + "</span>";
  }

  /* ----------------------------------------------------------------- sheets */

  function openSheet(html) {
    els.sheet.innerHTML =
      '<div class="sheet-backdrop" data-action="close-sheet"></div>' +
      '<section class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-grab"></div>' + html + "</section>";
    document.body.classList.add("sheet-open");
    var sheet = els.sheet.querySelector(".sheet");
    if (sheet) sheet.scrollTop = 0;
  }

  function closeSheet() {
    els.sheet.innerHTML = "";
    document.body.classList.remove("sheet-open");
  }

  function sheetHead(kicker, title) {
    return (
      '<div class="sheet-head"><div><p class="kicker">' + esc(kicker) + "</p><h2>" + esc(title) + "</h2></div>" +
      '<button class="sheet-close" data-action="close-sheet" aria-label="Close"><svg class="icon"><use href="#i-close"></use></svg></button></div>'
    );
  }

  function openEventDetail(seq) {
    var event = model.events.filter(function (e) {
      return e.seq === Number(seq);
    })[0];
    if (!event) return;
    var meta = eventMeta(event.type);
    var canonical;
    try {
      canonical = core.canonicalize(JSON.stringify(event));
    } catch (e) {
      canonical = JSON.stringify(event, null, 2);
    }
    openSheet(
      sheetHead("Ledger event #" + event.seq, meta.label) +
      '<p class="small muted">' + esc(eventSummary(event)) + "</p>" +
      '<dl class="kv mt-12">' +
      kv("Type", event.type) +
      kv("Actor", event.actor) +
      kv("Data class", String(event.dataClass)) +
      kv("Timestamp", dateLong(event.at)) +
      kv("Previous", short(event.prev, 22)) +
      kv("Hash", event.hash) +
      "</dl>" +
      '<div class="callout"><span class="label">Payload</span><pre class="payload-pre">' +
        esc(JSON.stringify(event.payload, null, 2)) + "</pre></div>" +
      '<p class="kicker mt-16 mb-8">Canonical JSON · signed body</p>' +
      '<pre class="mono-block">' + esc(canonical) + "</pre>" +
      '<div class="card-actions">' +
      '<button class="btn btn-sm" data-action="copy" data-copy="' + esc(event.hash) + '">Copy hash</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="verify">Verify chain</button></div>'
    );
  }

  function openClaimDetail(id) {
    var claim = model.claims[id];
    if (!claim) return;
    var charter = model.charters[claim.charter];
    var grades = claimGrades(claim);
    var evidence = claim.evidence
      .map(function (eid) {
        return model.evidence[eid];
      })
      .filter(Boolean);
    var targets = (window.OriginPolicy.TRANSITIONS[claim.status] || []).slice();
    var transitionButtons = targets
      .map(function (to) {
        var hint = transitionHint(to, claim, charter);
        return (
          '<button class="action-row" data-action="transition" data-id="' + esc(claim.id) + '" data-to="' + esc(to) + '">' +
          '<svg class="icon"><use href="#i-arrow"></use></svg><span class="grow"><span class="title">Move to ' + esc(to) +
          '</span><span class="sub">' + esc(hint) + "</span></span></button>"
        );
      })
      .join("");

    openSheet(
      sheetHead(claim.id + " · " + claim.type, statusText(claim.status)) +
      '<p class="detail-statement">' + esc(claim.statement) + "</p>" +
      '<div class="row wrap mb-12">' + statusBadge(claim.status) +
      '<span class="badge">' + esc(claim.charter || "no charter") + "</span>" +
      gradeDots(grades) + "</div>" +
      '<div class="meter"><span style="width:' + Math.round(claim.confidence * 100) + '%"></span></div>' +
      '<p class="small faint mt-8">Confidence ' + Math.round(claim.confidence * 100) + "% · calibrated, not decorative</p>" +
      '<div class="callout mt-16"><span class="label">Falsifier</span>' + esc(claim.falsifier) + "</div>" +
      (claim.limitations.length
        ? '<p class="kicker mt-16 mb-8">Limitations</p><div class="chips-static">' +
          claim.limitations
            .map(function (l) {
              return '<span class="badge">' + esc(l) + "</span>";
            })
            .join("") + "</div>"
        : "") +
      '<div class="divider"></div>' +
      '<div class="row-between mb-8"><h3>Evidence · ' + evidence.length + '</h3>' +
      '<button class="btn btn-sm btn-primary" data-action="evidence-for" data-id="' + esc(claim.id) +
      '"><svg class="icon"><use href="#i-plus"></use></svg>Record</button></div>' +
      (evidence.length
        ? evidence
            .map(function (ev) {
              return evidenceCard(ev);
            })
            .join("")
        : '<p class="small faint">No evidence yet. Proposed claims may stand on E0 alone; supported needs E2.</p>') +
      '<div class="divider"></div>' +
      '<h3 class="mb-8">History</h3>' +
      '<div class="timeline">' +
      '<div class="timeline-item"><div class="timeline-title">Claim created</div><div class="timeline-sub">' +
      dateLong(claim.createdAt) + " · seq " + claim.createdSeq + "</div></div>" +
      claim.transitions
        .map(function (t) {
          return (
            '<div class="timeline-item is-now"><div class="timeline-title">' + esc(t.from) + " → " + esc(t.to) +
            '</div><div class="timeline-sub">' + esc(t.reason) + " · seq " + t.seq + "</div></div>"
          );
        })
        .join("") +
      "</div>" +
      (claim.corrections.length
        ? '<div class="callout mt-16"><span class="label">Corrections appended</span>' +
          claim.corrections
            .map(function (c) {
              return esc(c.id + ": " + c.reason);
            })
            .join("<br>") + "</div>"
        : "") +
      '<div class="action-list">' +
      '<button class="action-row" data-action="evidence-for" data-id="' + esc(claim.id) +
      '"><svg class="icon"><use href="#i-plus"></use></svg><span class="grow"><span class="title">Record evidence</span><span class="sub">E1–E4, with method, result and artifact reference</span></span></button>' +
      '<button class="action-row" data-action="correction" data-id="' + esc(claim.id) +
      '"><svg class="icon"><use href="#i-correction"></use></svg><span class="grow"><span class="title">Append correction</span><span class="sub">Never edit history; add a new event</span></span></button>' +
      (targets.length ? '<div class="divider"></div><p class="kicker mb-8">Transitions</p>' + transitionButtons : "") +
      "</div>"
    );
  }

  function openEvidenceDetail(id) {
    var ev = model.evidence[id];
    if (!ev) return;
    var source = ev.source || {};
    var sourceText = source.url || source.artifact || source.sha256 || "none recorded";
    openSheet(
      sheetHead(ev.id + " · " + ev.kind, ev.grade + " evidence") +
      '<div class="row wrap mb-12"><span class="grade ' + esc(ev.grade) + '">' + esc(ev.grade) + "</span>" +
      '<span class="badge">' + esc(ev.claim) + "</span>" +
      (ev.reproduces ? '<span class="badge ok">reproduces</span>' : "") +
      (ev.independent ? '<span class="badge info">independent</span>' : "") +
      (ev.adversarial ? '<span class="badge violet">adversarial</span>' : "") + "</div>" +
      '<div class="callout"><span class="label">Method</span>' + esc(ev.method) + "</div>" +
      '<div class="callout"><span class="label">Result</span>' + esc(ev.result) + "</div>" +
      '<dl class="kv">' + kv("Source", sourceText) + kv("Run", ev.run || "—") +
      kv("Recorded by", ev.recordedBy) + kv("Data class", String(ev.dataClass)) +
      kv("Timestamp", dateLong(ev.at)) + kv("Ledger seq", String(ev.seq)) + "</dl>" +
      (ev.limitations && ev.limitations.length
        ? '<p class="kicker mt-16 mb-8">Limitations</p><div class="chips-static">' +
          ev.limitations
            .map(function (l) {
              return '<span class="badge">' + esc(l) + "</span>";
            })
            .join("") + "</div>"
        : "") +
      '<div class="card-actions"><button class="btn btn-sm btn-ghost" data-action="open-claim" data-id="' +
      esc(ev.claim) + '">Open claim</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="open-event" data-seq="' + ev.seq + '">Ledger event</button></div>'
    );
  }

  function openCharterDetail(id) {
    var charter = model.charters[id];
    if (!charter) return;
    openSheet(
      sheetHead(charter.id + " · " + charter.risk.class + " risk", charter.title) +
      '<p class="detail-statement">' + esc(charter.question) + "</p>" +
      '<div class="callout"><span class="label">Why now</span>' + esc(charter.whyNow || "—") + "</div>" +
      '<dl class="kv">' + kv("Status", charter.status) + kv("Program", charter.program || "—") +
      kv("Evidence bar", charter.evidenceBar) + kv("Budget", budgetText(charter.budget)) +
      kv("Owner", charter.owner) + kv("Data class max", String(charter.risk.dataClassMax)) +
      kv("Dual use", charter.risk.dualUse ? "yes" : "no") + "</dl>" +
      '<p class="kicker mt-16 mb-8">Stop conditions</p><div class="chips-static">' +
      charter.stopConditions
        .map(function (s) {
          return '<span class="badge warn">' + esc(s) + "</span>";
        })
        .join("") + "</div>" +
      '<div class="divider"></div><h3 class="mb-8">Gate decisions</h3>' +
      (charter.gates.length
        ? '<div class="timeline">' + charter.gates
            .map(function (gate) {
              return (
                '<div class="timeline-item is-now"><div class="timeline-title">' + esc(gate.gate) + " · " +
                esc(gate.decision) + '</div><div class="timeline-sub">' + esc(gate.signers.join(" + ")) +
                " · packet " + esc(gate.packet || "none") + " · seq " + gate.seq + "</div></div>"
              );
            })
            .join("") + "</div>"
        : '<p class="small faint">No human gate has signed this charter.</p>') +
      '<div class="action-list">' +
      (charter.gates.some(function (g) {
        return g.gate === "frame" && g.decision === "approve";
      })
        ? ""
        : '<button class="action-row" data-action="sign-gate" data-id="' + esc(charter.id) +
          '" data-gate="frame"><svg class="icon"><use href="#i-shield"></use></svg><span class="grow"><span class="title">Sign the frame gate</span><span class="sub">Principal signature · appended as an event</span></span></button>') +
      '<button class="action-row" data-action="open-claim-for-charter" data-id="' + esc(charter.id) +
      '"><svg class="icon"><use href="#i-claim"></use></svg><span class="grow"><span class="title">Create a claim</span><span class="sub">Turn this question into a falsifiable statement</span></span></button>' +
      "</div>"
    );
  }

  function openRegistryDetail(id) {
    var reg = window.ORIGIN_REGISTRY;
    var item = reg && reg.items.filter(function (i) {
      return i.id === id;
    })[0];
    if (!item) return;
    var rows = Object.keys(item)
      .filter(function (key) {
        return ["id", "kind", "name", "status"].indexOf(key) < 0;
      })
      .map(function (key) {
        var value = item[key];
        var text = typeof value === "object" ? JSON.stringify(value) : String(value);
        return kv(labelize(key), truncate(text, 240));
      })
      .join("");
    openSheet(
      sheetHead(item.id + " · " + item.kind, item.name) +
      '<div class="row wrap mb-12"><span class="badge">' + esc(item.kind) + "</span>" +
      '<span class="badge ' + (item.status === "active" ? "ok" : "warn") + '">' + esc(item.status || "—") + "</span>" +
      (item.free_to_use ? '<span class="badge acid">free</span>' : "") +
      (item.requires_paid_service ? '<span class="badge bad">paid</span>' : "") + "</div>" +
      (item.summary || item.intent
        ? '<div class="callout"><span class="label">Purpose</span>' + esc(item.summary || item.intent) + "</div>"
        : "") +
      '<dl class="kv">' + rows + "</dl>" +
      '<p class="kicker mt-16 mb-8">Raw registry record</p>' +
      '<pre class="mono-block">' + esc(JSON.stringify(item, null, 2)) + "</pre>"
    );
  }

  /* --------------------------------------------------------------- actions */

  var actions = {
    nav: function (el) {
      setTab(el.dataset.tab);
    },
    segment: function (el) {
      ui.segment = el.dataset.segment;
      render();
    },
    "ledger-filter": function (el) {
      ui.ledgerFilter = el.dataset.filter;
      Array.prototype.forEach.call(els.view.querySelectorAll("#ledger-chips .chip"), function (chip) {
        chip.classList.toggle("is-active", chip.dataset.filter === ui.ledgerFilter);
      });
      applyLedgerFilter();
    },
    "evidence-filter": function (el) {
      ui.evidenceFilter = el.dataset.grade;
      render();
    },
    "registry-kind": function (el) {
      ui.registryKind = el.dataset.kind;
      Array.prototype.forEach.call(els.view.querySelectorAll("#registry-chips .chip"), function (chip) {
        chip.classList.toggle("is-active", chip.dataset.kind === ui.registryKind);
      });
      applyRegistryFilter();
    },
    "onboard-demo": function () {
      startDemo();
    },
    "onboard-empty": function () {
      startEmpty();
    },
    "onboard-import": function () {
      ui.importFromOnboarding = true;
      els.file.click();
    },
    verify: function () {
      doVerify();
    },
    tamper: function () {
      doTamper();
    },
    selftest: function () {
      var result = core.selfTest();
      openSheet(
        sheetHead("origin-core " + core.version, result.ok ? "Self-test passed" : "Self-test failed") +
        '<p class="small muted">Deterministic vectors executed inside the WebAssembly instance on this device.</p>' +
        '<div class="mt-12">' +
        result.checks
          .map(function (check) {
            return (
              '<div class="gate-line"><svg class="icon"><use href="#i-' + (check.ok ? "check" : "alert") +
              '"></use></svg><span class="grow">' + esc(check.name) + '</span><span class="badge ' +
              (check.ok ? "ok" : "bad") + '">' + (check.ok ? "pass" : "fail") + "</span></div>"
            );
          })
          .join("") +
        "</div>" +
        '<p class="mono-line mt-12">sha256 <b>' + esc(core.meta.sha256 || "—") + "</b></p>"
      );
    },
    "new-charter": function () {
      openCharterForm();
    },
    "new-claim": function () {
      openClaimForm();
    },
    "record-evidence": function () {
      openEvidenceForm(null);
    },
    "evidence-for": function (el) {
      openEvidenceForm(el.dataset.id);
    },
    "open-claim": function (el) {
      openClaimDetail(el.dataset.id);
    },
    "open-evidence": function (el) {
      openEvidenceDetail(el.dataset.id);
    },
    "open-charter": function (el) {
      openCharterDetail(el.dataset.id);
    },
    "open-event": function (el) {
      openEventDetail(el.dataset.seq);
    },
    "open-registry": function (el) {
      openRegistryDetail(el.dataset.id);
    },
    "open-claim-for-charter": function (el) {
      openClaimForm(el.dataset.id);
    },
    transition: function (el) {
      openTransitionForm(el.dataset.id, el.dataset.to);
    },
    correction: function (el) {
      openCorrectionForm(el.dataset.id);
    },
    "sign-gate": function (el) {
      openSignGate(el.dataset.id, el.dataset.gate);
    },
    "transfer-test": function () {
      openTransferTest();
    },
    "export-bundle": function () {
      exportBundle(false);
    },
    "share-bundle": function () {
      exportBundle(true);
    },
    "export-jsonl": function () {
      saveText(
        "originlabs-" + stamp() + ".jsonl",
        store.exportJSONL(),
        "application/x-ndjson",
        "JSONL ledger"
      );
    },
    import: function () {
      ui.importFromOnboarding = false;
      els.file.click();
    },
    "load-demo": function () {
      confirmSheet(
        "Reload the demo lab?",
        "This replaces the current workspace on this device with the synthetic demo ledger. Export a backup first if you need it.",
        "Load demo",
        function () {
          startDemo(true);
        }
      );
    },
    reset: function () {
      confirmSheet(
        "Wipe this workspace?",
        "Every local event will be deleted from this device. The ledger is append-only, but this browser storage is not a backup. Export first if you need the history.",
        "Wipe workspace",
        function () {
          store.reset();
          store = new OriginState.Store(core);
          model = null;
          ui.verification = null;
          closeSheet();
          setTab("home");
          showOnboarding();
          toast("Local workspace wiped", "ok");
        }
      );
    },
    "close-sheet": function () {
      closeSheet();
    },
    copy: function (el) {
      copyText(el.dataset.copy || "");
    },
    external: function (el) {
      openExternal(el.dataset.url);
    },
    install: function () {
      installPwa();
    }
  };

  /* ----------------------------------------------------------------- forms */

  var forms = {
    charter: function (form) {
      var data = new FormData(form);
      var stops = String(data.get("stops") || "")
        .split(/\n+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var id = store.proposeCharter({
        title: field(data, "title"),
        question: field(data, "question"),
        whyNow: field(data, "whyNow"),
        riskClass: field(data, "riskClass"),
        evidenceBar: field(data, "evidenceBar"),
        weeks: Number(field(data, "weeks") || 4),
        dataClassMax: Number(field(data, "dataClassMax") || 1),
        dualUse: data.get("dualUse") === "on",
        stopConditions: stops,
        scopeIn: [],
        scopeOut: []
      });
      closeSheet();
      afterChange("Charter " + id + " proposed · " + (stops.length || 1) + " stop conditions");
      setTab("claims");
      ui.segment = "gates";
      render();
    },
    claim: function (form) {
      var data = new FormData(form);
      var limitations = String(data.get("limitations") || "")
        .split(/\n+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var id = store.createClaim({
        charter: field(data, "charter"),
        statement: field(data, "statement"),
        falsifier: field(data, "falsifier"),
        type: field(data, "type"),
        confidence: Math.max(0, Math.min(1, Number(field(data, "confidence") || 0.5))),
        limitations: limitations
      });
      closeSheet();
      afterChange("Claim " + id + " created as proposed");
      openClaimDetail(id);
    },
    evidence: function (form) {
      var data = new FormData(form);
      var claimId = field(data, "claim");
      var sourceKind = field(data, "sourceKind");
      var sourceValue = field(data, "sourceValue");
      var source = {};
      if (sourceValue) {
        if (sourceKind === "url") source.url = sourceValue;
        else if (sourceKind === "artifact") source.artifact = sourceValue;
        else source.sha256 = sourceValue;
      }
      var id = store.recordEvidence({
        claim: claimId,
        grade: field(data, "grade"),
        kind: field(data, "kind"),
        method: field(data, "method"),
        result: field(data, "result"),
        source: source,
        dataClass: Number(field(data, "dataClass") || 0),
        reproduces: data.get("reproduces") === "on",
        independent: data.get("independent") === "on",
        adversarial: data.get("adversarial") === "on",
        limitations: String(data.get("limitations") || "")
          .split(/\n+/)
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      });
      closeSheet();
      afterChange("Evidence " + id + " recorded against " + claimId);
      openClaimDetail(claimId);
    },
    transition: function (form) {
      var data = new FormData(form);
      var claimId = field(data, "claim");
      var to = field(data, "to");
      store.transitionClaim(claimId, to, field(data, "reason"));
      closeSheet();
      afterChange("Claim " + claimId + " moved to " + to);
      openClaimDetail(claimId);
    },
    correction: function (form) {
      var data = new FormData(form);
      var target = field(data, "target");
      var id = store.appendCorrection(target, field(data, "reason"), field(data, "evidence") || null);
      closeSheet();
      afterChange("Correction " + id + " appended to " + target);
      if (model.claims[target]) openClaimDetail(target);
    },
    gate: function (form) {
      var data = new FormData(form);
      var charterId = field(data, "charter");
      var gate = field(data, "gate");
      store.signGate(charterId, gate, field(data, "packet") || null, [field(data, "reason")]);
      closeSheet();
      afterChange(gate + " gate signed by principal");
      if (ui.tab === "claims" && ui.segment === "gates") render({ keepScroll: true });
    }
  };

  /* --------------------------------------------------------------- actions */

  function startDemo(fromExisting) {
    try {
      closeSheet();
      var result = store.loadDemo();
      model = store.refresh();
      ui.verification = safeVerify();
      hideOnboarding();
      ui.tab = "home";
      ui.segment = "claims";
      render();
      toast(
        (fromExisting ? "Demo reloaded" : "Demo lab opened") + " · " + result.events + " verified events",
        "ok"
      );
    } catch (error) {
      toast("Could not load the demo: " + error.message, "bad");
    }
  }

  function startEmpty() {
    try {
      closeSheet();
      store.newWorkspace("My OriginLab");
      model = store.refresh();
      ui.verification = safeVerify();
      hideOnboarding();
      ui.tab = "home";
      render();
      toast("Empty lab created. Propose a charter to begin.", "ok");
    } catch (error) {
      toast("Could not create the workspace: " + error.message, "bad");
    }
  }

  function importText(text) {
    try {
      closeSheet();
      var result = store.importText(text);
      model = store.refresh();
      ui.verification = safeVerify();
      ui.importFromOnboarding = false;
      hideOnboarding();
      ui.tab = "home";
      ui.segment = "claims";
      render();
      toast(
        "Imported " + result.events + " events · head " + short(result.head, 12) +
          (result.legacy.length ? " · legacy anchor " + result.legacy.join(",") : ""),
        "ok"
      );
    } catch (error) {
      toast("Import rejected: " + error.message, "bad");
    }
  }

  function doVerify() {
    var result = store.verify();
    ui.verification = result;
    model = store.refresh();
    render({ keepScroll: true });
    if (result.ok) {
      toast("Chain verified · " + result.events + " events · head " + short(result.head, 12), "ok");
    } else {
      openSheet(
        sheetHead("origin.verify/v1", "Chain break found") +
        '<p class="small muted">The Rust core recomputed the chain from genesis and refused it. History is not silently repaired.</p>' +
        '<dl class="kv mt-12">' + kv("Events read", String(result.events)) + kv("Head", result.head || "—") +
        kv("Break", result.breaks[0] ? result.breaks[0].reason : "unknown") + "</dl>" +
        '<pre class="mono-block mt-12">' + esc(JSON.stringify(result.breaks, null, 2)) + "</pre>" +
        '<div class="card-actions"><button class="btn btn-sm" data-action="close-sheet">Close</button></div>'
      );
    }
  }

  function doTamper() {
    try {
      var result = store.tamperTest();
      ui.verification = result.clean;
      render({ keepScroll: true });
      openSheet(
        sheetHead("Adversarial check", "Tamper test") +
        '<p class="small muted">One byte was altered in event #' + result.seq +
        ' of a copy of this ledger. The signed copy was not touched.</p>' +
        '<div class="policy-card mt-12"><p class="kicker">Untouched ledger</p><div class="row-between mt-8">' +
        '<span class="badge ok">ok:' + result.clean.ok + '</span><span class="mono small">' +
        result.clean.events + " events</span></div></div>" +
        '<div class="policy-card" style="border-color:rgba(255,122,133,.3);background:rgba(255,122,133,.04)">' +
        '<p class="kicker">Altered copy</p><div class="row-between mt-8">' +
        '<span class="badge bad">ok:' + result.broken.ok + '</span><span class="mono small">' +
        (result.broken.breaks[0] ? esc(result.broken.breaks[0].reason) : "no break") + "</span></div></div>" +
        '<p class="small faint">This is the trust boundary: a valid chain verifies, an altered one fails at the first mismatch.</p>'
      );
    } catch (error) {
      toast("Tamper test failed to run: " + error.message, "bad");
    }
  }

  function openTransferTest() {
    var single = store.tryTransfer("CH-TRANSFER", ["principal"]);
    var dual = store.tryTransfer("CH-TRANSFER", ["principal", "reviewer"]);
    var agent = store.tryTransfer("CH-TRANSFER", ["principal", "agent:builder"]);
    var line = function (label, result) {
      return (
        '<div class="gate-line"><svg class="icon"><use href="#i-' + (result.ok ? "check" : "alert") +
        '"></use></svg><span class="grow">' + esc(label) + '</span><span class="badge ' +
        (result.ok ? "ok" : "bad") + '">' + (result.ok ? "accepted" : "refused") + "</span></div>" +
        (result.ok ? "" : '<p class="small faint" style="margin:0 0 8px 24px">' + esc(result.errors[0]) + "</p>")
      );
    };
    openSheet(
      sheetHead("origin.policy", "Two-key transfer") +
      '<p class="small muted">The rule is evaluated before an event is built. A refused gate never enters the ledger.</p>' +
      '<div class="policy-card mt-12">' +
      line("One human signer", single) +
      line("Human + agent signer", agent) +
      line("Two distinct human signers", dual) +
      "</div>" +
      '<p class="small faint">In this single-principal demo, a real Transfer would require a second human identity on another device or with a separate key. The app deliberately does not fake one.</p>'
    );
  }

  function openSignGate(charterId, gate) {
    var charter = model.charters[charterId];
    openSheet(
      sheetHead("Gate · " + gate, "Sign with principal") +
      '<p class="small muted">' + esc(charter ? charter.title : charterId) + "</p>" +
      '<form data-form="gate" class="mt-12">' +
      '<input type="hidden" name="charter" value="' + esc(charterId) + '">' +
      '<input type="hidden" name="gate" value="' + esc(gate) + '">' +
      '<div class="field"><label for="gate-packet">Evidence packet (optional)</label>' +
      '<input id="gate-packet" name="packet" type="text" placeholder="KN-0000 or artifact id"></div>' +
      '<div class="field"><label for="gate-reason">Reason</label>' +
      '<textarea id="gate-reason" name="reason" required>Falsifiable question, explicit stop conditions and a zero-cost budget.</textarea></div>' +
      '<div class="form-note">Signer: <b>principal</b> (human). Agents are rejected by policy. This signature is appended as a v1 event and cannot be edited later.</div>' +
      '<button class="btn btn-primary btn-block" type="submit"><svg class="icon"><use href="#i-shield"></use></svg>Sign ' +
      esc(gate) + " gate</button></form>"
    );
  }

  function openCharterForm() {
    openSheet(
      sheetHead("New charter", "Frame a question") +
      '<form data-form="charter">' +
      '<div class="field"><label for="ch-title">Title</label><input id="ch-title" name="title" type="text" required maxlength="90" placeholder="Verifiable Knowledge Pipeline"></div>' +
      '<div class="field"><label for="ch-question">Falsifiable question</label><textarea id="ch-question" name="question" required placeholder="Can every claim be traced to evidence and rerun by a stranger?"></textarea></div>' +
      '<div class="field"><label for="ch-why">Why now</label><textarea id="ch-why" name="whyNow" placeholder="What decision changes if this is answered?"></textarea></div>' +
      '<div class="field-row"><div class="field"><label for="ch-risk">Risk class</label><select id="ch-risk" name="riskClass"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></div>' +
      '<div class="field"><label for="ch-bar">Evidence bar</label><select id="ch-bar" name="evidenceBar"><option>E2</option><option>E3</option><option>E4</option></select></div></div>' +
      '<div class="field-row"><div class="field"><label for="ch-weeks">Weeks</label><input id="ch-weeks" name="weeks" type="number" min="1" max="52" value="4"></div>' +
      '<div class="field"><label for="ch-class">Data class max</label><select id="ch-class" name="dataClassMax"><option value="1">1 · internal</option><option value="0">0 · public</option><option value="2">2 · confidential</option></select></div></div>' +
      '<div class="field"><label for="ch-stops">Stop conditions · one per line</label><textarea id="ch-stops" name="stops" required placeholder="A chain break cannot be localised&#10;A class-1 payload leaves the device"></textarea></div>' +
      '<label class="check-row"><input type="checkbox" name="dualUse"> <span>Dual-use risk — route to the high-risk review path</span></label>' +
      '<button class="btn btn-primary btn-block mt-12" type="submit">Propose charter</button>' +
      "</form>"
    );
  }

  function openClaimForm(charterId) {
    if (!model.charterOrder.length) {
      toast("Propose a charter first — every claim belongs to one.", "bad");
      return;
    }
    var options = model.charterOrder
      .map(function (id) {
        var c = model.charters[id];
        return (
          '<option value="' + esc(id) + '"' + (id === charterId ? " selected" : "") + ">" +
          esc(id + " · " + c.title) + "</option>"
        );
      })
      .join("");
    openSheet(
      sheetHead("New claim", "One falsifiable sentence") +
      '<form data-form="claim">' +
      '<div class="field"><label for="cl-charter">Charter</label><select id="cl-charter" name="charter" required>' +
      options + "</select></div>" +
      '<div class="field"><label for="cl-statement">Statement</label><textarea id="cl-statement" name="statement" required placeholder="The Rust core verifies the ledger offline on Android."></textarea></div>' +
      '<div class="field"><label for="cl-falsifier">Falsifier · what observation would kill it?</label><textarea id="cl-falsifier" name="falsifier" required placeholder="The verifier accepts a tampered hash, or a valid chain fails without a network."></textarea></div>' +
      '<div class="field-row"><div class="field"><label for="cl-type">Type</label><select id="cl-type" name="type"><option>analytical</option><option>empirical</option><option>engineering</option><option>definitional</option></select></div>' +
      '<div class="field"><label for="cl-conf">Confidence</label><input id="cl-conf" name="confidence" type="number" min="0" max="1" step="0.05" value="0.5"></div></div>' +
      '<div class="field"><label for="cl-limits">Limitations · one per line</label><textarea id="cl-limits" name="limitations" placeholder="Single device family."></textarea></div>' +
      '<div class="form-note">New claims start as <b>proposed</b>. Supporting one requires E2 evidence; establishing it requires E3 (E4 for high risk).</div>' +
      '<button class="btn btn-primary btn-block" type="submit">Create claim</button></form>'
    );
  }

  function openEvidenceForm(claimId) {
    if (!model.claimOrder.length) {
      toast("Create a claim before recording evidence.", "bad");
      return;
    }
    var options = model.claimOrder
      .slice()
      .reverse()
      .map(function (id) {
        return (
          '<option value="' + esc(id) + '"' + (id === claimId ? " selected" : "") + ">" +
          esc(id + " · " + truncate(model.claims[id].statement, 60)) + "</option>"
        );
      })
      .join("");
    openSheet(
      sheetHead("Record evidence", "Method + result") +
      '<form data-form="evidence">' +
      '<div class="field"><label for="ev-claim">Claim</label><select id="ev-claim" name="claim" required>' + options + "</select></div>" +
      '<div class="field-row"><div class="field"><label for="ev-grade">Grade</label><select id="ev-grade" name="grade"><option>E1</option><option selected>E2</option><option>E3</option><option>E4</option></select></div>' +
      '<div class="field"><label for="ev-kind">Kind</label><select id="ev-kind" name="kind"><option>experiment</option><option>measurement</option><option>proof</option><option>replication</option><option>literature</option><option>review</option></select></div></div>' +
      '<div class="field"><label for="ev-method">Method</label><textarea id="ev-method" name="method" required placeholder="Compile the core to wasm32, build a v1 event, verify the JSONL, then alter one payload byte."></textarea></div>' +
      '<div class="field"><label for="ev-result">Result</label><textarea id="ev-result" name="result" required placeholder="Valid chain ok:true; altered chain ok:false at seq 1 with a hash mismatch."></textarea></div>' +
      '<div class="field-row"><div class="field"><label for="ev-src-kind">Source type</label><select id="ev-src-kind" name="sourceKind"><option value="artifact">Artifact</option><option value="url">URL</option><option value="hash">SHA-256</option></select></div>' +
      '<div class="field"><label for="ev-src">Reference</label><input id="ev-src" name="sourceValue" type="text" placeholder="origin_core.wasm or sha256:…"></div></div>' +
      '<div class="field"><label for="ev-class">Data class</label><select id="ev-class" name="dataClass"><option value="0">0 · public</option><option value="1">1 · internal</option><option value="2">2 · confidential — references only</option></select></div>' +
      '<label class="check-row"><input type="checkbox" name="reproduces" checked> <span>Reproducible from method + artifact by a competent operator</span></label>' +
      '<label class="check-row"><input type="checkbox" name="independent"> <span>Independent of the original producer</span></label>' +
      '<label class="check-row"><input type="checkbox" name="adversarial"> <span>Adversarial review or external validation</span></label>' +
      '<div class="field"><label for="ev-limits">Limitations · one per line</label><textarea id="ev-limits" name="limitations" placeholder="Same operator and device family."></textarea></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Record evidence</button></form>'
    );
  }

  function openTransitionForm(claimId, to) {
    var claim = model.claims[claimId];
    var hint = transitionHint(to, claim, model.charters[claim.charter]);
    openSheet(
      sheetHead(claimId + " · " + claim.status + " → " + to, "Record transition") +
      '<div class="form-note">' + esc(hint) + ". The reason and referenced evidence are hashed into the ledger.</div>" +
      '<form data-form="transition">' +
      '<input type="hidden" name="claim" value="' + esc(claimId) + '">' +
      '<input type="hidden" name="to" value="' + esc(to) + '">' +
      '<div class="form-note">Evidence on file: ' + esc(claim.evidence.join(", ") || "none") + "</div>" +
      '<div class="field"><label for="tr-reason">Reason</label><textarea id="tr-reason" name="reason" required placeholder="Why does the evidence justify this transition?"></textarea></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Move to ' + esc(to) + "</button></form>"
    );
  }

  function openCorrectionForm(target) {
    openSheet(
      sheetHead("Correction · " + target, "Append, never edit") +
      '<div class="form-note">The old record stays in the chain. A correction is a new event that references it.</div>' +
      '<form data-form="correction">' +
      '<input type="hidden" name="target" value="' + esc(target) + '">' +
      '<div class="field"><label for="co-reason">What needs correcting?</label><textarea id="co-reason" name="reason" required placeholder="Narrowed to v0.0.1 defaults; not a claim about all deployments."></textarea></div>' +
      '<div class="field"><label for="co-ev">Supporting evidence id (optional)</label><input id="co-ev" name="evidence" type="text" placeholder="EV-0001"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Append correction</button></form>'
    );
  }

  function confirmSheet(title, copy, label, onConfirm) {
    openSheet(
      sheetHead("Confirm", title) +
      '<p class="small muted">' + esc(copy) + "</p>" +
      '<div class="action-list"><button class="btn btn-danger btn-block" data-action="confirm-run">' +
      esc(label) + "</button>" +
      '<button class="btn btn-ghost btn-block" data-action="close-sheet">Cancel</button></div>'
    );
    actions["confirm-run"] = function () {
      onConfirm();
    };
  }

  /* ------------------------------------------------------------ export/io */

  function exportBundle(share) {
    var bundle = store.exportBundle();
    var text = JSON.stringify(bundle, null, 2) + "\n";
    var name = "originlabs-" + stamp() + ".json";
    if (share && window.OriginHost && window.OriginHost.shareExport) {
      try {
        window.OriginHost.shareExport(name, "application/json", toBase64(text));
        toast("Bundle handed to the share sheet", "ok");
      } catch (error) {
        toast("Share failed: " + error.message, "bad");
      }
      return;
    }
    saveText(name, text, "application/json", "OriginLabs bundle");
  }

  function saveText(name, text, mime, label) {
    if (window.OriginHost && window.OriginHost.saveExport) {
      try {
        var where = window.OriginHost.saveExport(name, mime, toBase64(text));
        toast((label || "File") + " saved · " + where, "ok");
        return;
      } catch (error) {
        toast("Save failed: " + error.message, "bad");
        return;
      }
    }
    var blob = new Blob([text], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
    toast((label || "File") + " downloaded · " + name, "ok");
  }

  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function copyText(text) {
    if (window.OriginHost && window.OriginHost.copy) {
      window.OriginHost.copy(text);
      toast("Copied to clipboard", "ok");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          toast("Copied to clipboard", "ok");
        },
        function () {
          fallbackCopy(text);
        }
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      toast("Copied to clipboard", "ok");
    } catch (e) {
      toast("Could not copy on this device", "bad");
    }
    area.remove();
  }

  function openExternal(url) {
    if (!/^https:\/\//.test(url)) {
      toast("Only HTTPS links are allowed", "bad");
      return;
    }
    if (window.OriginHost && window.OriginHost.openExternal) {
      if (!window.OriginHost.openExternal(url)) {
        toast("This link host is not on the offline allowlist", "bad");
      }
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function installPwa() {
    if (ui.installPrompt) {
      ui.installPrompt.prompt();
      ui.installPrompt = null;
      return;
    }
    if (window.OriginHost) {
      toast("The Android app is already installed. Releases are on GitHub.", "ok");
      return;
    }
    toast("Use your browser menu → “Add to Home screen” to install the PWA.", "ok");
  }

  /* --------------------------------------------------------------- helpers */

  function applyLedgerFilter() {
    var list = document.getElementById("ledger-list");
    if (!list) return;
    var rows = list.querySelectorAll(".event-row");
    var visible = 0;
    Array.prototype.forEach.call(rows, function (row) {
      var kindMatch = ui.ledgerFilter === "all" || row.dataset.group === ui.ledgerFilter;
      var textMatch = !ui.ledgerQuery || (row.dataset.search || "").indexOf(ui.ledgerQuery) >= 0;
      var show = kindMatch && textMatch;
      row.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    var empty = document.getElementById("ledger-empty");
    if (empty) empty.classList.toggle("hidden", visible > 0);
  }

  function applyRegistryFilter() {
    var list = document.getElementById("registry-list");
    if (!list) return;
    var cards = list.querySelectorAll(".reg-card");
    var visible = 0;
    Array.prototype.forEach.call(cards, function (card) {
      var kindMatch = ui.registryKind === "all" || card.dataset.kind === ui.registryKind;
      var textMatch = !ui.registryQuery || (card.dataset.search || "").indexOf(ui.registryQuery) >= 0;
      var show = kindMatch && textMatch;
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    var empty = document.getElementById("registry-empty");
    if (empty) empty.classList.toggle("hidden", visible > 0);
  }

  function claimGrades(claim) {
    var grades = [];
    (claim.evidence || []).forEach(function (id) {
      var ev = model.evidence[id];
      if (ev && grades.indexOf(ev.grade) < 0) grades.push(ev.grade);
    });
    return grades;
  }

  function transitionHint(to, claim, charter) {
    if (to === "investigating") return "Needs at least one E1 traceable citation";
    if (to === "supported") return "Needs at least one E2 reproducible record";
    if (to === "established") {
      return "Needs " + (charter && charter.risk.class === "high" ? "E4" : "E3") + " evidence";
    }
    if (to === "contested") return "Record the contradictory evidence as well";
    if (to === "retracted") return "Keep the record; append the reason";
    if (to === "superseded") return "Link the replacement claim";
    return "Append a new transition event";
  }

  function eventMeta(type) {
    var map = {
      "workspace.created": { label: "Workspace created", icon: "i-home", tone: "acid", group: "workspace" },
      "spec.versioned": { label: "Spec versioned", icon: "i-doc", tone: "blue", group: "spec" },
      "charter.proposed": { label: "Charter proposed", icon: "i-flag", tone: "blue", group: "charter" },
      "charter.approved": { label: "Charter approved", icon: "i-shield", tone: "ok", group: "gate" },
      "claim.created": { label: "Claim created", icon: "i-claim", tone: "violet", group: "claim" },
      "claim.transitioned": { label: "Claim transitioned", icon: "i-arrow", tone: "blue", group: "claim" },
      "evidence.recorded": { label: "Evidence recorded", icon: "i-evidence", tone: "ok", group: "evidence" },
      "gate.decided": { label: "Gate decided", icon: "i-gate", tone: "amber", group: "gate" },
      "artifact.published": { label: "Artifact published", icon: "i-cube", tone: "violet", group: "artifact" },
      "incident.opened": { label: "Incident opened", icon: "i-alert", tone: "red", group: "incident" },
      "correction.appended": { label: "Correction appended", icon: "i-correction", tone: "amber", group: "correction" },
      "run.started": { label: "Run started", icon: "i-terminal", tone: "blue", group: "run" },
      "run.finished": { label: "Run finished", icon: "i-terminal", tone: "ok", group: "run" },
      "artifact.created": { label: "Artifact created", icon: "i-cube", tone: "violet", group: "artifact" },
      "budget.adjusted": { label: "Budget adjusted", icon: "i-clock", tone: "amber", group: "budget" }
    };
    return map[type] || { label: type, icon: "i-ledger", tone: "muted", group: "other" };
  }

  function eventSummary(event) {
    var p = event.payload || {};
    switch (event.type) {
      case "workspace.created":
        return p.name || "Untitled workspace";
      case "spec.versioned":
        return "v" + (p.version || "?") + (p.documents ? " · " + p.documents.length + " documents" : "");
      case "charter.proposed":
        return (p.charter || "CH") + " · " + (p.title || "");
      case "charter.approved":
        return (p.charter || "CH") + " · " + (p.gate || "gate") + " approved by " + (p.signer || "?");
      case "claim.created":
        return (p.claim || "CL") + " · " + truncate(p.statement || "", 90);
      case "claim.transitioned":
        return (p.claim || "CL") + " · " + (p.from || "?") + " → " + (p.to || "?");
      case "evidence.recorded":
        return (p.evidence || "EV") + " · " + (p.grade || "?") + " " + (p.kind || "") + " · " + (p.claim || "");
      case "gate.decided":
        return (p.gate || "gate") + " · " + (p.charter || "") + " · " + (p.signers || []).join(" + ");
      case "artifact.published":
        return (p.artifact || "KN") + " · " + (p.title || "");
      case "incident.opened":
        return (p.incident || "IN") + " · " + (p.title || "");
      case "correction.appended":
        return (p.correction || "CO") + " → " + (p.target || "");
      default:
        return truncate(JSON.stringify(p), 100);
    }
  }

  function searchText(event) {
    return [
      event.seq,
      event.type,
      event.actor,
      event.dataClass,
      event.at,
      event.hash,
      eventSummary(event),
      JSON.stringify(event.payload)
    ]
      .join(" ")
      .toLowerCase();
  }

  function registrySearch(item) {
    return [item.id, item.kind, item.name, item.status, item.summary, item.intent, item.trigger, item.notes, item.spec_ref]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function statusText(status) {
    return (
      { proposed: "Proposed claim", investigating: "Investigating", supported: "Supported", established: "Established", contested: "Contested", retracted: "Retracted", superseded: "Superseded" }[status] ||
      status
    );
  }

  function labelize(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  function budgetText(budget) {
    if (!budget) return "—";
    return [
      budget.weeks ? budget.weeks + "w" : null,
      budget.usd !== undefined ? "$" + budget.usd : null,
      budget.computeHours ? budget.computeHours + "h" : null
    ]
      .filter(Boolean)
      .join(" · ") || "zero-cost";
  }

  function field(data, name) {
    return String(data.get(name) || "").trim();
  }

  function showFormError(form, error) {
    var box = form.querySelector(".form-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "form-error";
      form.insertBefore(box, form.firstChild);
    }
    box.textContent = error.errors && error.errors.length ? error.errors.join("\n") : error.message || String(error);
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function toast(message, tone) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = "toast is-show" + (tone ? " is-" + tone : "");
    toastTimer = setTimeout(function () {
      els.toast.className = "toast";
    }, 3600);
  }

  function esc(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function short(hash, length) {
    if (!hash) return "—";
    var n = length || 12;
    return hash.length > n + 1 ? hash.slice(0, n) + "…" : hash;
  }

  function truncate(text, length) {
    var s = String(text === null || text === undefined ? "" : text);
    return s.length > length ? s.slice(0, length - 1) + "…" : s;
  }

  function timeShort(iso) {
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function dateLong(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return iso;
    }
  }

  function stamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function bytes(n) {
    if (!n) return "0 B";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function platformName() {
    if (window.OriginHost) return "Android";
    return location.protocol === "file:" ? "Offline" : "PWA";
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("./sw.js").catch(function (error) {
      console.warn("Service worker registration failed", error);
    });
  }
})();
