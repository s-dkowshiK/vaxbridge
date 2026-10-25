// VaxBridge front end. Talks to the JSON API in ApiController.java.

const $ = (id) => document.getElementById(id);
let antigenNames = {};
let selectedFiles = [];
let lastRecord = null;

const STATUS = {
  DUE:        { label: "Due now",                icon: "alert", stat: "Due now",            sub: "catch-up dose needed" },
  UPCOMING:   { label: "Up to date for now",     icon: "clock", stat: "Up to date for now", sub: "more doses later" },
  COMPLETE:   { label: "Complete",               icon: "check", stat: "Complete",           sub: "no action needed" },
  NOT_NEEDED: { label: "Not needed at this age", icon: "minus", stat: "Not needed",         sub: "at this age" },
};

// ---- helpers ---------------------------------------------------------------

function show(view) {
  for (const id of ["upload", "review", "report", "help"]) {
    $(id).classList.toggle("hidden", id !== view);
  }
  for (const btn of $("nav").querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.view === view);
  }
  window.scrollTo(0, 0);
}

function enableNav(view, on = true) {
  $("nav").querySelector(`[data-view="${view}"]`).disabled = !on;
}

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

// ---- navigation ------------------------------------------------------------

for (const btn of $("nav").querySelectorAll("button")) {
  btn.addEventListener("click", () => show(btn.dataset.view));
}
$("newRecordBtn").addEventListener("click", () => { setFiles([]); show("upload"); });

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
    showReview(await api("/api/extract", { method: "POST", body: form }));
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  } finally {
    processing(false);
  }
});

$("sampleBtn").addEventListener("click", async () => {
  try {
    showReview(await api("/api/sample"));
  } catch (err) {
    setStatus($("uploadStatus"), err.message, true);
  }
});

// ---- step 2: review --------------------------------------------------------

function showReview(record) {
  lastRecord = record;
  $("childName").value = record.childName || "";
  $("dob").value = record.dateOfBirth || "";
  $("country").value = record.country || "";
  $("language").value = record.language || "";

  $("warnings").replaceChildren(...(record.warnings || []).map((w) =>
    el("div", { className: "warning" }, icon("alert"), el("span", { textContent: w }))));
  $("entryRows").replaceChildren();
  (record.entries || []).forEach(addRow);
  setStatus($("reviewStatus"), "");
  updateChildCard();
  setReportAlerts(null);
  enableNav("review");
  enableNav("report", false);
  show("review");
}

function updateChildCard() {
  const name = $("childName").value || "Unnamed child";
  const rows = $("entryRows").children.length;
  $("childInitials").textContent = initials(name);
  $("childCardName").textContent = name;
  $("childCardMeta").textContent = [$("country").value, `${rows} entr${rows === 1 ? "y" : "ies"}`].filter(Boolean).join(" · ");
  $("childCard").classList.remove("hidden");
}

function addRow(entry = {}) {
  const row = $("rowTemplate").content.firstElementChild.cloneNode(true);
  row.querySelector(".orig").value = entry.originalText || "";
  row.querySelector(".english").value = entry.englishName || "";
  row.querySelector(".date").value = entry.date || "";
  row.querySelector(".as-written").textContent = entry.dateAsWritten ? `Date on record: ${entry.dateAsWritten}` : "";
  row.querySelector(".note").textContent = entry.notes || "";
  if (entry.confidence === "low") {
    row.classList.add("low");
    row.querySelector(".as-written").before(el("span", { className: "pill low" }, icon("alert"), "Check"));
    row.querySelector(".pill").style.marginTop = "6px";
  }

  const chips = row.querySelector(".chips");
  const addChip = (code) => {
    if (!code || [...chips.children].some((c) => c.dataset.code === code)) return;
    chips.append(el("span", {
      className: "chip",
      title: `${antigenNames[code] || code} (click to remove)`,
      textContent: code,
      onclick: (e) => { e.target.remove(); reportStale(); },
    }));
    chips.lastChild.dataset.code = code;
  };
  (entry.antigens || []).forEach(addChip);

  const select = row.querySelector(".add-antigen");
  for (const [code, name] of Object.entries(antigenNames)) {
    select.append(el("option", { value: code, textContent: `${code}: ${name}` }));
  }
  select.addEventListener("change", () => { addChip(select.value); select.value = ""; });
  row.querySelector(".remove").addEventListener("click", () => { row.remove(); reportStale(); updateChildCard(); });
  $("entryRows").append(row);
}

function readRows() {
  return [...$("entryRows").children].map((row) => ({
    originalText: row.querySelector(".orig").value,
    englishName: row.querySelector(".english").value,
    antigens: [...row.querySelectorAll(".chip")].map((c) => c.dataset.code),
    date: row.querySelector(".date").value || null,
  }));
}

// Any edit after a report was made means the report no longer matches the entries.
function reportStale() {
  enableNav("report", false);
  setReportAlerts(null);
}
$("review").addEventListener("input", () => { reportStale(); updateChildCard(); });

$("addRow").addEventListener("click", () => { addRow(); reportStale(); updateChildCard(); });
$("backToUpload").addEventListener("click", () => show("upload"));

$("evaluateBtn").addEventListener("click", async () => {
  const dob = $("dob").value;
  if (!dob) {
    setStatus($("reviewStatus"), "Enter the child's date of birth first.", true);
    return;
  }
  const entries = readRows();
  const missing = entries.filter((e) => !e.date).length;
  try {
    const report = await api("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateOfBirth: dob, entries }),
    });
    showReport(report, entries, missing);
  } catch (err) {
    setStatus($("reviewStatus"), err.message, true);
  }
});

// ---- step 3: report --------------------------------------------------------

function setReportAlerts(counts) {
  const due = counts?.DUE || 0;
  const upcoming = counts?.UPCOMING || 0;
  $("dueBadge").textContent = due;
  $("dueBadge").classList.toggle("hidden", !due);
  $("alertStrip").replaceChildren(
    ...(due ? [el("div", { className: "DUE" }, icon("alert"), `${due} vaccine${due > 1 ? "s" : ""} due now`)] : []),
    ...(upcoming ? [el("div", { className: "UPCOMING" }, icon("clock"), `${upcoming} with more doses later`)] : []),
  );
  $("alertStrip").classList.toggle("hidden", !due && !upcoming);
}

function showReport(report, entries, missingDates) {
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
  $("summaryCounts").replaceChildren(...Object.keys(STATUS).map((k) => el("div", { className: `stat ${k}` },
    el("b", { textContent: counts[k] || 0 }),
    el("p", { className: "label", textContent: STATUS[k].stat }),
    el("p", { className: "sub", textContent: STATUS[k].sub }))));
  if (missingDates) {
    $("summaryCounts").after(el("div", { className: "warning", id: "skippedWarning" }, icon("alert"),
      el("span", { textContent: `${missingDates} entr${missingDates === 1 ? "y was" : "ies were"} skipped because they have no date.` })));
  }
  $("skippedWarning")?.previousElementSibling !== $("summaryCounts") && $("skippedWarning")?.remove();

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

  setReportAlerts(counts);
  enableNav("report");
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

$("backToReview").addEventListener("click", () => show("review"));
$("printBtn").addEventListener("click", () => window.print());

// ---- start -----------------------------------------------------------------

api("/api/antigens").then((names) => (antigenNames = names)).catch(() => {});
