// VaxBridge state formats: turns a reviewed record into the files states and clinics use.
// Everything here is a transcription for a licensed provider to check and sign. Nothing is sent anywhere.

// State and territory immunization registries, from the CDC directory
// (https://www.cdc.gov/iis/contacts-locate-records/index.html). registry is null where the CDC page gives no name.
const STATES = [
  {"name": "Alabama", "code": "AL", "registry": "Immunization Provider Registry with Internet Technology (ImmPRINT)", "url": "https://www.alabamapublichealth.gov/Immunization/"},
  {"name": "Alaska", "code": "AK", "registry": null, "url": "https://health.alaska.gov/dph/Epi/iz/Pages/records.aspx"},
  {"name": "Arizona", "code": "AZ", "registry": "Arizona State Immunization Information System", "url": "https://irr.azdhs.gov/irr-form.php"},
  {"name": "Arkansas", "code": "AR", "registry": null, "url": "https://healthy.arkansas.gov/programs-services/community-family-child-health/immunizations/"},
  {"name": "California", "code": "CA", "registry": "California Immunization Registry (CAIR)", "url": "https://myvaccinerecord.cdph.ca.gov/"},
  {"name": "Colorado", "code": "CO", "registry": "Colorado Immunization Information System (CIIS)", "url": "https://cdphe.colorado.gov/prevention-and-wellness/disease-and-injury-prevention/immunization/for-the-public/get-a-copy-of"},
  {"name": "Connecticut", "code": "CT", "registry": "Connecticut WebIZ", "url": "https://portal.ct.gov/dph/individuals-and-families/immunizations/public-landing-page/ct-wiz"},
  {"name": "Delaware", "code": "DE", "registry": null, "url": "https://delvaxpublicportal.dhss.delaware.gov/"},
  {"name": "District of Columbia", "code": "DC", "registry": null, "url": "https://vaccines.dc.gov/page/immunization-records-docket"},
  {"name": "Florida", "code": "FL", "registry": "Florida SHOTS", "url": "https://flshotsusers.com"},
  {"name": "Georgia", "code": "GA", "registry": "Georgia Immunization Registry (GRITS)", "url": "https://dph.georgia.gov/immunization-records-request"},
  {"name": "Hawaii", "code": "HI", "registry": "Hawaii State Immunization System (HiSIS)", "url": "https://hisis.hawaii.gov/"},
  {"name": "Idaho", "code": "ID", "registry": null, "url": "https://healthandwelfare.idaho.gov/immunizationrecords"},
  {"name": "Illinois", "code": "IL", "registry": "Illinois Comprehensive Automated Immunization Registry Exchange (I-CARE)", "url": "https://idphportal.illinois.gov/s/"},
  {"name": "Indiana", "code": "IN", "registry": "MyVaxIndiana", "url": "https://eportal.isdh.in.gov/MyVaxIndiana/Default2.aspx"},
  {"name": "Iowa", "code": "IA", "registry": "Immunization Registry Information System (IRIS)", "url": "https://iris.iowa.gov"},
  {"name": "Kansas", "code": "KS", "registry": "Kansas Statewide Immunization Registry", "url": "https://www.kdhe.ks.gov/326/Statewide-Immunization-Registry"},
  {"name": "Kentucky", "code": "KY", "registry": "Kentucky Immunization Registry", "url": "https://www.chfs.ky.gov/agencies/dph/dehp/idb/Pages/kyirportal.aspx"},
  {"name": "Louisiana", "code": "LA", "registry": null, "url": "https://ldh.la.gov/immunization-program/request-vaccination-records"},
  {"name": "Maine", "code": "ME", "registry": "Maine Immunization Program (ImmPact2)", "url": "https://www.maine.gov/dhhs/mecdc/diseases-conditions/immunization/immunization-records"},
  {"name": "Maryland", "code": "MD", "registry": "ImmuNet", "url": "https://health.maryland.gov/phpa/OIDEOR/IMMUN/Pages/immunet.aspx"},
  {"name": "Massachusetts", "code": "MA", "registry": "Massachusetts Immunization Information System (MIIS)", "url": "https://www.myvaxrecords.mass.gov/"},
  {"name": "Michigan", "code": "MI", "registry": "Michigan Care Improvement Registry (MCIR)", "url": "https://mcir.org/public/"},
  {"name": "Minnesota", "code": "MN", "registry": "Minnesota Immunization Information Connection (MIIC)", "url": "https://www.health.state.mn.us/people/immunize/miic/records.html"},
  {"name": "Mississippi", "code": "MS", "registry": null, "url": "https://msdh.ms.gov/msdhsite/_static/14,0,71,969.html"},
  {"name": "Missouri", "code": "MO", "registry": null, "url": "https://health.mo.gov/living/wellness/immunizations/tips.php"},
  {"name": "Montana", "code": "MT", "registry": "Montana Immunization Information System", "url": "https://dphhs.mt.gov/publichealth/Immunization/copyofimmunizationrecord"},
  {"name": "Nebraska", "code": "NE", "registry": "Nebraska State Immunization Information System (NESIIS)", "url": "https://nesiis-dhhs-prod.ne.gov/prd_ir/public/clientSearch.do?language=en"},
  {"name": "Nevada", "code": "NV", "registry": "Nevada WebIZ", "url": "https://izrecord.nv.gov/public/Application/PublicPortal"},
  {"name": "New Hampshire", "code": "NH", "registry": null, "url": "https://www.vaccines.nh.gov/vaccination-record-instructions"},
  {"name": "New Jersey", "code": "NJ", "registry": "New Jersey Immunization Information System (NJIIS)", "url": "https://njiis.nj.gov/core/web/index.html#/home/requestImmunizationRecord"},
  {"name": "New Mexico", "code": "NM", "registry": null, "url": "https://vaxview.doh.nm.gov/"},
  {"name": "New York (outside NYC)", "code": "NY", "registry": "New York State Immunization Information System (NYSIIS)", "url": "https://www.health.ny.gov/prevention/immunization/information_system"},
  {"name": "New York City", "code": "NY", "registry": "Citywide Immunization Registry (CIR)", "url": "https://www.nyc.gov/site/doh/services/cir-parents-guardians.page"},
  {"name": "North Carolina", "code": "NC", "registry": "North Carolina Immunization Registry (NCIR)", "url": "https://immunization.dph.ncdhhs.gov/family/locating_immnz_record.htm"},
  {"name": "North Dakota", "code": "ND", "registry": "North Dakota Immunization Information System (NDIIS)", "url": "https://www.ndiis.org/"},
  {"name": "Ohio", "code": "OH", "registry": "Ohio Impact SIIS", "url": "https://www.ohiopublichealthreporting.info/Enrollment/FileSystem/HL7/Public_Instructions_to_access_ImpactSIIS_record.pdf"},
  {"name": "Oklahoma", "code": "OK", "registry": "Oklahoma State Immunization Information System (OSIIS)", "url": "https://shotrecords.health.ok.gov/"},
  {"name": "Oregon", "code": "OR", "registry": "ALERT Immunization Information System", "url": "https://www.oregon.gov/oha/PH/PREVENTIONWELLNESS/VACCINESIMMUNIZATION/GETTINGIMMUNIZED/Pages/ImmRecords.aspx"},
  {"name": "Pennsylvania", "code": "PA", "registry": "Pennsylvania Immunization Electronic Registry System (PIERS)", "url": "https://www.pa.gov/agencies/health/healthcare-and-public-health-professionals/piers"},
  {"name": "Philadelphia", "code": "PA", "registry": "PhilaVax", "url": "https://vaccines.phila.gov/"},
  {"name": "Puerto Rico", "code": "PR", "registry": "Puerto Rico Electronic Immunization System (PREIS)", "url": "https://prcp1web.stchealthops.com/iweb/"},
  {"name": "Rhode Island", "code": "RI", "registry": null, "url": "https://health.ri.gov/programs/detail.php?pgm_id=156681"},
  {"name": "South Carolina", "code": "SC", "registry": null, "url": "https://dph.sc.gov/public/your-local-health-department-online/south-carolina-vaccination-records"},
  {"name": "South Dakota", "code": "SD", "registry": null, "url": "https://doh.sd.gov/topics/immunizations-vaccinations/request-copy-of-immunization-record/"},
  {"name": "Tennessee", "code": "TN", "registry": "Tennessee Immunization Information System (TennIIS)", "url": "https://redcap.health.tn.gov/redcap/surveys/?s=NDW7XEFTKHHXHR3Y"},
  {"name": "Texas", "code": "TX", "registry": "Texas Immunization Registry (ImmTrac2)", "url": "https://www.dshs.texas.gov/immunizations"},
  {"name": "Utah", "code": "UT", "registry": "Utah Statewide Immunization Information System (USIIS)", "url": "https://immunize.utah.gov/usiis-parents-individuals/"},
  {"name": "Vermont", "code": "VT", "registry": "Vermont Immunization Registry", "url": "https://www.healthvermont.gov/sites/default/files/documents/pdf/IMR_Requesting_Vaccine_Records.pdf"},
  {"name": "Virginia", "code": "VA", "registry": "Virginia Immunization Information System (VIIS)", "url": "https://myirmobile.com/"},
  {"name": "Washington", "code": "WA", "registry": "Washington State Immunization Information System", "url": "https://myirmobile.com/"},
  {"name": "West Virginia", "code": "WV", "registry": "West Virginia Statewide Immunization Information System (WVSIIS)", "url": "https://www.wvimm.org/wvsiis/"},
  {"name": "Wisconsin", "code": "WI", "registry": "Wisconsin Immunization Registry (WIR)", "url": "https://dhs.wisconsin.gov/immunization/wir.htm"},
  {"name": "Wyoming", "code": "WY", "registry": null, "url": "https://health.wyo.gov/publichealth/immunization/immunization-records/"},
  {"name": "Guam", "code": "GU", "registry": null, "url": "https://getimmunizedguam.org/"},
  {"name": "U.S. Virgin Islands", "code": "VI", "registry": "Virgin Islands Immunization Registry System (VIIRS)", "url": "https://viirs.vi.gov/ohca/"}
];
const CDC_DIRECTORY = "https://www.cdc.gov/iis/contacts-locate-records/index.html";

// CDC CVX vaccine codes. Combination vaccines first, so a "pentavalent" entry gets one code, not three.
const CVX_COMBOS = [
  [["DTaP", "HepB", "Hib", "IPV"], "146", "DTaP-IPV-Hib-HepB"],
  [["DTaP", "HepB", "Hib"], "198", "DTP-HepB-Hib (pentavalent)"],
  [["DTaP", "Hib", "IPV"], "120", "DTaP-Hib-IPV"],
  [["DTaP", "HepB", "IPV"], "110", "DTaP-HepB-IPV"],
  [["DTaP", "IPV"], "130", "DTaP-IPV"],
  [["DTaP", "Hib"], "50", "DTaP-Hib"],
  [["MMR", "VAR"], "94", "MMRV"],
  [["HepA", "HepB"], "104", "HepA-HepB"],
  [["Hib", "HepB"], "51", "Hib-HepB"],
];
const CVX_SINGLE = {
  HepB: ["45", "Hepatitis B, unspecified formulation"],
  RV: ["122", "Rotavirus, unspecified formulation"],
  DTaP: ["107", "DTaP, unspecified formulation"],
  DT: ["28", "DT (pediatric)"],
  Tdap: ["115", "Tdap"],
  Td: ["139", "Td (adult), unspecified formulation"],
  Hib: ["17", "Hib, unspecified formulation"],
  PCV: ["152", "Pneumococcal conjugate, unspecified formulation"],
  IPV: ["10", "IPV"],
  OPV: ["182", "OPV, unspecified"],
  MMR: ["03", "MMR"],
  Measles: ["05", "Measles"],
  MR: ["04", "Measles and rubella"],
  VAR: ["21", "Varicella"],
  HepA: ["85", "Hepatitis A, unspecified formulation"],
  MenACWY: ["108", "Meningococcal ACWY, unspecified formulation"],
  HPV: ["137", "HPV, unspecified formulation"],
  BCG: ["19", "BCG"],
  Other: ["999", "Unknown vaccine"],
};

// One or more CVX codes for one line on the record.
function cvxCodes(entry) {
  const parts = new Set(entry.antigens || []);
  const codes = [];
  for (const [combo, code, name] of CVX_COMBOS) {
    if (combo.length === parts.size && combo.every((a) => parts.has(a))) return [{ code, name, antigens: combo }];
  }
  for (const a of parts) {
    let [code, name] = CVX_SINGLE[a] || CVX_SINGLE.Other;
    if (a === "OPV" && /bopv|bivalent/i.test(entry.originalText || "")) [code, name] = ["178", "OPV bivalent"];
    codes.push({ code, name, antigens: [a] });
  }
  return codes;
}

// Every dated dose on the reviewed record, oldest first, with its CVX code.
function exportDoses(record) {
  const doses = [];
  for (const entry of record.entries || []) {
    if (!entry.date || !(entry.antigens || []).length) continue;
    for (const c of cvxCodes(entry)) doses.push({ ...c, date: entry.date, original: entry.originalText || "", english: entry.englishName || "" });
  }
  return doses.sort((a, b) => a.date.localeCompare(b.date));
}

const usDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");
const compact = (iso) => (iso || "").replaceAll("-", "");

function splitName(full) {
  const words = (full || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { given: words[0] || "", family: "" };
  return { given: words.slice(0, -1).join(" "), family: words.at(-1) };
}

// HL7 v2.5.1 VXU^V04: the message state registries take from enrolled clinics. Doses are sent as
// historical (RXA-9 "01"), which is what a transcribed record from another country is.
function buildHl7(record, state) {
  const esc = (t) => String(t ?? "").replace(/\\/g, "\\E\\").replace(/\|/g, "\\F\\").replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\").replace(/&/g, "\\T\\").replace(/[\r\n]+/g, " ");
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const id = `VB${stamp}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const name = splitName(record.childName);
  const segments = [
    `MSH|^~\\&|VAXBRIDGE|VAXBRIDGE|${esc(state.code)}IIS|${esc(state.code)}|${stamp}||VXU^V04^VXU_V04|${id}|P|2.5.1|||ER|AL|||UNICODE UTF-8|||Z22^CDCPHINVS`,
    `PID|1||${id}^^^VAXBRIDGE^MR||${esc(name.family)}^${esc(name.given)}^^^^^L||${compact(record.dateOfBirth)}|U`,
  ];
  exportDoses(record).forEach((d, i) => {
    segments.push(`ORC|RE||${id}-${i + 1}^VAXBRIDGE`);
    segments.push(`RXA|0|1|${compact(d.date)}|${compact(d.date)}|${d.code}^${esc(d.name)}^CVX|999|||01^Historical information - source unspecified^NIP001`);
    segments.push(`NTE|1||${esc(`On the original record: ${d.original}${record.country ? ` (${record.country})` : ""}`)}`);
  });
  return segments.join("\r") + "\r";
}

// FHIR R4 collection Bundle with one Patient and one Immunization per dose.
function buildFhir(record) {
  const name = splitName(record.childName);
  const patient = {
    resourceType: "Patient",
    name: [{ family: name.family || undefined, given: name.given ? [name.given] : undefined, text: record.childName || undefined }],
    birthDate: record.dateOfBirth || undefined,
  };
  const entries = [{ fullUrl: "resource:0", resource: patient }];
  exportDoses(record).forEach((d, i) => entries.push({
    fullUrl: `resource:${i + 1}`,
    resource: {
      resourceType: "Immunization",
      status: "completed",
      vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: d.code, display: d.name }], text: d.original || d.name },
      patient: { reference: "resource:0" },
      occurrenceDateTime: d.date,
      primarySource: false,
      reportOrigin: { text: `Transcribed from a vaccination record from ${record.country || "another country"} using VaxBridge` },
      note: [{ text: `On the original record: ${d.original}` }],
    },
  }));
  return JSON.stringify({ resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: entries }, null, 2);
}

function buildCsv(record) {
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ""));
  const rows = [["Child", "Date of birth", "Date given", "Vaccine (US name)", "CVX code", "Vaccine parts", "On the original record", "English"]];
  for (const d of exportDoses(record)) {
    rows.push([record.childName, usDate(record.dateOfBirth), usDate(d.date), d.name, d.code, d.antigens.join(" + "), d.original, d.english]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// Doses by vaccine for the grid: each US series with its dose dates. Doses that don't count are flagged.
function doseGrid(report) {
  return report.series.filter((s) => s.doses.length).map((s) => ({
    name: s.name,
    doses: s.doses.map((d) => ({ date: d.given, valid: d.valid, reason: d.reason })),
  }));
}

// A self-contained page to print: the record in the vaccine-by-dose layout of state school forms.
function buildPrintable(record, report, state) {
  const h = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const grid = doseGrid(report);
  const columns = Math.max(5, ...grid.map((g) => g.doses.length));
  const footnotes = [];
  const rows = grid.map((g) => `<tr><th>${h(g.name)}</th>${Array.from({ length: columns }, (_, i) => {
    const d = g.doses[i];
    if (!d) return "<td></td>";
    if (d.valid) return `<td>${usDate(d.date)}</td>`;
    footnotes.push(`${g.name}, ${usDate(d.date)}: ${d.reason}`);
    return `<td class="bad">${usDate(d.date)}<sup>${footnotes.length}</sup></td>`;
  }).join("")}</tr>`).join("");
  const other = report.ignored.map((d) => `<li>${h(d.sourceText || d.antigen)}, ${usDate(d.given)}: ${h(d.reason)}</li>`).join("");
  const registry = state.registry || `${state.name} immunization registry`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(state.name)} school immunization record: ${h(record.childName || "child")}</title>
<style>
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1A1F2E; margin: 32px auto; max-width: 820px; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; margin: 24px 0 8px; }
  .stamp { border: 2px solid #B45309; color: #92400E; background: #FFFBEB; padding: 10px 14px; border-radius: 8px; margin: 16px 0; font-weight: 600; }
  .stamp span { display: block; font-weight: 400; margin-top: 2px; }
  dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px; margin: 16px 0; }
  dt { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; } dd { margin: 0 0 6px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #9CA3AF; padding: 6px 8px; text-align: left; }
  thead th { background: #F3F4F6; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  tbody th { font-weight: 500; width: 34%; } td { font-family: ui-monospace, Menlo, monospace; font-size: 12px; } td.bad { color: #B91C1C; }
  ol, ul { padding-left: 20px; margin: 6px 0; } .small { font-size: 11px; color: #4B5563; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px 32px; margin-top: 16px; }
  .sign div { border-bottom: 1px solid #1A1F2E; height: 34px; } .sign span { font-size: 11px; color: #4B5563; }
  .bar { display: flex; gap: 8px; margin-bottom: 16px; } .bar button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #0B7A5E; background: #0B7A5E; color: #fff; cursor: pointer; }
  @media print { .bar { display: none; } body { margin: 0 auto; } }
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<h1>School immunization record (transcription)</h1>
<p class="small">${h(state.name)} · state registry: ${h(registry)} · prepared ${usDate(new Date().toISOString().slice(0, 10))}</p>
<div class="stamp">Transcribed by VaxBridge from a foreign vaccination record. Not valid until verified and signed by a licensed health care provider.
<span>Use this to complete ${h(state.name)}'s official school immunization form, or attach it to the original record. Dates are MM/DD/YYYY.</span></div>
<dl>
  <div><dt>Child</dt><dd>${h(record.childName || "")}</dd></div>
  <div><dt>Date of birth</dt><dd>${usDate(record.dateOfBirth)}</dd></div>
  <div><dt>Record from</dt><dd>${h([record.country, record.language].filter(Boolean).join(", ") || "Not given")}</dd></div>
  <div><dt>Checked against</dt><dd>CDC catch-up schedule, ${usDate(report.asOf)}</dd></div>
</dl>
<table><thead><tr><th>Vaccine</th>${Array.from({ length: columns }, (_, i) => `<th>Dose ${i + 1}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
${footnotes.length ? `<h2>Doses that don't count toward the US schedule</h2><ol>${footnotes.map((f) => `<li>${h(f)}</li>`).join("")}</ol>` : ""}
${other ? `<h2>Other vaccines on the record</h2><ul>${other}</ul>` : ""}
<h2>Provider verification</h2>
<p class="small">I have reviewed the original vaccination record and verified that the doses above were transcribed correctly.</p>
<div class="sign"><div></div><div></div></div>
<div class="sign" style="margin-top:4px"><span>Provider name and credentials</span><span>Signature</span></div>
<div class="sign"><div></div><div></div></div>
<div class="sign" style="margin-top:4px"><span>Clinic or school</span><span>Date</span></div>
</body></html>`;
}
