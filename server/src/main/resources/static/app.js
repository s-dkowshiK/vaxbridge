// VaxBridge front end. Talks to the JSON API in ApiController.java, AuthController.java and RecordsController.java.

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
};

const STATUS = {
  DUE:        { label: "Due now",                icon: "alert", stat: "Due now",            sub: "catch-up dose needed" },
  UPCOMING:   { label: "Up to date for now",     icon: "clock", stat: "Up to date for now", sub: "more doses later" },
  COMPLETE:   { label: "Complete",               icon: "check", stat: "Complete",           sub: "no action needed" },
  NOT_NEEDED: { label: "Not needed at this age", icon: "minus", stat: "Not needed",         sub: "at this age" },
};

// ---- helpers ---------------------------------------------------------------

function show(view) {
  for (const id of ["dashboard", "records", "upload", "review", "report", "help"]) {
    $(id).classList.toggle("hidden", id !== view);
  }
  for (const btn of $("nav").querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.view === view);
  }
  if (view === "dashboard") renderDashboard();
  if (view === "records") renderRecords();
  if (view === "report") updateNoReport();
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
  $("signin").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("userInitials").textContent = initials(u.name);
  $("userName").textContent = u.name;
  await loadSummaries();
  show("dashboard");
}

function signedOut() {
  user = null;
  summaries = [];
  Object.assign(current, { record: null, report: null, savedId: null, files: [], savedFiles: [], dirty: false });
  setFiles([]);
  $("review").classList.remove("open");
  $("report").classList.remove("open");
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
  return el("div", { className: `stat ${kind}` },
    el("b", { textContent: value }), el("p", { className: "label", textContent: label }), el("p", { className: "sub", textContent: sub }));
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
  if (empty) return;

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

let recordFilter = "all";
for (const btn of $("recordFilters").children) {
  btn.addEventListener("click", () => {
    recordFilter = btn.dataset.filter;
    for (const b of $("recordFilters").children) b.classList.toggle("active", b === btn);
    renderRecords();
  });
}
$("recordSearch").addEventListener("input", renderRecords);

function renderRecords() {
  const q = $("recordSearch").value.trim().toLowerCase();
  const shown = summaries
    .filter((s) => recordFilter === "all" || (recordFilter === "due") === (s.counts.DUE > 0))
    .filter((s) => !q || `${s.childName} ${s.country}`.toLowerCase().includes(q));
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
    loadRecord(detail.record, { savedId: id, savedFiles: detail.files });
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
$("browseBtn").addEventListener("click", (e) => { e.stopPropagation(); $("files").click(); });
$("cameraBtn").addEventListener("click", (e) => { e.stopPropagation(); $("cameraInput").click(); });

const drop = $("dropzone");
drop.addEventListener("click", () => $("files").click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  addFiles(e.dataTransfer.files);
});

function processing(on) {
  $("pickStage").classList.toggle("hidden", on);
  $("processing").classList.toggle("hidden", !on);
}

$("readBtn").addEventListener("click", async () => {
  const form = new FormData();
  selectedFiles.forEach((f) => form.append("files", f));
  setStatus($("uploadStatus"), "");
  processing(true);
  try {
    const record = await api("/api/extract", { method: "POST", body: form });
    loadRecord(record, { files: selectedFiles });
    show("review");
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  } finally {
    processing(false);
  }
});

$("sampleBtn").addEventListener("click", async () => {
  try {
    loadRecord(await api("/api/sample"));
    show("review");
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  }
});

// ---- step 2: review --------------------------------------------------------

// Fills the Review page with a record and makes it the current one.
function loadRecord(record, { savedId = null, savedFiles = [], files = [] } = {}) {
  Object.assign(current, { record, report: null, savedId, savedFiles, files, dirty: false });
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
    el("div", {}, el("h3", { textContent: s.name }), el("p", { className: "summary", textContent: s.summary })),
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
      await postJson(`/api/records/${current.savedId}`, record, "PUT");
    } else {
      const form = new FormData();
      form.append("record", new Blob([JSON.stringify(record)], { type: "application/json" }));
      current.files.forEach((f) => form.append("files", f));
      const summary = await api("/api/records", { method: "POST", body: form });
      current.savedId = summary.id;
      current.savedFiles = (await api(`/api/records/${summary.id}`)).files;
    }
    current.record = record;
    current.dirty = false;
    await loadSummaries();
    renderFiles();
    setStatus($("saveStatus"), "Saved. You can find it any time under Saved records.");
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
  } catch (err) {
    setStatus($("saveStatus"), err.message, true);
  }
});

$("backToReview").addEventListener("click", () => show("review"));
$("printBtn").addEventListener("click", () => window.print());

// ---- start -----------------------------------------------------------------

api("/api/antigens").then((names) => (antigenNames = names)).catch(() => {});
api("/api/auth/me").then(signedIn).catch(() => signedOut());
