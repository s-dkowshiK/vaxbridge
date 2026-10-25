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

// ---- state school forms ------------------------------------------------------

// What each state requires for school (K-12), from Immunize.org's state requirement tables as of May 2026
// (https://www.immunize.org/official-guidance/state-policies/requirements/). DTaP/Tdap, polio, MMR and
// varicella are required everywhere. Columns: hepatitis B, hepatitis A, Tdap, MenACWY, HPV, varicella.
const REQUIREMENTS_SOURCE = "https://www.immunize.org/official-guidance/state-policies/requirements/";
const STATE_REQUIREMENTS = {
  AL: [null, null, "Gr 6–12", null, null, "K–12, 1–2 doses"],
  AK: ["K–12", "K–12", "10 years after the last tetanus shot", null, null, "K–6, 2 doses"],
  AZ: ["K–12", null, "Age 11+", "Gr 6 if age 11+", null, "K–12, 1–2 doses"],
  AR: ["K–12", "K, Gr 1", "Age 11+", "Gr 7; booster at 16", null, "K–7, 2 doses"],
  CA: ["K–12", null, "Gr 7", null, null, "K–12, 2 doses"],
  CO: ["K–12", null, "Gr 7–12", null, null, "K–12, 2 doses"],
  CT: ["K–12", "K–12", "Gr 7", "Gr 7", null, "K–12, 2 doses"],
  DE: ["K–12", null, "Gr 9–12", "Gr 9–12", null, "K–12, 2 doses"],
  DC: ["K–12", "K–12", "Gr 6–12", "Gr 6–12 if age 11+; booster at 16", "Gr 7 and 11", "K–12, 2 doses"],
  FL: ["K–12", null, "Gr 7–12", null, null, "K–12, 2 doses"],
  GA: ["K–6", "K–12", "Gr 7–12", "Gr 7; booster Gr 11", null, "K–12, 2 doses"],
  HI: ["K–12", "K–12", "Gr 7–12", "New students Gr 7–12; booster at 16", "Gr 7–12", "K–12, 2 doses"],
  ID: ["K–12", "K–12", "Gr 7–12", "Gr 7; booster Gr 12", null, "K–12, 2 doses"],
  IL: ["Gr 6–12", null, "Gr 6–12", "Gr 6; booster Gr 12", null, "K–12, 2 doses"],
  IN: ["K–12", "Pre-K–12", "Gr 6–12", "Gr 6–11; booster Gr 12", null, "K–12, 2 doses"],
  IA: ["K–12", null, "Gr 7–12", "Gr 7–12; booster Gr 12", null, "K–12, 2 doses"],
  KS: ["K–12", "K–12", "Gr 7", "Gr 7 and 11", null, "K–12, 2 doses"],
  KY: ["K–12", "K–12", "Gr 6", "Age 11–15; booster at 16+", null, "K–12, 2 doses"],
  LA: ["K–12", "K", "Gr 6–12", "Gr 6; booster Gr 11", null, "K–12, 2 doses"],
  ME: [null, null, "Gr 7", "Gr 7; booster Gr 12", null, "K–12, 2 doses"],
  MD: ["K–12", null, "Gr 7–12", "Gr 7–12", null, "K–12, 2 doses"],
  MA: ["K–12", null, "Gr 7–12", "Gr 7–12; booster Gr 11–12", null, "K–12, 2 doses"],
  MI: ["K–12", null, "Gr 7", "Gr 7", null, "K–12, 2 doses"],
  MN: ["K–12", null, "Gr 7–12", "Gr 7–12; booster Gr 12", null, "K–12, 2 doses"],
  MS: ["K–12", null, "Gr 7", null, null, "K–6, 2 doses"],
  MO: ["K–12", null, "Gr 8–12", "Gr 8–11; booster Gr 12", null, "K–12, 2 doses"],
  MT: [null, null, "Gr 7–12", null, null, "K–12, 2 doses"],
  NE: ["K–12", null, "Gr 7", null, null, "K–12, 2 doses"],
  NV: ["K–6", "K–12", "Gr 7", "Gr 7 and 12", null, "K–6, 2 doses"],
  NH: ["K–12", null, "Age 11", null, null, "K–6, 2 doses"],
  NJ: ["K–12", null, "Gr 7–12", "Gr 7–12", null, "K–12, 1 dose"],
  NM: ["K–12", "K–4", "Gr 7–12", "Gr 7–11; booster Gr 12", null, "K–12, 2 doses"],
  NY: ["K–12", null, "Gr 6–12", "Gr 7 and 12", null, "K–12, 2 doses"],
  NC: ["K–12", null, "Gr 7 or age 12", "Gr 7; booster Gr 12", null, "K–12, 2 doses"],
  ND: ["K–12", null, "Gr 7–12", "Gr 7–10; booster Gr 11–12", null, "K–12, 2 doses"],
  OH: ["K–12", null, "Gr 7–12", "Gr 7–11; booster Gr 12", null, "K–12, 2 doses"],
  OK: ["K–12", "K–12", "Gr 7–12", null, null, "K–12, 1 dose"],
  OR: ["K–12", "K–12", "Gr 7–12", null, null, "K–12, 1 dose (2 if first given at 13+)"],
  PA: ["K, Gr 7, Gr 12", null, "Gr 7", "Gr 7; booster Gr 12", null, "K, Gr 7, Gr 12, 2 doses"],
  RI: ["K–12", null, "Gr 7", "Gr 7–12; booster Gr 12", "Gr 7", "K–12, 2 doses"],
  SC: ["K–12", "K–6", "Gr 7", null, null, "K–12, 2 doses"],
  SD: [null, null, "Gr 6", "Gr 6 if age 11+", null, "K–12, 2 doses"],
  TN: ["K–12", "K", "Gr 7", null, null, "K–12, 2 doses"],
  TX: ["K–12", "K–12", "Gr 7–12", "Gr 7–12", null, "K–12, 2 doses"],
  UT: ["K–12", "K", "Gr 7", "Gr 7", null, "K–12, 2 doses"],
  VT: ["K–12", null, "Gr 7", "Gr 7–12 (residential schools)", null, "K–12, 2 doses"],
  VA: ["K–12", "K", "Gr 7", "Gr 7; booster Gr 12", "Gr 7", "K–12, 2 doses"],
  WA: ["K–12", null, "Gr 7–12", null, null, "K–6, 2 doses"],
  WV: ["K–12", null, "Gr 7 and 12", "Gr 7 and 12", null, "K–6, 2 doses"],
  WI: ["K–12", null, "Gr 7", "Gr 7; booster Gr 12", null, "K–12, 2 doses"],
  WY: ["K–12", null, "Gr 7", null, null, "K–12, 2 doses"]
};

// Rows a state form can have: label, the report series the doses come from, and (optionally) which
// vaccines in that series belong on the row. A form that splits DTaP and Tdap gets two rows.
const FORM_ROWS = {
  dtapAll: ["DTaP / DTP / DT / Td / Tdap", "DTaP"],
  dtap: ["DTaP / DTP / DT", "DTaP", ["DTaP", "DT"]],
  dtapOnly: ["DTaP / DTP", "DTaP", ["DTaP"]],
  dtTd: ["DT / Td", "DTaP", ["DT", "Td"]],
  td: ["Td", "DTaP", ["Td"]],
  tdap: ["Tdap", "DTaP", ["Tdap"]],
  tdTdap: ["Td / Tdap", "DTaP", ["Td", "Tdap"]],
  polio: ["Polio (IPV / OPV)", "Polio"],
  ipv: ["IPV (polio)", "Polio", ["IPV"]],
  opv: ["OPV (polio)", "Polio", ["OPV"]],
  hib: ["Hib", "Hib"],
  hepb: ["Hepatitis B", "HepB"],
  hepa: ["Hepatitis A", "HepA"],
  mmr: ["MMR (measles, mumps, rubella)", "MMR"],
  var: ["Varicella (chickenpox)", "VAR"],
  pcv: ["Pneumococcal (PCV)", "PCV"],
  rv: ["Rotavirus", "RV"],
  men: ["Meningococcal ACWY", "MenACWY"],
  hpv: ["HPV", "HPV"],
};

// A layout like most state school forms, for states whose form VaxBridge doesn't have on file.
const STANDARD_ROWS = [["dtapAll", 5], ["polio", 5], ["mmr", 2], ["hib", 4], ["hepb", 4], ["var", 2], ["hepa", 2], ["pcv", 4], ["rv", 3], ["men", 2], ["hpv", 3]];

// Official school immunization forms, read from each state's own form or instructions (2026).
// rows: [row, dose columns, label on the form]. by: who the form says may sign or issue it.
const STATE_FORMS = {
  Alabama: { title: "Certificate of Immunization (COI)", by: "Printed only from ImmPRINT, the state registry, by an enrolled provider.",
    url: "https://www.alabamapublichealth.gov/IMMUNIZATION/assets/immprintmanualcoi.pdf",
    note: "A provider enters these doses in ImmPRINT and prints the COI from there." },
  Arizona: { title: "Arizona School Immunization Record", number: "ASIR 109R", by: "Signed by the school representative who reviewed it.",
    url: "https://azdhs.gov/documents/preparedness/epidemiology-disease-control/immunization/school-childcare/asir-109r.pdf" },
  California: { title: "California Pre-Kindergarten and School Immunization Record (blue card)", number: "CDPH 286",
    url: "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/Immunization/School/resources-implementation.aspx",
    rows: [["polio", 5, "IPV / OPV (polio)"], ["dtapAll", 5, "DTaP / DTP (age 0-6) or Tdap / Td (age 7+)"], ["mmr", 5], ["hib", 5], ["hepb", 5], ["var", 5, "VAR / VZV (varicella)"], ["tdap", 1, "Tdap, 7th grade"]] },
  Connecticut: { title: "Health Assessment Record", number: "HAR-3", by: "Health care provider (MD, DO, APRN or PA).",
    rows: [["dtapOnly", 6, "DTP / DTaP"], ["dtTd", 6], ["tdap", 6], ["polio", 6, "IPV / OPV"], ["mmr", 6], ["hib", 6], ["hepa", 6], ["hepb", 6], ["var", 6], ["pcv", 6], ["men", 6], ["hpv", 6]] },
  "District of Columbia": { title: "Universal Health Certificate", by: "Licensed health care provider, with office stamp.",
    url: "https://dchealth.dc.gov/sites/default/files/dc/sites/doh/service_content/attachments/2024-03-DCHealth-Universal-Health%20Certificate-English.pdf",
    rows: [["dtapOnly", 5, "Diphtheria, tetanus, pertussis (DTP, DTaP)"], ["dtTd", 5, "DT (<7 yrs) / Td (>7 yrs)"], ["tdap", 1, "Tdap booster"], ["hib", 4], ["hepb", 4], ["polio", 4], ["mmr", 2], ["var", 2], ["pcv", 4], ["hepa", 2], ["men", 2], ["hpv", 3], ["rv", 3]] },
  Florida: { title: "Florida Certification of Immunization", number: "DH 680", by: "Issued by a Florida health care provider or county health department, usually from Florida SHOTS.",
    note: "A Florida provider enters these doses and issues the DH 680." },
  Georgia: { title: "Certificate of Immunization", number: "Form 3231", by: "Only a Georgia-licensed physician, APRN, PA or health department can issue it.",
    url: "https://dph.georgia.gov/document/document/3231-ins-rev-72021pdf/download",
    note: "A Georgia provider or health department enters these doses and issues Form 3231." },
  Iowa: { title: "Certificate of Immunization", by: "Physician, physician associate, nurse or certified medical assistant.",
    url: "https://hhs.iowa.gov/media/665/download?inline=", list: true,
    rows: [["dtapAll", 5, "Diphtheria, tetanus, pertussis (DTaP/DTP/DT/Td/Tdap)"], ["polio", 5], ["mmr", 5], ["hib", 5], ["hepb", 5], ["var", 5], ["pcv", 5], ["men", 5]] },
  Kansas: { title: "Kansas Certificate of Immunizations (KCI)", by: "Only a physician (MD/DO), health department or school may sign it.",
    url: "https://www.kdhe.ks.gov/DocumentCenter/View/21273/2023-2024-Blank-KCI-PDF",
    rows: [["polio", 7], ["hepb", 7], ["var", 7], ["mmr", 7], ["hib", 7], ["pcv", 7], ["hepa", 7], ["dtapAll", 7, "DTaP / Td / Tdap"], ["hpv", 7], ["rv", 7], ["men", 7, "MCV4 (meningococcal ACWY)"]] },
  Kentucky: { title: "Certificate of Immunization Status", number: "EPID-230", by: "Physician, APRN, PA, pharmacist, health department, or RN/LPN designee.",
    url: "https://chfs.ky.gov/agencies/dph/dehp/imm/EPID230.pdf",
    rows: [["hepb", 5], ["dtap", 5, "DTaP / DTP / DT"], ["hib", 5], ["pcv", 5], ["polio", 5], ["mmr", 5], ["var", 5], ["hepa", 5], ["men", 5, "Meningococcal"], ["td", 5], ["tdap", 5], ["rv", 5], ["hpv", 5]] },
  Maryland: { title: "Immunization Certificate", number: "MDH Form 896", by: "Medical provider, local health department, school official or child care provider.",
    url: "https://health.maryland.gov/phpa/OIDEOR/IMMUN/Shared Documents/MDH_896_form.pdf",
    rows: [["dtap", 5, "DTP-DTaP / DT"], ["tdTdap", 5], ["polio", 5], ["hib", 5], ["hepb", 5], ["pcv", 5], ["rv", 5], ["men", 5, "MCV"], ["hpv", 5], ["hepa", 5], ["mmr", 5], ["var", 5]] },
  Mississippi: { title: "Certificate of Immunization Compliance", number: "Form 121", by: "Issued by a Mississippi provider or county health department (or downloaded from MyIR).",
    url: "https://msdh.ms.gov/Page/14,25485,71,303.html",
    note: "A Mississippi provider or county health department enters these doses and issues Form 121." },
  Montana: { title: "School Certificate of Immunization", number: "HES101-S",
    url: "https://dphhs.mt.gov/assets/publichealth/Immunization/HES101S.pdf",
    rows: [["dtapOnly", 6, "DTaP"], ["td", 6], ["tdap", 6], ["hib", 6], ["mmr", 6], ["polio", 6], ["var", 6]] },
  "North Dakota": { title: "Certificate of Immunization", number: "SFN 16038", by: "Physician, nurse, or local or state health representative.",
    url: "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/Immunization/Certificate%20of%20Immunization%2002-2024.pdf",
    rows: [["hepb", 5], ["rv", 5], ["hib", 5], ["pcv", 5], ["dtap", 5, "DTP / DTaP / DT"], ["polio", 5, "IPV / OPV"], ["mmr", 5], ["var", 5], ["hepa", 5], ["tdTdap", 5], ["men", 5]] },
  Oregon: { title: "Oregon Certificate of Immunization Status", number: "53-05A", by: "Parent, student 15 or older, medical provider or county health department.",
    rows: [["dtap", 5, "DTaP"], ["tdap", 5], ["polio", 5, "Polio (IPV)"], ["var", 2], ["mmr", 5], ["hepb", 5], ["hepa", 5], ["hib", 5]] },
  "South Carolina": { title: "South Carolina Certificate of Immunization", number: "DHEC 2740", by: "Issued by a health care provider or health department.",
    url: "https://dph.sc.gov/sites/scdph/files/2025-08/School-Law-Letter-2025-2026_20250819.pdf",
    note: "A South Carolina provider or health department enters these doses and issues the certificate." },
  Tennessee: { title: "Certificate of Immunization", number: "PH-4103", by: "Qualified provider (MD, DO, PA, advanced practice nurse) or health department.",
    url: "https://tn.gov/content/dam/tn/health/documents/TN_Immunization_Certificate_Sample.pdf",
    rows: [["hib", 4], ["pcv", 4], ["dtap", 5, "DTP / DTaP / DT"], ["polio", 4], ["hepb", 3], ["hepa", 2], ["mmr", 2], ["var", 2], ["tdap", 1]] },
  Utah: { title: "Utah School Immunization Record (pink card)", by: "School or health staff who checked it against the source record.",
    rows: [["dtap", 5, "DTaP / DTP / DT / Td"], ["tdap", 5], ["polio", 5], ["hib", 5], ["pcv", 5], ["mmr", 5], ["hepb", 5], ["var", 5], ["hepa", 5], ["men", 5, "Meningococcal conjugate (ACWY)"]] },
  Virginia: { title: "School Entrance Health Form, Part II: Certification of Immunization", number: "MCH 213G",
    by: "Physician or designee, registered nurse, or health department official.",
    url: "https://vdh.virginia.gov/content/uploads/sites/58/2024/09/GREEN-6-2024.-JPTS.-MCH213G_School_Entrance_Fillabl.pdf",
    rows: [["dtapOnly", 5, "DTP / DTaP"], ["dtTd", 5, "DT, Td or Tdap (after age 7)"], ["tdap", 1, "Tdap booster"], ["polio", 5], ["hib", 4], ["rv", 3], ["pcv", 4], ["var", 2], ["mmr", 2], ["hepb", 4], ["hepa", 2], ["men", 2], ["hpv", 3]] },
  Washington: { title: "Certificate of Immunization Status (CIS)", number: "DOH 348-013", by: "A health care provider validates a printed record, or school staff verify it against medical records.",
    url: "https://doh.wa.gov/sites/default/files/2024-11/348-013-CertificateImmunizationStatusFormEN.pdf",
    rows: [["dtapOnly", 6, "DTaP"], ["tdap", 6, "Tdap (grade 7+)"], ["dtTd", 6], ["hepb", 6], ["hib", 6], ["ipv", 6, "IPV (polio)"], ["opv", 6, "OPV (polio)"], ["mmr", 6], ["pcv", 6], ["var", 6]] },
  Wisconsin: { title: "Student Immunization Record", number: "F-04020L",
    url: "https://www.dhs.wisconsin.gov/forms/f04020l.pdf",
    rows: [["dtapAll", 5, "DTaP / DTP / DT / Td (Tdap or Td booster)"], ["polio", 5], ["hepb", 5], ["mmr", 5], ["var", 5], ["men", 5, "Meningococcal (ACWY)"]] },
};

// The state's requirements as a list for the screen and the printout.
function stateRequirements(state) {
  const r = STATE_REQUIREMENTS[state.code];
  if (!r || ["GU", "PR", "VI"].includes(state.code)) return null;
  const [hepb, hepa, tdap, men, hpv, varicella] = r;
  return [
    { key: "DTaP", name: "DTaP / DTP", when: "K–12" },
    { key: "Polio", name: "Polio", when: "K–12" },
    { key: "MMR", name: "MMR", when: "K–12" },
    { key: "VAR", name: "Varicella", when: varicella },
    ...(hepb ? [{ key: "HepB", name: "Hepatitis B", when: hepb }] : []),
    ...(hepa ? [{ key: "HepA", name: "Hepatitis A", when: hepa }] : []),
    { key: "Tdap", name: "Tdap booster", when: tdap },
    ...(men ? [{ key: "MenACWY", name: "MenACWY", when: men }] : []),
    ...(hpv ? [{ key: "HPV", name: "HPV", when: hpv }] : []),
  ];
}

// The record laid out like the chosen state's form: its rows, in its order, with its dose columns.
// Doses for vaccines the form has no row for are listed separately so nothing is dropped.
function stateLayout(state, report) {
  const form = STATE_FORMS[state.name] || null;
  const spec = form?.rows || STANDARD_ROWS;
  const required = new Set((stateRequirements(state) || []).map((r) => r.key));
  const used = new Set();
  const rows = [];
  for (const [key, columns, label] of spec) {
    const [defaultLabel, seriesKey, only] = FORM_ROWS[key];
    const series = report.series.find((s) => s.key === seriesKey);
    const doses = (series?.doses || []).filter((d) => !only || only.includes(d.antigen));
    doses.forEach((d) => used.add(d));
    // The standard layout leaves out vaccines with nothing on the record and nothing required.
    if (!form?.rows && !doses.length && !required.has(seriesKey)) continue;
    rows.push({
      label: label || defaultLabel,
      columns: Math.max(columns, doses.length),
      required: ["tdap", "tdTdap"].includes(key) ? required.has("Tdap") : !["td", "dtTd"].includes(key) && required.has(seriesKey),
      doses: doses.map((d) => ({ date: d.given, valid: d.valid, reason: d.reason })),
    });
  }
  const extra = report.series.flatMap((s) => s.doses.filter((d) => !used.has(d)).map((d) => ({ ...d, series: s.name })));
  return { form, rows, extra, requirements: stateRequirements(state) };
}

// A self-contained page to print, laid out like the chosen state's school form.
function buildPrintable(record, report, state) {
  const h = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const layout = stateLayout(state, report);
  const form = layout.form;
  const columns = Math.max(...layout.rows.map((r) => r.columns), 1);
  const footnotes = [];
  const cell = (d, row) => {
    if (d.valid) return usDate(d.date);
    footnotes.push(`${row.label}, ${usDate(d.date)}: ${d.reason}`);
    return `<span class="bad">${usDate(d.date)}<sup>${footnotes.length}</sup></span>`;
  };
  const rows = layout.rows.map((r) => {
    const name = `${h(r.label)}${r.required ? ' <span class="req">required</span>' : ""}`;
    if (form?.list) return `<tr><th>${name}</th><td colspan="${columns}">${r.doses.map((d) => cell(d, r)).join(", ") || ""}</td></tr>`;
    return `<tr><th>${name}</th>${Array.from({ length: columns }, (_, i) =>
      i >= r.columns ? '<td class="off"></td>' : `<td>${r.doses[i] ? cell(r.doses[i], r) : ""}</td>`).join("")}</tr>`;
  }).join("");
  const head = form?.list ? `<th colspan="${columns}">Dates given</th>` : Array.from({ length: columns }, (_, i) => `<th>Dose ${i + 1}</th>`).join("");
  const extra = layout.extra.map((d) => `<li>${h(d.sourceText || d.antigen)} (${h(d.series)}), ${usDate(d.given)}</li>`).join("");
  const other = report.ignored.map((d) => `<li>${h(d.sourceText || d.antigen)}, ${usDate(d.given)}: ${h(d.reason)}</li>`).join("");
  const reqs = layout.requirements;
  const registry = state.registry || `${state.name} immunization registry`;
  const formName = form ? `${form.title}${form.number ? ` (${form.number})` : ""}` : "School immunization record";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(state.name)} school immunization record: ${h(record.childName || "child")}</title>
<style>
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1A1F2E; margin: 32px auto; max-width: 860px; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; margin: 24px 0 8px; }
  .stamp { border: 2px solid #B45309; color: #92400E; background: #FFFBEB; padding: 10px 14px; border-radius: 8px; margin: 16px 0; font-weight: 600; }
  .stamp span { display: block; font-weight: 400; margin-top: 2px; }
  dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px; margin: 16px 0; }
  dt { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; } dd { margin: 0 0 6px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #9CA3AF; padding: 6px 8px; text-align: left; }
  thead th { background: #F3F4F6; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  tbody th { font-weight: 500; width: 34%; } td { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  td.off { background: repeating-linear-gradient(135deg, #F3F4F6 0 4px, #fff 4px 8px); } .bad { color: #B91C1C; }
  .req { font: 600 10px system-ui, sans-serif; color: #047857; border: 1px solid #A7F3D0; background: #ECFDF5; border-radius: 99px; padding: 0 6px; margin-left: 4px; }
  ol, ul { padding-left: 20px; margin: 6px 0; } .small { font-size: 11px; color: #4B5563; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px 32px; margin-top: 16px; }
  .sign div { border-bottom: 1px solid #1A1F2E; height: 34px; } .sign span { font-size: 11px; color: #4B5563; }
  .bar { display: flex; gap: 8px; margin-bottom: 16px; } .bar button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #0B7A5E; background: #0B7A5E; color: #fff; cursor: pointer; }
  @media print { .bar { display: none; } body { margin: 0 auto; } }
</style></head><body>
<div class="bar"><button onclick="window.print()">Print</button></div>
<h1>${h(formName)}: transcription</h1>
<p class="small">${h(state.name)} · state registry: ${h(registry)} · prepared ${usDate(new Date().toISOString().slice(0, 10))}</p>
<div class="stamp">Transcribed by VaxBridge from a foreign vaccination record. Not valid until verified and signed by a licensed health care provider.
<span>${form
    ? `Laid out like ${h(state.name)}'s ${h(formName)} so the doses can be copied straight onto the official form. ${form.note ? h(form.note) : ""}`
    : `VaxBridge doesn't have ${h(state.name)}'s school form on file, so this uses the standard layout. Copy the doses onto the state's official form or attach this to the original record.`}
Dates are MM/DD/YYYY.</span></div>
<dl>
  <div><dt>Child</dt><dd>${h(record.childName || "")}</dd></div>
  <div><dt>Date of birth</dt><dd>${usDate(record.dateOfBirth)}</dd></div>
  <div><dt>Record from</dt><dd>${h([record.country, record.language].filter(Boolean).join(", ") || "Not given")}</dd></div>
  <div><dt>Checked against</dt><dd>CDC catch-up schedule, ${usDate(report.asOf)}</dd></div>
</dl>
<table><thead><tr><th>Vaccine</th>${head}</tr></thead><tbody>${rows}</tbody></table>
${footnotes.length ? `<h2>Doses that don't count toward the US schedule</h2><ol>${footnotes.map((f) => `<li>${h(f)}</li>`).join("")}</ol>` : ""}
${extra ? `<h2>Doses with no row on this form</h2><ul>${extra}</ul>` : ""}
${other ? `<h2>Other vaccines on the record</h2><ul>${other}</ul>` : ""}
${reqs ? `<h2>What ${h(state.name)} schools require</h2><ul>${reqs.map((r) => `<li>${h(r.name)}: ${h(r.when)}</li>`).join("")}</ul>
<p class="small">From Immunize.org's state requirement tables (May 2026). Check the state health department for current rules.</p>` : ""}
<h2>Provider verification</h2>
<p class="small">I have reviewed the original vaccination record and verified that the doses above were transcribed correctly.${form?.by ? ` ${h(state.name)} form: ${h(form.by)}` : ""}</p>
<div class="sign"><div></div><div></div></div>
<div class="sign" style="margin-top:4px"><span>Provider name and credentials</span><span>Signature</span></div>
<div class="sign"><div></div><div></div></div>
<div class="sign" style="margin-top:4px"><span>Clinic or school</span><span>Date</span></div>
</body></html>`;
}
