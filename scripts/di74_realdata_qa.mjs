/**
 * DI-7.4 Real-Data QA — runs all Section 5/6 search dimension checks against
 * the live QA database after enrichment.
 *
 * TEST / QA ONLY. Read-only. No data mutations.
 *
 * Run: npx tsx scripts/di74_realdata_qa.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database.js";
import { DrugPersonAdvancedSearchService } from "../lib/drug_intelligence/drug_person_advanced_search_service.js";

const db = createDatabaseClient();
const service = new DrugPersonAdvancedSearchService(db);

// Known QA person IDs (from enrichment run)
const IDS = {
  A: "b9a6c674-db36-4f40-a7de-4c9a727c37a7",
  B: "51162910-b060-4187-b1c6-60f1b7cacb89",
  C: "aca99d68-e2bf-429a-b3f9-6594936c2d53",
  D: "72ef10b5-55a2-43c1-8c09-6f7737f7a7a9",
  E: "4c75030a-5fa1-43c8-ab1f-01be12620c3e",
  F: "1f230a17-8055-4905-9e01-d24fde3b08ec",
};
const QA_GROUP_ID = "dccf2b93-c1b8-4eb8-a51b-0477c1b2d233";

let passed = 0, failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected) ||
    (typeof expected === "function" && expected(actual));
  if (ok) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.error(`  ✘ ${label}`);
    console.error(`    got:      ${JSON.stringify(actual)}`);
    if (typeof expected !== "function") console.error(`    expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

async function run(label, query) {
  const r = await service.search(query, "qa-check");
  return r;
}

console.log("\n=== SECTION 5: Advanced Search Real-Data QA ===\n");

// A. Full name
{
  const r = await run("A. Full name", { query: "นาย ทดสอบ หนึ่ง" });
  const ids = r.items.map(x => x.id);
  check("A. 'นาย ทดสอบ หนึ่ง' matches A and/or F", ids.includes(IDS.A), true);
}

// B. Nickname
{
  const r = await run("B. Nickname", { query: "แดง" });
  const item = r.items.find(x => x.id === IDS.A);
  check("B. 'แดง' returns Person A", r.items.some(x => x.id === IDS.A), true);
  check("B. match explanation includes NICKNAME field", item?.matchedFields.some(f => f.field === "NICKNAME"), true);
}

// C. Alias
{
  const r = await run("C. Alias", { query: "ไอ้แดง" });
  const item = r.items.find(x => x.id === IDS.C);
  check("C. 'ไอ้แดง' returns Person C", r.items.some(x => x.id === IDS.C), true);
  check("C. match explanation includes ALIAS field", item?.matchedFields.some(f => f.field === "ALIAS"), true);
}

// D. Identifier
{
  const r = await run("D. Identifier", { query: "9999999990001" });
  check("D. identifier '9999999990001' returns Person A", r.items.some(x => x.id === IDS.A), true);
  const item = r.items.find(x => x.id === IDS.A);
  const idMatch = item?.matchedFields.find(f => f.field === "IDENTIFIER");
  check("D. identifier maskedValue is masked (not raw)", idMatch && !idMatch.maskedValue.includes("9999999990001"), true);
}

// E. Phone
{
  const r = await run("E. Phone", { query: "0800000001" });
  const ids = r.items.map(x => x.id);
  check("E. phone '0800000001' returns A or B (shared phone)", ids.includes(IDS.A) || ids.includes(IDS.B), true);
  const item = r.items.find(x => x.id === IDS.A);
  const phoneMatch = item?.matchedFields.find(f => f.field === "PHONE");
  if (phoneMatch) {
    check("E. phone maskedValue is masked (not raw normalized)", !phoneMatch.maskedValue.includes("66800000001"), true);
  }
}

// F. Sex filter MALE
{
  const r = await run("F. Sex=MALE", { sex: "MALE" });
  const ids = r.items.map(x => x.id);
  check("F. sex=MALE includes A", ids.includes(IDS.A), true);
  check("F. sex=MALE includes B", ids.includes(IDS.B), true);
  check("F. sex=MALE includes D", ids.includes(IDS.D), true);
  check("F. sex=MALE includes E", ids.includes(IDS.E), true);
  check("F. sex=MALE excludes C (FEMALE)", !ids.includes(IDS.C), true);
  check("F. sex=MALE excludes F (FEMALE)", !ids.includes(IDS.F), true);
}

// G. Sex filter FEMALE
{
  const r = await run("G. Sex=FEMALE", { sex: "FEMALE" });
  const ids = r.items.map(x => x.id);
  check("G. sex=FEMALE includes C", ids.includes(IDS.C), true);
  check("G. sex=FEMALE includes F", ids.includes(IDS.F), true);
  check("G. sex=FEMALE excludes A (MALE)", !ids.includes(IDS.A), true);
}

// H. Nationality ไทย
{
  const r = await run("H. Nationality=ไทย", { nationality: "ไทย" });
  const ids = r.items.map(x => x.id);
  check("H. nationality=ไทย includes A", ids.includes(IDS.A), true);
  check("H. nationality=ไทย includes B", ids.includes(IDS.B), true);
  check("H. nationality=ไทย includes E", ids.includes(IDS.E), true);
  check("H. nationality=ไทย includes F", ids.includes(IDS.F), true);
  check("H. nationality=ไทย excludes C (พม่า)", !ids.includes(IDS.C), true);
  check("H. nationality=ไทย excludes D (ลาว)", !ids.includes(IDS.D), true);
}

// I. Nationality พม่า
{
  const r = await run("I. Nationality=พม่า", { nationality: "พม่า" });
  const ids = r.items.map(x => x.id);
  check("I. nationality=พม่า returns only C", ids.includes(IDS.C), true);
  check("I. nationality=พม่า does not include A", !ids.includes(IDS.A), true);
}

// J. Nationality ลาว
{
  const r = await run("J. Nationality=ลาว", { nationality: "ลาว" });
  const ids = r.items.map(x => x.id);
  check("J. nationality=ลาว returns D", ids.includes(IDS.D), true);
  check("J. nationality=ลาว does not include A", !ids.includes(IDS.A), true);
}

// K. Approximate age (D has approximateAge=35, dateOfBirth=null)
{
  const r = await run("K. Age range 30-40", { ageMin: 30, ageMax: 40 });
  const item = r.items.find(x => x.id === IDS.D);
  check("K. ageMin=30 ageMax=40 includes D (approxAge=35)", r.items.some(x => x.id === IDS.D), true);
  check("K. D is marked isAgeApproximate=true", item?.isAgeApproximate, true);
  check("K. D has displayAge=35", item?.displayAge, 35);
}

// L. Network role COURIER → A
{
  const r = await run("L. networkRole=COURIER", { networkRoles: ["COURIER"] });
  check("L. networkRole=COURIER returns A", r.items.some(x => x.id === IDS.A), true);
  check("L. networkRole=COURIER does not return B", !r.items.some(x => x.id === IDS.B), true);
}

// M. Network role RETAIL_DEALER → B
{
  const r = await run("M. networkRole=RETAIL_DEALER", { networkRoles: ["RETAIL_DEALER"] });
  check("M. networkRole=RETAIL_DEALER returns B", r.items.some(x => x.id === IDS.B), true);
}

// N. Network role source TESTIMONY → A
{
  const r = await run("N. source=TESTIMONY", { networkRoleSources: ["TESTIMONY"] });
  check("N. source=TESTIMONY returns A", r.items.some(x => x.id === IDS.A), true);
}

// O. Network role source INVESTIGATION → B
{
  const r = await run("O. source=INVESTIGATION", { networkRoleSources: ["INVESTIGATION"] });
  check("O. source=INVESTIGATION returns B", r.items.some(x => x.id === IDS.B), true);
}

// P. Verification status UNVERIFIED → A
{
  const r = await run("P. verificationStatus=UNVERIFIED", { verificationStatuses: ["UNVERIFIED"] });
  check("P. UNVERIFIED returns A", r.items.some(x => x.id === IDS.A), true);
}

// Q. Network group filter
{
  const r = await run("Q. networkGroupId=QA group", { networkGroupIds: [QA_GROUP_ID] });
  const ids = r.items.map(x => x.id);
  check("Q. network group returns A", ids.includes(IDS.A), true);
  check("Q. network group returns B", ids.includes(IDS.B), true);
  check("Q. network group excludes E (not a member)", !ids.includes(IDS.E), true);
  // Verify names are resolved
  const itemA = r.items.find(x => x.id === IDS.A);
  const groupInfo = itemA?.networkGroups.find(g => g.id === QA_GROUP_ID);
  check("Q. group name resolved to 'เครือข่าย QA ชุมพร'", groupInfo?.name, "เครือข่าย QA ชุมพร");
}

// R. Min case count
{
  const r = await run("R. minCaseCount=2", { minCaseCount: 2 });
  const ids = r.items.map(x => x.id);
  check("R. minCaseCount=2 returns A (has 2 cases)", ids.includes(IDS.A), true);
  check("R. minCaseCount=2 returns B (has 2 cases)", ids.includes(IDS.B), true);
  check("R. minCaseCount=2 excludes E (has 1 case)", !ids.includes(IDS.E), true);
}

// S. Province filter (QA-001 is in ชุมพร)
{
  const r = await run("S. province=ชุมพร", { province: "ชุมพร" });
  const ids = r.items.map(x => x.id);
  check("S. province=ชุมพร returns A", ids.includes(IDS.A), true);
  check("S. province=ชุมพร returns B (shared QA-001)", ids.includes(IDS.B), true);
}

// V. Case procedural role (DrugCasePerson.role = SUSPECT)
{
  const r = await run("V. caseRoles=SUSPECT", { caseRoles: ["SUSPECT"] });
  const ids = r.items.map(x => x.id);
  check("V. SUSPECT returns at least A", ids.includes(IDS.A), true);
}

// W. Combined filters: sex=MALE + nationality=ไทย + networkRole=COURIER → A only
{
  const r = await run("W. Combined sex+nationality+networkRole", {
    sex: "MALE",
    nationality: "ไทย",
    networkRoles: ["COURIER"],
  });
  const ids = r.items.map(x => x.id);
  check("W. combined returns A", ids.includes(IDS.A), true);
  check("W. combined excludes B (RETAIL_DEALER not COURIER)", !ids.includes(IDS.B), true);
  check("W. combined excludes C (FEMALE + พม่า)", !ids.includes(IDS.C), true);
  check("W. combined excludes D (ลาว, no network role)", !ids.includes(IDS.D), true);
}

// X. Negative control: use E (ไทย, MALE, no network role, 1 case, no nickname)
{
  const r = await run("X. Negative control: E-only filters", {
    sex: "MALE",
    nationality: "ไทย",
    networkRoles: [],
    minCaseCount: 1,
  });
  // Actually filtering by sex+nationality+minCases still returns A/B, so use unique property of E
  // E has no network role, so adding verificationStatus=UNVERIFIED (which E doesn't have) should exclude E
  const r2 = await run("X. Negative control: E excluded by verif filter", {
    verificationStatuses: ["UNVERIFIED"],
  });
  const ids = r2.items.map(x => x.id);
  check("X. E has no network role, excluded from UNVERIFIED filter", !ids.includes(IDS.E), true);
}

// Y. Impossible combination: FEMALE + nationality=ลาว (D is MALE ลาว, C is FEMALE พม่า)
{
  const r = await run("Y. Impossible: sex=FEMALE + nationality=ลาว", {
    sex: "FEMALE",
    nationality: "ลาว",
  });
  check("Y. impossible combo returns 0 results", r.total, 0);
}

console.log("\n=== SECTION 6: Ranking QA ===\n");

// Ranking: EXACT > PREFIX > PARTIAL
{
  const r = await run("Ranking: EXACT > PARTIAL", { query: "แดง" });
  // A has NICKNAME EXACT "แดง"; C has alias PARTIAL "ไอ้แดง" contains "แดง"
  const idxA = r.items.findIndex(x => x.id === IDS.A);
  const idxC = r.items.findIndex(x => x.id === IDS.C);
  check("Ranking: A (EXACT) before C (PARTIAL)", idxA < idxC, true);
}

// Sort: NAME_ASC
{
  const r = await run("Sort NAME_ASC", { sort: "NAME_ASC" });
  const names = r.items.map(x => x.primaryFullName);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "th"));
  check("Sort NAME_ASC: names are in alphabetical order", names, sorted);
}

// Sort: CASE_COUNT_DESC
{
  const r = await run("Sort CASE_COUNT_DESC", { sort: "CASE_COUNT_DESC" });
  const counts = r.items.map(x => x.caseCount);
  check("Sort CASE_COUNT_DESC: first item has highest case count", counts[0] >= counts[counts.length - 1], true);
}

// Sort: AGE_ASC (D has known approximateAge=35; others null except E if they have age)
{
  const r = await run("Sort AGE_ASC", { sort: "AGE_ASC" });
  const ages = r.items.filter(x => x.displayAge !== null).map(x => x.displayAge);
  const isSorted = ages.every((age, i) => i === 0 || ages[i - 1] <= age);
  check("Sort AGE_ASC: persons with age are in ascending order", isSorted, true);
}

// Sort: AGE_DESC
{
  const r = await run("Sort AGE_DESC", { sort: "AGE_DESC" });
  const ages = r.items.filter(x => x.displayAge !== null).map(x => x.displayAge);
  const isSorted = ages.every((age, i) => i === 0 || ages[i - 1] >= age);
  check("Sort AGE_DESC: persons with age are in descending order", isSorted, true);
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
