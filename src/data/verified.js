// ═══════════════════════════════════════════════════════════════════
//  COMPASS VERIFIED DATA  —  your data moat.
//  Every row here is fed to the AI as ground truth, so it stops guessing.
//  RULE: only add a fact after you've checked it on the OFFICIAL source.
//  Put the source link + the date you checked, so it's auditable.
//  Update once per intake cycle (10–15 min). This is what competitors
//  can't copy in a weekend.
// ═══════════════════════════════════════════════════════════════════

// ---- 1. UNIVERSITY FACTS (start with your top ~20, grow over time) ----
// verified: "YYYY-MM" you last checked · source: official page
export const VERIFIED_UNIS = [
  {
    name: "University of Warwick",
    country: "UK",
    intlDeadline: "Jan 29 (UCAS Equal Consideration)",
    ugTuitionIntl: "£24,000–£30,000/yr",     // check exact by course
    pgTuitionIntl: "£26,000–£33,000/yr",
    ieltsMin: "6.5 overall (6.0 each band); higher for some courses",
    applyUrl: "https://www.ucas.com",
    source: "https://warwick.ac.uk/study/undergraduate/apply",
    verified: "2026-01",
  },
  // TODO: add your real top-20 here, one verified row at a time.
  // Template to copy:
  // {
  //   name: "", country: "", intlDeadline: "", ugTuitionIntl: "", pgTuitionIntl: "",
  //   ieltsMin: "", applyUrl: "", source: "", verified: "2026-01",
  // },
];

// ---- 2. VISA / PROOF-OF-FUNDS FACTS (per destination country) ----
// The single most dangerous thing to get wrong. Verify on the GOV site.
export const VERIFIED_VISA = [
  {
    country: "United Kingdom",
    visaType: "Student visa (Route)",
    funds: "Tuition (year 1) + £1,334/mo × up to 9mo (London) or £1,023/mo (outside London)",
    fundsHeldDays: "28 consecutive days, statement dated within 31 days of applying",
    healthSurcharge: "IHS ~£776/yr",
    source: "https://www.gov.uk/student-visa/money",
    verified: "2026-01",
  },
  {
    country: "Germany",
    visaType: "National (D) student visa",
    funds: "Blocked account (Sperrkonto) ~€11,904/yr",
    fundsHeldDays: "Full amount blocked before applying",
    healthSurcharge: "Public health insurance ~€120/mo",
    source: "https://www.germany.info/us-en/service/visa",
    verified: "2026-01",
  },
  // TODO: add your target destinations. Template:
  // { country: "", visaType: "", funds: "", fundsHeldDays: "", healthSurcharge: "", source: "", verified: "2026-01" },
];

// ---- 3. SCHOLARSHIP FACTS (the famous ones — deadlines move yearly) ----
export const VERIFIED_SCHOLARSHIPS = [
  {
    name: "Chevening",
    country: "UK",
    coverage: "Full tuition + monthly stipend + flights",
    deadline: "Early November (check exact date each cycle)",
    eligibility: "Bachelor's done + 2yrs work experience + return home 2yrs after",
    source: "https://www.chevening.org/scholarships",
    verified: "2026-01",
  },
  // TODO: add DAAD, Erasmus Mundus, Stipendium Hungaricum, etc. with checked deadlines.
];

// ---- assembled into a compact string for the AI prompt ----
export function verifiedFactsText() {
  const u = VERIFIED_UNIS.map((x) =>
    `- ${x.name} (${x.country}): intl deadline ${x.intlDeadline}; UG ${x.ugTuitionIntl}, PG ${x.pgTuitionIntl}; IELTS ${x.ieltsMin} [verified ${x.verified}]`
  ).join("\n");
  const v = VERIFIED_VISA.map((x) =>
    `- ${x.country} ${x.visaType}: funds = ${x.funds}; held ${x.fundsHeldDays}; ${x.healthSurcharge} [verified ${x.verified}]`
  ).join("\n");
  const s = VERIFIED_SCHOLARSHIPS.map((x) =>
    `- ${x.name} (${x.country}): ${x.coverage}; deadline ${x.deadline}; ${x.eligibility} [verified ${x.verified}]`
  ).join("\n");
  return `VERIFIED UNIVERSITY FACTS:\n${u}\n\nVERIFIED VISA FACTS:\n${v}\n\nVERIFIED SCHOLARSHIP FACTS:\n${s}`;
}
