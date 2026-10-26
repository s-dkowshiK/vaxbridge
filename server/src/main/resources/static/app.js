// VaxBridge front end. Talks to the JSON API in ApiController.java, AuthController.java, AccountController.java
// and RecordsController.java. The state formats are built in exports.js.

const $ = (id) => document.getElementById(id);
let antigenNames = {};
let selectedFiles = [];
let user = null;
let summaries = [];

// The record being worked on: what was read, the latest report, and whether it is saved.
const current = {
  record: null,      // the record as read or as last saved
  report: null,      // the last report shown
  savedId: null,     // id in Saved records, or null if not saved yet
  files: [],         // File objects from this upload (not saved yet)
  savedFiles: [],    // files stored with the saved record
  dirty: false,      // entries changed since the last save or report
  state: "",         // the US state the child is enrolling in (picked on the Upload page)
  format: "form",    // what the nurse needs for that state: form, hl7, fhir or csv
};

const STATUS = {
  DUE:        { label: "Due now",                icon: "alert", stat: "Due now",            sub: "catch-up dose needed" },
  UPCOMING:   { label: "Up to date for now",     icon: "clock", stat: "Up to date for now", sub: "more doses later" },
  COMPLETE:   { label: "Complete",               icon: "check", stat: "Complete",           sub: "no action needed" },
  NOT_NEEDED: { label: "Not needed at this age", icon: "minus", stat: "Not needed",         sub: "at this age" },
};

// ---- helpers ---------------------------------------------------------------

function show(view) {
  for (const id of ["dashboard", "records", "upload", "review", "report", "settings", "help"]) {
    $(id).classList.toggle("hidden", id !== view);
  }
  for (const btn of $("nav").querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.view === view);
  }
  if (view === "dashboard") renderDashboard();
  if (view === "records") renderRecords();
  if (view === "report") updateNoReport();
  if (view === "settings") renderSettings();
  window.scrollTo(0, 0);
}

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && user && !path.startsWith("/api/auth/")) {
    signedOut();
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const postJson = (path, body, method = "POST") =>
  api(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatInstant(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  for (const child of children) node.append(child);
  return node;
}

// An icon from the sprite in index.html.
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "i");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function statusPill(status) {
  return el("span", { className: `pill ${status}` }, icon(STATUS[status].icon), STATUS[status].label);
}

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}

const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counts a number up from 0 when a page opens.
function countUp(node, value) {
  if (typeof value !== "number" || value === 0 || reducedMotion()) {
    node.textContent = value;
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    node.textContent = Math.round(value * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// A short message in the corner that goes away by itself.
function toast(text, kind = "ok") {
  const node = el("div", { className: `toast ${kind}` }, icon(kind === "error" ? "alert" : "check"), el("span", { textContent: text }));
  $("toasts").append(node);
  setTimeout(() => node.classList.add("leaving"), 3200);
  setTimeout(() => node.remove(), 3600);
}

// One tooltip for every chart mark with a data-tip attribute.
const tip = el("div", { className: "chart-tip hidden" });
document.body.append(tip);
document.addEventListener("mouseover", (e) => {
  const target = e.target.closest?.("[data-tip]");
  if (!target) return tip.classList.add("hidden");
  tip.textContent = target.dataset.tip;
  tip.classList.remove("hidden");
});
document.addEventListener("mousemove", (e) => {
  if (tip.classList.contains("hidden")) return;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  tip.style.transform = `translate(${x}px, ${e.clientY + 14}px)`;
});

function parseIso(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysFromToday(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseIso(iso) - today) / 86400000);
}

// ---- sign in ---------------------------------------------------------------

let creatingAccount = false;

function setAuthMode(create) {
  creatingAccount = create;
  $("nameField").classList.toggle("hidden", !create);
  $("authSubmit").textContent = create ? "Create account" : "Sign in";
  $("authSwitchText").textContent = create ? "Already have an account?" : "Don't have an account?";
  $("authSwitch").textContent = create ? "Sign in" : "Create one";
  $("authPassword").autocomplete = create ? "new-password" : "current-password";
  setStatus($("authStatus"), "");
}

$("authSwitch").addEventListener("click", () => setAuthMode(!creatingAccount));

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = { email: $("authEmail").value, password: $("authPassword").value };
  if (creatingAccount) body.name = $("authName").value;
  $("authSubmit").disabled = true;
  try {
    signedIn(await postJson(creatingAccount ? "/api/auth/signup" : "/api/auth/login", body));
    $("authPassword").value = "";
  } catch (err) {
    setStatus($("authStatus"), err.message, true);
  } finally {
    $("authSubmit").disabled = false;
  }
});

async function signedIn(u) {
  user = u;
  applyTheme(u.theme);
  renderUser();
  $("signin").classList.add("hidden");
  $("app").classList.remove("hidden");
  await loadSummaries();
  show("dashboard");
}

function signedOut() {
  user = null;
  summaries = [];
  Object.assign(current, { record: null, report: null, savedId: null, files: [], savedFiles: [], dirty: false, state: "", format: "form" });
  setFiles([]);
  $("review").classList.remove("open");
  $("report").classList.remove("open");
  applyTheme(null);
  $("app").classList.add("hidden");
  $("signin").classList.remove("hidden");
  setAuthMode(false);
}

$("signOutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  signedOut();
});

// ---- navigation ------------------------------------------------------------

for (const btn of $("nav").querySelectorAll("button")) {
  btn.addEventListener("click", () => show(btn.dataset.view));
}
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-goto], .go-upload");
  if (!target) return;
  if (target.classList.contains("go-upload")) startNewRecord();
  else show(target.dataset.goto);
});
$("newRecordBtn").addEventListener("click", startNewRecord);

function startNewRecord() {
  setFiles([]);
  setUploadChoice("", "form");
  setStatus($("uploadStatus"), "");
  show("upload");
}

// ---- saved records: dashboard and list --------------------------------------

async function loadSummaries() {
  try {
    summaries = await api("/api/records");
  } catch {
    summaries = [];
  }
  const due = summaries.filter((s) => s.counts.DUE > 0).length;
  $("userMeta").textContent = plural(summaries.length, "saved record");
  $("recordCount").textContent = summaries.length || "";
  $("dueBadge").textContent = due;
  $("dueBadge").classList.toggle("hidden", !due);
  $("alertStrip").replaceChildren(...(due
    ? [el("div", { className: "DUE" }, icon("alert"), `${plural(due, "child", "children")} with doses due now`)]
    : []));
  $("alertStrip").classList.toggle("hidden", !due);
}

function stat(kind, value, label, sub) {
  const number = el("b");
  countUp(number, value);
  return el("div", { className: `stat ${kind}` },
    number, el("p", { className: "label", textContent: label }), el("p", { className: "sub", textContent: sub }));
}

function recordFacts(s) {
  return el("div", { className: "facts" },
    ...(s.country ? [el("span", {}, icon("globe"), s.country)] : []),
    el("span", {}, icon("calendar"), `Born ${formatDate(s.dateOfBirth)}`));
}

function renderDashboard() {
  $("today").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const childrenDue = summaries.filter((s) => s.counts.DUE > 0);
  const dosesDue = summaries.reduce((n, s) => n + s.counts.DUE, 0);
  const upToDate = summaries.filter((s) => s.counts.DUE === 0).length;
  $("dashStats").replaceChildren(
    stat("plain", summaries.length, "Saved records", "children checked"),
    stat("plain", dosesDue, "Vaccines due now", "across all children"),
    stat("COMPLETE", upToDate, "Up to date", "nothing due today"),
    stat("DUE", childrenDue.length, "Need a visit", "children with doses due"),
  );

  const empty = summaries.length === 0;
  $("dashEmpty").classList.toggle("hidden", !empty);
  $("dashGrid").classList.toggle("hidden", empty);
  $("dashCharts").classList.toggle("hidden", empty);
  if (empty) return;
  renderStatusChart();
  renderUpcoming();
  renderCountryChart();

  $("recentList").replaceChildren(...summaries.slice(0, 5).map((s) =>
    el("button", { className: "mini-item", onclick: () => openSaved(s.id) },
      el("div", { className: "tile" }, icon("file")),
      el("div", { className: "grow" },
        el("p", { className: "strong", textContent: s.childName || "Unnamed child" }),
        el("p", { className: "sub", textContent: `${s.country || "Unknown country"} · saved ${formatInstant(s.updatedAt)}` })),
      s.counts.DUE ? statusPill("DUE") : statusPill(s.counts.UPCOMING ? "UPCOMING" : "COMPLETE"))));

  $("attentionList").replaceChildren(...(childrenDue.length
    ? childrenDue.map((s) => el("button", { className: "mini-item DUE", onclick: () => openSaved(s.id) },
        icon("alert"),
        el("div", { className: "grow" },
          el("p", { className: "strong", textContent: s.childName || "Unnamed child" }),
          el("p", { className: "sub", textContent: `${plural(s.counts.DUE, "vaccine")} due: ${s.dueVaccines.join(", ")}` }))))
    : [el("div", { className: "mini-empty" }, icon("check"),
        el("p", { className: "strong", textContent: "All caught up" }),
        el("p", { className: "sub", textContent: "No saved child has a dose due today." }))]));
}

// Ring chart: every vaccine for every saved child, by status.
const STATUS_COLOR = { DUE: "var(--due)", UPCOMING: "var(--soon)", COMPLETE: "var(--ok)", NOT_NEEDED: "var(--off)" };

function renderStatusChart() {
  const totals = Object.fromEntries(Object.keys(STATUS).map((k) => [k, summaries.reduce((n, s) => n + (s.counts[k] || 0), 0)]));
  const all = Object.values(totals).reduce((a, b) => a + b, 0);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "donut");
  const r = 48, length = 2 * Math.PI * r, gap = all > 1 ? 2 : 0;
  let offset = 0;
  const track = document.createElementNS(ns, "circle");
  Object.entries({ cx: 60, cy: 60, r, class: "donut-track" }).forEach(([k, v]) => track.setAttribute(k, v));
  svg.append(track);
  for (const [k, n] of Object.entries(totals)) {
    if (!n) continue;
    const arc = document.createElementNS(ns, "circle");
    const size = (n / all) * length;
    Object.entries({ cx: 60, cy: 60, r, class: "donut-seg", stroke: STATUS_COLOR[k],
      "stroke-dasharray": `${Math.max(size - gap, 0.5)} ${length}`, "stroke-dashoffset": -offset })
      .forEach(([a, v]) => arc.setAttribute(a, v));
    arc.dataset.tip = `${STATUS[k].stat}: ${plural(n, "vaccine")} (${Math.round((n / all) * 100)}%)`;
    svg.append(arc);
    offset += size;
  }
  const onTrack = all ? Math.round(((all - totals.DUE) / all) * 100) : 0;
  const center = el("div", { className: "donut-center" }, el("b", { textContent: `${onTrack}%` }), el("span", { textContent: "on track" }));
  const legend = el("ul", { className: "legend" }, ...Object.keys(STATUS).map((k) => el("li", {},
    el("i", { style: `background: ${STATUS_COLOR[k]}` }),
    el("span", { className: "grow", textContent: STATUS[k].stat }),
    el("b", { textContent: totals[k] }))));
  $("statusChart").replaceChildren(el("div", { className: "donut-box" }, svg, center), legend);
}

// The earliest catch-up date for each child, soonest first.
function renderUpcoming() {
  const soon = summaries.filter((s) => s.nextDose && daysFromToday(s.nextDose) <= 90)
    .sort((a, b) => a.nextDose.localeCompare(b.nextDose)).slice(0, 6);
  $("upcomingList").replaceChildren(...(soon.length
    ? soon.map((s) => {
        const days = daysFromToday(s.nextDose);
        const when = days <= 0 ? "Due now" : days === 1 ? "Tomorrow" : `In ${days} days`;
        const date = parseIso(s.nextDose);
        return el("button", { className: `up-item ${days <= 0 ? "DUE" : ""}`, onclick: () => openSaved(s.id) },
          el("div", { className: "cal" },
            el("span", { textContent: date.toLocaleDateString("en-US", { month: "short" }) }),
            el("b", { textContent: date.getDate() })),
          el("div", { className: "grow" },
            el("p", { className: "strong", textContent: s.childName || "Unnamed child" }),
            el("p", { className: "sub", textContent: s.dueVaccines.length ? s.dueVaccines.join(", ") : "Next dose in the series" })),
          el("span", { className: "when", textContent: when }));
      })
    : [el("div", { className: "mini-empty" }, icon("check"),
        el("p", { className: "strong", textContent: "Nothing in the next 90 days" }),
        el("p", { className: "sub", textContent: "No saved child has a catch-up date coming up soon." }))]));
}

// Bar chart: how many saved records come from each country.
function renderCountryChart() {
  const byCountry = {};
  summaries.forEach((s) => { const c = s.country || "Unknown"; byCountry[c] = (byCountry[c] || 0) + 1; });
  let rows = Object.entries(byCountry).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length > 6) rows = [...rows.slice(0, 5), ["Other", rows.slice(5).reduce((n, r) => n + r[1], 0)]];
  const max = Math.max(...rows.map((r) => r[1]));
  $("countryChart").replaceChildren(...rows.map(([c, n]) => el("div", { className: "bar-row" },
    el("span", { className: "bar-label", textContent: c }),
    el("div", { className: "bar-track" }, Object.assign(el("div", { className: "bar" }), { style: `--w: ${(n / max) * 100}%` })),
    el("b", { textContent: n }))));
  for (const [i, row] of [...$("countryChart").children].entries()) {
    row.dataset.tip = `${rows[i][0]}: ${plural(rows[i][1], "record")}`;
  }
}

let recordFilter = "all";
for (const btn of $("recordFilters").children) {
  btn.addEventListener("click", () => {
    recordFilter = btn.dataset.filter;
    for (const b of $("recordFilters").children) b.classList.toggle("active", b === btn);
    renderRecords();
  });
}
$("recordSearch").addEventListener("input", renderRecords);
$("recordSort").addEventListener("change", renderRecords);

let recordLayout = "grid";
try { recordLayout = localStorage.getItem("vaxbridge.layout") || "grid"; } catch {}
for (const btn of $("recordView").children) {
  btn.addEventListener("click", () => {
    recordLayout = btn.dataset.layout;
    try { localStorage.setItem("vaxbridge.layout", recordLayout); } catch {}
    renderRecords();
  });
}

const SORTS = {
  updated: (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  name: (a, b) => (a.childName || "").localeCompare(b.childName || ""),
  due: (a, b) => b.counts.DUE - a.counts.DUE || (a.childName || "").localeCompare(b.childName || ""),
  next: (a, b) => (a.nextDose || "9999").localeCompare(b.nextDose || "9999"),
};

function recordTable(rows) {
  const cell = (text, className = "") => el("span", { className, textContent: text });
  return [el("div", { className: "rt-row rt-head" },
      cell("Child"), cell("Country", "hide-sm"), cell("Born", "hide-sm"), cell("Due now"), cell("Next dose", "hide-sm"), cell("Saved", "hide-sm")),
    ...rows.map((s) => el("button", { className: "rt-row", onclick: () => openSaved(s.id) },
      el("span", { className: "rt-name" }, el("span", { className: "avatar sm", textContent: initials(s.childName || "?") }), s.childName || "Unnamed child"),
      cell(s.country || "—", "hide-sm"),
      cell(formatDate(s.dateOfBirth), "hide-sm mono"),
      s.counts.DUE ? el("span", {}, el("span", { className: "pill DUE" }, icon("alert"), `${s.counts.DUE} due`))
        : el("span", {}, el("span", { className: "pill COMPLETE" }, icon("check"), "None")),
      cell(s.nextDose ? formatDate(s.nextDose) : "—", "hide-sm mono"),
      cell(formatInstant(s.updatedAt), "hide-sm mono")))];
}

function renderRecords() {
  const q = $("recordSearch").value.trim().toLowerCase();
  const shown = summaries
    .filter((s) => recordFilter === "all" || (recordFilter === "due") === (s.counts.DUE > 0))
    .filter((s) => !q || `${s.childName} ${s.country}`.toLowerCase().includes(q))
    .sort(SORTS[$("recordSort").value]);
  for (const b of $("recordView").children) b.classList.toggle("active", b.dataset.layout === recordLayout);
  $("recordGrid").classList.toggle("hidden", recordLayout !== "grid");
  $("recordTable").classList.toggle("hidden", recordLayout !== "table" || !shown.length);
  $("recordTable").replaceChildren(...(recordLayout === "table" ? recordTable(shown) : []));
  $("recordsSub").textContent = plural(summaries.length, "record") + " saved to your account";
  $("recordGrid").replaceChildren(...shown.map((s) => el("button", { className: "record-card", onclick: () => openSaved(s.id) },
    el("div", { className: "top" },
      el("div", { className: "tile" }, icon("file")),
      el("div", { className: "grow" },
        el("p", { className: "strong", textContent: s.childName || "Unnamed child" }),
        recordFacts(s)),
      icon("right")),
    el("div", { className: "pills" },
      el("span", { className: "pill plain", textContent: plural(s.entryCount, "entry", "entries") }),
      ...(s.counts.DUE ? [el("span", { className: "pill DUE" }, icon("alert"), `${s.counts.DUE} due now`)] : []),
      ...(s.counts.UPCOMING ? [el("span", { className: "pill UPCOMING" }, icon("clock"), `${s.counts.UPCOMING} later`)] : []),
      ...(!s.counts.DUE && !s.counts.UPCOMING ? [el("span", { className: "pill COMPLETE" }, icon("check"), "Up to date")] : []),
      ...(s.fileCount ? [el("span", { className: "pill plain" }, icon("image"), plural(s.fileCount, "photo"))] : [])))));
  $("recordsEmpty").classList.toggle("hidden", shown.length > 0);
  $("recordsEmptyTitle").textContent = summaries.length ? "No matching records" : "No saved records yet";
  $("recordsEmptyText").textContent = summaries.length
    ? "Try a different name or filter."
    : "Upload a record, check it, and tap Save to records on the Report page.";
}

async function openSaved(id) {
  try {
    const detail = await api(`/api/records/${id}`);
    loadRecord(detail.record, { savedId: id, savedFiles: detail.files, state: detail.summary.state || "" });
    showReport(detail.report);
  } catch (err) {
    alertStatus(err.message);
  }
}

function alertStatus(message) {
  show("records");
  $("recordsEmpty").classList.remove("hidden");
  $("recordsEmptyTitle").textContent = "Couldn't open that record";
  $("recordsEmptyText").textContent = message;
}

// ---- step 1: upload --------------------------------------------------------

function setFiles(files) {
  selectedFiles = files;
  $("selectedCard").classList.toggle("hidden", files.length === 0);
  $("fileList").replaceChildren(...files.map((f, i) => el("div", { className: "file-item" },
    el("div", { className: "tile" }, icon("file")),
    el("div", { className: "grow" },
      el("p", { className: "strong", textContent: f.name }),
      el("p", { className: "sub", textContent: `${Math.max(1, Math.round(f.size / 1024))} KB · Ready to read` })),
    el("button", { title: "Remove", onclick: () => setFiles(selectedFiles.filter((_, j) => j !== i)) }, icon("x")))));
  $("readBtn").disabled = files.length === 0;
  $("readBtn").textContent = files.length > 1 ? `Read record (${files.length} pages)` : "Read record";
}

function addFiles(list) {
  const known = new Set(selectedFiles.map((f) => f.name + f.size));
  setFiles([...selectedFiles, ...[...list].filter((f) => !known.has(f.name + f.size))]);
}

$("files").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
$("cameraInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
$("browseBtn").addEventListener("click", (e) => { e.stopPropagation(); if (stateChosen()) $("files").click(); });
$("cameraBtn").addEventListener("click", (e) => { e.stopPropagation(); if (stateChosen()) $("cameraInput").click(); });

const drop = $("dropzone");
drop.addEventListener("click", () => { if (stateChosen()) $("files").click(); });
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  if (stateChosen()) addFiles(e.dataTransfer.files);
});

function processing(on) {
  $("pickStage").classList.toggle("hidden", on);
  $("processing").classList.toggle("hidden", !on);
}

$("readBtn").addEventListener("click", async () => {
  if (!stateChosen()) return;
  const form = new FormData();
  selectedFiles.forEach((f) => form.append("files", f));
  setStatus($("uploadStatus"), "");
  processing(true);
  try {
    const record = await api("/api/extract", { method: "POST", body: form });
    loadRecord(record, { files: selectedFiles, ...uploadChoice });
    show("review");
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  } finally {
    processing(false);
  }
});

$("sampleBtn").addEventListener("click", async () => {
  if (!stateChosen()) return;
  try {
    loadRecord(await api("/api/sample"), { ...uploadChoice });
    show("review");
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  }
});

// ---- step 2: review --------------------------------------------------------

// Fills the Review page with a record and makes it the current one.
function loadRecord(record, { savedId = null, savedFiles = [], files = [], state = "", format = "form" } = {}) {
  Object.assign(current, { record, report: null, savedId, savedFiles, files, dirty: false, state, format });
  $("childName").value = record.childName || "";
  $("dob").value = record.dateOfBirth || "";
  $("country").value = record.country || "";
  $("language").value = record.language || "";

  $("warnings").replaceChildren(...(record.warnings || []).map((w) =>
    el("div", { className: "warning" }, icon("alert"), el("span", { textContent: w }))));
  $("entryRows").replaceChildren();
  (record.entries || []).forEach(addRow);
  setStatus($("reviewStatus"), "");
  $("review").classList.add("open");
  $("report").classList.remove("open");
}

function addRow(entry = {}) {
  const row = $("rowTemplate").content.firstElementChild.cloneNode(true);
  row.querySelector(".orig").value = entry.originalText || "";
  row.querySelector(".english").value = entry.englishName || "";
  row.querySelector(".date").value = entry.date || "";
  row.querySelector(".as-written").textContent = entry.dateAsWritten ? `Date on record: ${entry.dateAsWritten}` : "";
  row.querySelector(".note").textContent = entry.notes || "";
  // Kept so a saved record still shows what was on the card and what the reader was unsure about.
  row.dataset.dateAsWritten = entry.dateAsWritten || "";
  row.dataset.confidence = entry.confidence || "high";
  row.dataset.notes = entry.notes || "";
  if (entry.confidence === "low") {
    row.classList.add("low");
    row.querySelector(".as-written").before(el("span", { className: "pill low", style: "margin-top: 6px" }, icon("alert"), "Check"));
  }

  const chips = row.querySelector(".chips");
  const addChip = (code) => {
    if (!code || [...chips.children].some((c) => c.dataset.code === code)) return;
    chips.append(el("span", {
      className: "chip",
      title: `${antigenNames[code] || code} (click to remove)`,
      textContent: code,
      onclick: (e) => { e.target.remove(); entriesChanged(); },
    }));
    chips.lastChild.dataset.code = code;
  };
  (entry.antigens || []).forEach(addChip);

  const select = row.querySelector(".add-antigen");
  for (const [code, name] of Object.entries(antigenNames)) {
    select.append(el("option", { value: code, textContent: `${code}: ${name}` }));
  }
  select.addEventListener("change", () => { addChip(select.value); select.value = ""; });
  row.querySelector(".remove").addEventListener("click", () => { row.remove(); entriesChanged(); });
  $("entryRows").append(row);
}

function readRows() {
  return [...$("entryRows").children].map((row) => ({
    originalText: row.querySelector(".orig").value,
    englishName: row.querySelector(".english").value,
    antigens: [...row.querySelectorAll(".chip")].map((c) => c.dataset.code),
    date: row.querySelector(".date").value || null,
    dateAsWritten: row.dataset.dateAsWritten,
    confidence: row.dataset.confidence,
    notes: row.dataset.notes,
  }));
}

// The record as the nurse has reviewed it, in the same shape the server reads.
function reviewedRecord() {
  return {
    childName: $("childName").value,
    dateOfBirth: $("dob").value,
    country: $("country").value,
    language: $("language").value,
    warnings: current.record?.warnings || [],
    entries: readRows(),
  };
}

// Any edit means the report no longer matches the entries until they are checked again.
function entriesChanged() {
  current.dirty = true;
  $("report").classList.remove("open");
}
$("review").addEventListener("input", entriesChanged);

$("addRow").addEventListener("click", () => { addRow(); entriesChanged(); });
$("backToUpload").addEventListener("click", () => show("upload"));

$("evaluateBtn").addEventListener("click", async () => {
  const dob = $("dob").value;
  if (!dob) {
    setStatus($("reviewStatus"), "Enter the child's date of birth first.", true);
    return;
  }
  try {
    showReport(await postJson("/api/evaluate", { dateOfBirth: dob, entries: readRows() }));
  } catch (err) {
    setStatus($("reviewStatus"), err.message, true);
  }
});

// ---- step 3: report --------------------------------------------------------

function updateNoReport() {
  const hasRecord = $("review").classList.contains("open");
  $("noReportText").textContent = hasRecord
    ? "The entries changed since the last check. Check them against the US schedule to see the report."
    : "Upload a record and check it against the US schedule, or open a saved record.";
  $("noReportAction").replaceChildren(...(hasRecord
    ? [icon("list"), " Back to review"]
    : [icon("upload"), " Upload record"]));
  $("noReportAction").classList.toggle("go-upload", !hasRecord);
  $("noReportAction").dataset.goto = hasRecord ? "review" : "";
  if (!hasRecord) delete $("noReportAction").dataset.goto;
}

function showReport(report) {
  current.report = report;
  const entries = readRows();
  const missingDates = entries.filter((e) => !e.date).length;
  const name = $("childName").value || "Unnamed child";
  const from = [$("country").value, $("language").value].filter(Boolean).join(", ");
  const metaItem = (iconName, text) => el("span", {}, icon(iconName), text);
  $("reportMeta").replaceChildren(
    el("span", { className: "strong", textContent: name, style: "color: var(--foreground)" }),
    metaItem("calendar", `Born ${formatDate(report.dateOfBirth)}`),
    metaItem("globe", `Record from ${from || "unknown"}`),
    metaItem("check", `Checked ${formatDate(report.asOf)}`),
    metaItem("list", `${entries.length} entries reviewed`),
  );

  const counts = {};
  report.series.forEach((s) => (counts[s.status] = (counts[s.status] || 0) + 1));
  $("summaryCounts").replaceChildren(...Object.keys(STATUS).map((k) => stat(k, counts[k] || 0, STATUS[k].stat, STATUS[k].sub)));
  $("skippedWarning")?.remove();
  if (missingDates) {
    $("summaryCounts").after(el("div", { className: "warning", id: "skippedWarning" }, icon("alert"),
      el("span", { textContent: `${missingDates} entr${missingDates === 1 ? "y was" : "ies were"} skipped because they have no date.` })));
  }

  // Most urgent first.
  const order = { DUE: 0, UPCOMING: 1, COMPLETE: 2, NOT_NEEDED: 3 };
  const sorted = [...report.series].sort((a, b) => order[a.status] - order[b.status]);
  $("seriesList").replaceChildren(...sorted.map(seriesRow));
  renderTimeline(report, sorted);

  $("ignoredList").replaceChildren();
  if (report.ignored.length) {
    $("ignoredList").append(el("div", { className: "card ignored" },
      el("p", { className: "card-title" }, icon("minus"), "Other vaccines on the record"),
      el("ul", {}, ...report.ignored.map((d) =>
        el("li", { textContent: `${d.sourceText || d.antigen} (${formatDate(d.given)}): ${d.reason}` })))));
  }

  renderFiles();
  renderSaveState();
  setStatus($("saveStatus"), "");
  $("report").classList.add("open");
  renderState();
  show("report");
}

function seriesRow(s) {
  const pending = s.nextDoses.length && s.status !== "COMPLETE";
  const next = el("div", { className: "next" });
  if (pending) {
    next.append(formatDate(s.nextDoses[0]));
    if (s.nextDoses.length > 1) next.append(el("p", { className: "sub", textContent: `+${s.nextDoses.length - 1} more` }));
  } else {
    next.append("—");
  }

  const row = el("div", { className: "series" }, el("div", { className: "series-main" },
    el("div", {}, el("h3", { textContent: s.name }), el("p", { className: "summary", textContent: s.summary }), seriesProgress(s)),
    next,
    el("div", {}, statusPill(s.status))));

  if (s.doses.length) {
    row.append(el("ul", { className: "doses" }, ...s.doses.map((d) => el("li", { className: d.valid ? "ok" : "bad" },
      icon(d.valid ? "check" : "x"),
      el("span", { className: "d", textContent: formatDate(d.given) }),
      el("span", { textContent: (d.sourceText || d.antigen) + (d.valid ? "" : `: ${d.reason}`) })))));
  }
  if (pending) {
    const plan = s.nextDoses.map((d, i) => `Dose ${i + 1} on or after ${formatDate(d)}`).join(" · ");
    row.append(el("p", { className: "plan" }, el("b", { textContent: "Catch-up plan (earliest dates): " }), plan));
  }
  if (s.notes.length) {
    row.append(el("ul", { className: "notes" }, ...s.notes.map((n) => el("li", { textContent: n }))));
  }
  return row;
}

// "2 of 4 doses": valid doses on the record against valid doses plus the doses still planned.
function seriesProgress(s) {
  const valid = s.doses.filter((d) => d.valid).length;
  const total = valid + (s.status === "COMPLETE" ? 0 : s.nextDoses.length);
  if (!total || s.status === "NOT_NEEDED") return "";
  return el("div", { className: `progress ${s.status}` },
    el("div", { className: "progress-track" }, Object.assign(el("div", { className: "progress-fill" }), { style: `--w: ${(valid / total) * 100}%` })),
    el("span", { textContent: `${valid} of ${plural(total, "dose")}` }));
}

// Every dose on the record and every catch-up dose still planned, on one line per vaccine from birth onward.
function renderTimeline(report, series) {
  const rows = series.filter((s) => s.doses.length || (s.status !== "COMPLETE" && s.nextDoses.length));
  const box = $("timeline");
  box.classList.toggle("hidden", !rows.length || !report.dateOfBirth);
  if (!rows.length || !report.dateOfBirth) return box.replaceChildren();

  const birth = parseIso(report.dateOfBirth);
  const asOf = parseIso(report.asOf);
  const dates = rows.flatMap((s) => [...s.doses.map((d) => d.given), ...(s.status === "COMPLETE" ? [] : s.nextDoses)]).filter(Boolean).map(parseIso);
  const end = new Date(Math.max(asOf, ...dates));
  end.setMonth(end.getMonth() + 3);
  const span = end - birth || 1;
  const at = (date) => `${Math.min(100, Math.max(0, ((date - birth) / span) * 100))}%`;

  // Age marks along the bottom: every year, or every few years for older children.
  const years = span / (365.25 * 86400000);
  const every = years <= 8 ? 1 : years <= 16 ? 2 : 4;
  const ticks = [];
  for (let y = 0; y <= years; y += every) {
    const d = new Date(birth);
    d.setFullYear(birth.getFullYear() + y);
    ticks.push(el("span", { className: "tick", style: `left: ${at(d)}`, textContent: y === 0 ? "Birth" : `${y}y` }));
  }

  const mark = (kind, iso, label) => {
    const node = el("span", { className: `mark ${kind}`, style: `left: ${at(parseIso(iso))}` });
    node.dataset.tip = label;
    return node;
  };
  const lines = rows.map((s) => el("div", { className: "tl-row" },
    el("span", { className: "tl-name", textContent: s.name }),
    el("div", { className: "tl-track" },
      el("span", { className: "today", style: `left: ${at(asOf)}` }),
      ...s.doses.map((d) => mark(d.valid ? "given" : "invalid", d.given,
        `${s.name}: ${d.sourceText || d.antigen}, ${formatDate(d.given)}${d.valid ? "" : ` (doesn't count: ${d.reason})`}`)),
      ...(s.status === "COMPLETE" ? [] : s.nextDoses.map((d, i) => mark("planned", d, `${s.name}: catch-up dose ${i + 1}, on or after ${formatDate(d)}`))))));

  box.replaceChildren(
    el("div", { className: "card-row" },
      el("p", { className: "card-title" }, icon("activity"), "Vaccine timeline"),
      el("ul", { className: "tl-legend" },
        el("li", {}, el("span", { className: "mark given" }), "Dose on record"),
        el("li", {}, el("span", { className: "mark invalid" }), "Doesn't count"),
        el("li", {}, el("span", { className: "mark planned" }), "Catch-up (earliest)"),
        el("li", {}, el("span", { className: "today-key" }), "Today"))),
    el("div", { className: "tl" }, ...lines, el("div", { className: "tl-row tl-axis" }, el("span"), el("div", { className: "tl-ticks" }, ...ticks))));
}

// Thumbnails of the original photos, from this upload or from the saved record.
function renderFiles() {
  const items = current.savedId
    ? current.savedFiles.map((f) => ({ name: f.name, type: f.contentType, url: f.url || `/api/records/${current.savedId}/files/${f.id}` }))
    : current.files.map((f) => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) }));
  $("filesCard").classList.toggle("hidden", items.length === 0);
  $("filesList").replaceChildren(...items.map((f) => el("a", { className: "file-thumb", href: f.url, target: "_blank", rel: "noopener" },
    el("div", { className: "frame" }, f.type?.startsWith("image/") ? el("img", { src: f.url, alt: f.name }) : icon("file")),
    el("span", { textContent: f.name }))));
}

function renderSaveState() {
  const btn = $("saveBtn");
  const saved = current.savedId && !current.dirty;
  btn.classList.toggle("saved", !!saved);
  btn.disabled = !!saved;
  btn.replaceChildren(icon(saved ? "check" : "save"), " ",
    el("span", { textContent: saved ? "Saved to records" : current.savedId ? "Save changes" : "Save to records" }));
  $("deleteRow").classList.toggle("hidden", !current.savedId);
  $("deleteBtn").classList.remove("confirm");
  $("deleteBtn").lastChild.textContent = " Delete this saved record";
}

$("saveBtn").addEventListener("click", async () => {
  const record = reviewedRecord();
  $("saveBtn").disabled = true;
  try {
    if (current.savedId) {
      await postJson(`/api/records/${current.savedId}?state=${encodeURIComponent(current.state)}`, record, "PUT");
    } else {
      const form = new FormData();
      form.append("record", new Blob([JSON.stringify(record)], { type: "application/json" }));
      if (current.state) form.append("state", current.state);
      current.files.forEach((f) => form.append("files", f));
      const summary = await api("/api/records", { method: "POST", body: form });
      current.savedId = summary.id;
      current.savedFiles = (await api(`/api/records/${summary.id}`)).files;
    }
    current.record = record;
    current.dirty = false;
    await loadSummaries();
    renderFiles();
    setStatus($("saveStatus"), "");
    toast("Saved. You can find it any time under Saved records.");
  } catch (err) {
    setStatus($("saveStatus"), err.message, true);
  }
  renderSaveState();
});

// Deleting takes two clicks so a record isn't lost by accident.
$("deleteBtn").addEventListener("click", async () => {
  const btn = $("deleteBtn");
  if (!btn.classList.contains("confirm")) {
    btn.classList.add("confirm");
    btn.lastChild.textContent = " Click again to delete for good";
    return;
  }
  try {
    await api(`/api/records/${current.savedId}`, { method: "DELETE" });
    Object.assign(current, { savedId: null, savedFiles: [], record: null, report: null });
    $("review").classList.remove("open");
    $("report").classList.remove("open");
    await loadSummaries();
    show("records");
    toast("Record deleted.");
  } catch (err) {
    setStatus($("saveStatus"), err.message, true);
  }
});

$("backToReview").addEventListener("click", () => show("review"));
$("printBtn").addEventListener("click", () => window.print());

// ---- settings --------------------------------------------------------------

const ACCENTS = [
  ["Teal", "#0B7A5E"], ["Indigo", "#4F46E5"], ["Rose", "#E11D48"],
  ["Amber", "#D97706"], ["Slate", "#475569"], ["Violet", "#7C3AED"],
];
const BACKGROUNDS = [
  ["light", "Light", "#F5F6F8"], ["warm", "Warm", "#F7F4EF"], ["cool", "Cool", "#EEF3F9"], ["dark", "Dark", "#0F131B"],
];
const DEFAULT_THEME = { accent: "#0B7A5E", background: "light", radius: 12, textSize: 16 };
let theme = { ...DEFAULT_THEME };
let avatarVersion = Date.now();

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mixWhite = (hex, amount) => rgbToHex(hexToRgb(hex).map((v) => v + (255 - v) * amount));

// White or near-black text, whichever reads better on the color.
function textOn(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1A1F2E" : "#ffffff";
}

function applyTheme(saved) {
  theme = { ...DEFAULT_THEME, ...(saved || {}) };
  if (!/^#[0-9a-fA-F]{6}$/.test(theme.accent)) theme.accent = DEFAULT_THEME.accent;
  if (!BACKGROUNDS.some(([key]) => key === theme.background)) theme.background = DEFAULT_THEME.background;
  theme.radius = Math.min(24, Math.max(0, Number(theme.radius) || 0));
  theme.textSize = Math.min(19, Math.max(13, Number(theme.textSize) || DEFAULT_THEME.textSize));

  const root = document.documentElement;
  // On a dark background the accent is lightened so text in that color stays readable.
  const primary = theme.background === "dark" ? mixWhite(theme.accent, 0.3) : theme.accent;
  root.dataset.bg = theme.background;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", textOn(primary));
  root.style.setProperty("--radius", `${theme.radius}px`);
  root.style.setProperty("--radius-lg", `${theme.radius + 4}px`);
  root.style.setProperty("--text-zoom", theme.textSize / 16);
}

function avatarNode(target) {
  target.replaceChildren(user.hasAvatar
    ? el("img", { src: user.avatarUrl || `/api/account/avatar?v=${avatarVersion}`, alt: "" })
    : initials(user.name));
}

function renderUser() {
  avatarNode($("userInitials"));
  $("userName").textContent = user.name;
}

function renderSettings() {
  avatarNode($("settingsAvatar"));
  $("avatarRemove").classList.toggle("hidden", !user.hasAvatar);
  $("profileName").value = user.name;
  $("profileEmail").value = user.email;
  $("passwordUser").value = user.email;
  for (const id of ["profileStatus", "themeStatus", "passwordStatus"]) setStatus($(id), "");
  renderThemeControls();
}

function renderThemeControls() {
  const preset = ACCENTS.find(([, hex]) => hex.toLowerCase() === theme.accent.toLowerCase());
  $("accentValue").textContent = preset ? preset[0] : theme.accent.toUpperCase();
  const custom = el("input", { type: "color", value: theme.accent, title: "Pick any color" });
  custom.addEventListener("input", () => changeTheme({ accent: custom.value }, false));
  custom.addEventListener("change", () => changeTheme({ accent: custom.value }));
  $("accentSwatches").replaceChildren(
    ...ACCENTS.map(([name, hex]) => el("button", {
      type: "button", className: `swatch${preset && preset[1] === hex ? " active" : ""}`, title: name,
      style: `background: ${hex}`, onclick: () => changeTheme({ accent: hex }),
    })),
    el("label", { className: `swatch custom${preset ? "" : " active"}`, title: "Custom color" }, custom));
  $("bgOptions").replaceChildren(...BACKGROUNDS.map(([key, name, color]) => el("button", {
    type: "button", className: `bg-option${theme.background === key ? " active" : ""}`,
    onclick: () => changeTheme({ background: key }),
  }, el("span", { className: "swatch-bg", style: `background: ${color}` }, el("i"), el("i")), name)));
  $("radiusInput").value = theme.radius;
  $("radiusValue").textContent = `${theme.radius}px`;
  $("textSizeInput").value = theme.textSize;
  $("textSizeValue").textContent = theme.textSize === 16 ? "16px (default)" : `${theme.textSize}px`;
}

// Shows a change right away; saves it to the account shortly after the last change.
let themeTimer;
function changeTheme(change, rerender = true) {
  applyTheme({ ...theme, ...change });
  if (rerender) renderThemeControls();
  else $("accentValue").textContent = theme.accent.toUpperCase();
  clearTimeout(themeTimer);
  setStatus($("themeStatus"), "Saving…");
  themeTimer = setTimeout(() => saveTheme(theme), 600);
}

async function saveTheme(value) {
  try {
    user = { ...user, ...(await postJson("/api/account", { theme: value }, "PUT")) };
    setStatus($("themeStatus"), "Saved to your account.");
  } catch (err) {
    setStatus($("themeStatus"), err.message, true);
  }
}

$("radiusInput").addEventListener("input", (e) => changeTheme({ radius: Number(e.target.value) }));
$("textSizeInput").addEventListener("input", (e) => changeTheme({ textSize: Number(e.target.value) }));
$("themeReset").addEventListener("click", () => {
  clearTimeout(themeTimer);
  applyTheme(null);
  renderThemeControls();
  saveTheme(null);
});

$("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    user = await postJson("/api/account", { name: $("profileName").value, email: $("profileEmail").value }, "PUT");
    renderUser();
    renderSettings();
    toast("Profile saved.");
  } catch (err) {
    setStatus($("profileStatus"), err.message, true);
  }
});

$("avatarBtn").addEventListener("click", () => $("avatarInput").click());
$("avatarInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    setStatus($("profileStatus"), "Use a picture smaller than 2 MB.", true);
    return;
  }
  const form = new FormData();
  form.append("file", file);
  try {
    user = await api("/api/account/avatar", { method: "PUT", body: form });
    avatarVersion = Date.now();
    renderUser();
    renderSettings();
    toast("Picture updated.");
  } catch (err) {
    setStatus($("profileStatus"), err.message, true);
  }
});
$("avatarRemove").addEventListener("click", async () => {
  try {
    user = await api("/api/account/avatar", { method: "DELETE" });
    renderUser();
    renderSettings();
  } catch (err) {
    setStatus($("profileStatus"), err.message, true);
  }
});

$("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await postJson("/api/account/password",
      { currentPassword: $("currentPassword").value, newPassword: $("newPassword").value }, "PUT");
    $("currentPassword").value = "";
    $("newPassword").value = "";
    setStatus($("passwordStatus"), "");
    toast("Password changed.");
  } catch (err) {
    setStatus($("passwordStatus"), err.message, true);
  }
});

// ---- state and format ------------------------------------------------------

// Chosen on the Upload page before the record is read: the state the child is enrolling in, and the
// format the nurse needs for that state. The Report page then lays the record out for that state.
const FORMATS = {
  form: { action: (st) => `Open ${st} school form`, icon: "print" },
  hl7: { action: () => "Download .hl7", icon: "download" },
  fhir: { action: () => "Download FHIR .json", icon: "download" },
  csv: { action: () => "Download .csv", icon: "download" },
};
const uploadChoice = { state: "", format: "form" };

const findState = (name) => STATES.find((s) => s.name === name) || null;
const chosenState = () => findState(current.state);
const stateOptions = (blank) => [el("option", { value: "", textContent: blank }),
  ...STATES.map((s) => el("option", { value: s.name, textContent: s.name }))];

$("uploadState").replaceChildren(...stateOptions("Choose a state"));
$("stateSelect").replaceChildren(...stateOptions("Choose a state"));

function setUploadChoice(state, format) {
  Object.assign(uploadChoice, { state, format });
  $("uploadState").value = state;
  const st = findState(state);
  const form = st && STATE_FORMS[st.name];
  for (const b of $("formatChoice").children) {
    b.classList.toggle("active", b.dataset.format === format);
    b.disabled = !st;  // the state comes first
  }
  $("formChoiceSub").textContent = form ? `${form.number || form.title}, printable` : "Printable, in the state's layout";
  $(`pickStage`).querySelector(".setup").classList.remove("needs-state");
  if (st) setStatus($("uploadStatus"), "");
}

// Reading a record needs the state first, so the right form is ready when the report is.
function stateChosen() {
  if (uploadChoice.state) return true;
  $("pickStage").querySelector(".setup").classList.add("needs-state");
  setStatus($("uploadStatus"), "Choose the state the child is enrolling in first.", true);
  $("uploadState").focus();
  return false;
}

$("uploadState").addEventListener("change", () => setUploadChoice($("uploadState").value, uploadChoice.format));
for (const b of $("formatChoice").children) {
  b.addEventListener("click", () => setUploadChoice(uploadChoice.state, b.dataset.format));
}
setUploadChoice("", "form");

// Changing the state on the Report page; a saved record keeps the new state.
$("stateSelect").addEventListener("change", async () => {
  current.state = $("stateSelect").value;
  renderState();
  if (current.savedId && !current.dirty && current.state) {
    await postJson(`/api/records/${current.savedId}?state=${encodeURIComponent(current.state)}`, reviewedRecord(), "PUT").catch(() => {});
    loadSummaries();
  }
});

function renderState() {
  const state = chosenState();
  $("stateSelect").value = state ? state.name : "";
  for (const id of ["registryInfo"]) $(id).classList.toggle("hidden", !state);
  for (const node of $("stateSection").children) {
    if (!node.classList.contains("section-head") && !node.classList.contains("state-pick")) node.classList.toggle("hidden", !state);
  }
  const action = $("formActionBtn");
  if (!state) {
    $("stateHeading").textContent = "State school form";
    action.replaceChildren(icon("map"), " ", el("span", { textContent: "Choose a state" }));
    return;
  }
  const fmt = FORMATS[current.format] || FORMATS.form;
  action.replaceChildren(icon(fmt.icon), " ", el("span", { textContent: fmt.action(state.name) }));
  for (const card of document.querySelectorAll("[data-card]")) card.classList.toggle("chosen", card.dataset.card === current.format);
  $("stateHeading").textContent = `For ${state.name}`;
  const myIr = state.url.includes("myirmobile.com");
  $("registryInfo").replaceChildren(
    el("div", { className: "tile" }, icon("map")),
    el("div", { className: "grow" },
      el("p", { className: "strong", textContent: state.registry || `${state.name} immunization registry` }),
      el("p", { className: "sub", textContent: myIr
        ? "Families can see their record in MyIR Mobile once a clinic adds the doses."
        : "Where the state keeps immunization records. Families can ask for a copy here once a clinic adds the doses." }),
      el("a", { className: "link", href: state.url, target: "_blank", rel: "noopener" }, icon("external"), "State registry page"),
      el("br"),
      el("a", { className: "link", href: CDC_DIRECTORY, target: "_blank", rel: "noopener" }, icon("external"), "CDC directory of all state registries")));
  $("hl7Text").textContent = `The message format state immunization registries accept from clinics. A clinic enrolled with ${
    state.registry || `the ${state.name} registry`} uploads it as historical doses.`;

  const layout = stateLayout(state, current.report);
  const form = layout.form;
  const formName = form ? `${form.title}${form.number ? ` (${form.number})` : ""}` : null;
  $("formInfo").replaceChildren(...(form
    ? [el("p", { className: "form-name", textContent: form.title }),
       ...(form.number ? [el("p", { className: "tag", textContent: form.number })] : []),
       ...(form.by ? [el("p", { className: "sub", textContent: `Who signs: ${form.by}` })] : []),
       ...(form.note ? [el("p", { className: "sub", textContent: form.note })] : []),
       ...(form.rows ? [] : [el("p", { className: "sub", textContent: "VaxBridge has the form's name but not its layout, so the grid uses the standard layout." })]),
       ...(form.url ? [el("a", { className: "link", href: form.url, target: "_blank", rel: "noopener" }, icon("external"), "Official form or instructions")] : [])]
    : [el("p", { className: "form-name", textContent: "No form on file" }),
       el("p", { className: "sub", textContent: `VaxBridge doesn't have ${state.name}'s school form yet, so the grid uses the layout most state forms share. Check with the school or the state health department for the form they want.` })]));

  const reqs = layout.requirements;
  const has = (key) => key === "Tdap"
    ? current.report.series.some((s) => s.doses.some((d) => d.antigen === "Tdap" && d.valid))
    : current.report.series.some((s) => s.key === key && s.status === "COMPLETE");
  $("reqTitle").textContent = `What ${state.name} schools require`;
  $("stateReqs").replaceChildren(...(reqs
    ? [el("ul", { className: "req-list" }, ...reqs.map((r) => el("li", { className: has(r.key) ? "" : "missing" },
         el("span", { textContent: r.name }), el("span", { textContent: r.when })))),
       el("p", { className: "sub", style: "margin-top: 10px; font-size: 12px" }, "Red means the record doesn't show this series complete yet. From ",
         el("a", { className: "link", href: REQUIREMENTS_SOURCE, target: "_blank", rel: "noopener", style: "font-size: 12px" }, "Immunize.org (May 2026)"),
         ". Grades vary, so confirm with the school.")]
    : [el("p", { className: "sub", textContent: "VaxBridge doesn't have this territory's school requirements. Check with the health department." })]));

  $("printTag").textContent = formName ? `Laid out like ${formName}` : "Standard layout, for a provider to sign";
  $("printText").textContent = formName
    ? `Each dose sits in the same row and dose column as on ${state.name}'s form, so it can be copied straight across, with MM/DD/YYYY dates.`
    : "Every dose in a vaccine-by-dose grid with MM/DD/YYYY dates, the layout most state school forms use.";

  const columns = Math.max(...layout.rows.map((r) => r.columns), 1);
  $("gridTitle").textContent = form ? `Doses as ${form.number || form.title} lists them` : "Doses by vaccine (standard layout)";
  $("doseGrid").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", { textContent: "Vaccine" }),
      ...Array.from({ length: columns }, (_, i) => el("th", { textContent: form?.list ? (i ? "" : "Dates given") : `Dose ${i + 1}` })))),
    el("tbody", {}, ...layout.rows.map((r) => el("tr", {},
      el("td", {}, r.label, ...(r.required ? [el("span", { className: "req", textContent: "Required" })] : [])),
      ...Array.from({ length: columns }, (_, i) => {
        if (i >= r.columns) return el("td", { className: "off" });
        const d = r.doses[i];
        if (!d) return el("td", { className: "none" });
        return el("td", { className: d.valid ? "" : "bad", textContent: usDate(d.date) + (d.valid ? "" : " ✕"),
          title: d.valid ? "" : `Doesn't count: ${d.reason}` });
      })))));
  $("gridExtra").textContent = layout.extra.length
    ? `Not on this form: ${layout.extra.map((d) => `${d.sourceText || d.antigen} ${usDate(d.given)}`).join(", ")}. They're listed separately on the printout.`
    : "";
  setStatus($("exportStatus"), "");
}

function fileBase() {
  const name = ($("childName").value || "record").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${name || "record"}-${chosenState().code.toLowerCase()}`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportAs(kind) {
  const state = chosenState();
  if (!state) {
    $("stateSelect").focus();
    return;
  }
  const record = reviewedRecord();
  if (kind === "form") {
    const page = buildPrintable(record, current.report, state);
    const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else download(`${fileBase()}-school-record.html`, page, "text/html");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  if (kind === "hl7") download(`${fileBase()}.hl7`, buildHl7(record, state), "application/hl7-v2");
  if (kind === "fhir") download(`${fileBase()}.fhir.json`, buildFhir(record), "application/fhir+json");
  if (kind === "csv") download(`${fileBase()}.csv`, buildCsv(record), "text/csv");
  toast(`Downloaded the ${state.name} ${kind === "form" ? "school form" : kind.toUpperCase()} file.`);
  setStatus($("exportStatus"), `Downloaded. ${exportDoses(record).length} doses for ${state.name}. Check it against the original before anyone uses it.`);
}

for (const btn of document.querySelectorAll("[data-export]")) {
  btn.addEventListener("click", () => exportAs(btn.dataset.export));
}
$("formActionBtn").addEventListener("click", () => {
  if (chosenState()) exportAs(current.format);
  else $("stateSection").scrollIntoView({ behavior: "smooth" });
});

// ---- quick search (Ctrl+K) -------------------------------------------------

const PAGES = [
  ["dashboard", "Dashboard", "activity"], ["records", "Saved records", "folder"], ["upload", "Upload record", "upload"],
  ["review", "Review entries", "list"], ["report", "Report", "file"], ["settings", "Settings", "settings"], ["help", "Help", "help"],
];
let paletteItems = [];
let paletteIndex = 0;

function openPalette() {
  if (!user) return;
  $("palette").classList.remove("hidden");
  $("paletteInput").value = "";
  renderPalette();
  $("paletteInput").focus();
}

function closePalette() {
  $("palette").classList.add("hidden");
}

function renderPalette() {
  const q = $("paletteInput").value.trim().toLowerCase();
  const records = summaries.filter((s) => !q || `${s.childName} ${s.country}`.toLowerCase().includes(q)).slice(0, 6)
    .map((s) => ({ group: "Records", label: s.childName || "Unnamed child", sub: [s.country, s.counts.DUE ? `${s.counts.DUE} due now` : "up to date"].filter(Boolean).join(" · "),
      icon: s.counts.DUE ? "alert" : "file", run: () => openSaved(s.id) }));
  const pages = PAGES.filter(([, label]) => !q || label.toLowerCase().includes(q))
    .map(([view, label, ic]) => ({ group: "Pages", label, sub: "", icon: ic, run: () => (view === "upload" ? startNewRecord() : show(view)) }));
  const actions = [{ group: "Actions", label: "Upload a new record", sub: "", icon: "plus", run: startNewRecord }]
    .filter((a) => !q || a.label.toLowerCase().includes(q));
  paletteItems = [...records, ...pages, ...actions];
  paletteIndex = Math.min(paletteIndex, Math.max(paletteItems.length - 1, 0));
  let group = "";
  const nodes = [];
  paletteItems.forEach((item, i) => {
    if (item.group !== group) nodes.push(el("p", { className: "palette-group", textContent: (group = item.group) }));
    nodes.push(el("button", { className: `palette-item ${i === paletteIndex ? "active" : ""}`, onmouseenter: () => { paletteIndex = i; highlightPalette(); },
      onclick: () => runPalette(i) },
      icon(item.icon), el("span", { className: "grow", textContent: item.label }), el("span", { className: "sub", textContent: item.sub })));
  });
  if (!nodes.length) nodes.push(el("p", { className: "palette-empty sub", textContent: "Nothing matches." }));
  $("paletteList").replaceChildren(...nodes);
}

function highlightPalette() {
  [...$("paletteList").querySelectorAll(".palette-item")].forEach((b, i) => {
    b.classList.toggle("active", i === paletteIndex);
    if (i === paletteIndex) b.scrollIntoView({ block: "nearest" });
  });
}

function runPalette(i) {
  const item = paletteItems[i];
  closePalette();
  item?.run();
}

$("searchBtn").addEventListener("click", openPalette);
$("paletteInput").addEventListener("input", () => { paletteIndex = 0; renderPalette(); });
$("palette").addEventListener("click", (e) => { if (e.target === $("palette")) closePalette(); });
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    $("palette").classList.contains("hidden") ? openPalette() : closePalette();
    return;
  }
  if ($("palette").classList.contains("hidden")) return;
  if (e.key === "Escape") closePalette();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = paletteItems.length;
    if (n) paletteIndex = (paletteIndex + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
    highlightPalette();
  }
  if (e.key === "Enter") { e.preventDefault(); runPalette(paletteIndex); }
});

// ---- start -----------------------------------------------------------------

api("/api/antigens").then((names) => (antigenNames = names)).catch(() => {});
api("/api/auth/me").then(signedIn).catch(() => signedOut());
