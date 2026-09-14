/**
 * C-INTEL Person provenance UX: navigation, masking, and query architecture
 * guards (source inspection + helpers). Does not invent case context.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

import { drugEntityDetailPath, drugPersonProfilePath } from "@/lib/drug_intelligence/drug_entity_routes";
import { withReturnTo, getSafeReturnTo } from "@/lib/ui/return_context";
import { resolvePersonProfileCaseContext } from "@/lib/drug_intelligence/person_case_context";
import { presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const profileServiceSrc = read("lib/drug_intelligence/drug_person_profile_service.ts");
const personPageSrc = read("app/drug-intelligence/persons/[id]/page.tsx");
const drawerSrc = read("components/drug_intelligence/drug_person_drawer.tsx");
const casePageSrc = read("app/drug-intelligence/cases/[id]/page.tsx");
const searchCardSrc = read("components/drug_intelligence/drug_search_result_card.tsx");
const personsListSrc = read("app/drug-intelligence/persons/page.tsx");
const provenanceUiSrc = read("components/drug_intelligence/drug_person_provenance.tsx");
const networkNodeSrc = read("components/drug_intelligence/drug_network_node_detail.tsx");
const mapPopupSrc = read("components/drug_intelligence/drug_geo_marker_popup.tsx");
const mapPersonsDrawerSrc = read("components/drug_intelligence/drug_geo_persons_drawer.tsx");
const timelineSrc = read("app/drug-intelligence/timeline/page.tsx");
const dictionarySrc = read("lib/i18n/dictionary.ts");
const prismaSchemaSrc = read("prisma/schema.prisma");
const caseServiceSrc = read("lib/drug_intelligence/drug_case_service.ts");

test("Case → Person preserves validated caseId and existing returnTo; does not use returnTo as case identity", () => {
  assert.match(drawerSrc, /drugPersonProfilePath\(personId,\s*\{\s*caseId\s*\}\)/);
  assert.match(drawerSrc, /withReturnTo\(/);
  assert.match(casePageSrc, /caseId=\{caseId\}/);
  assert.match(casePageSrc, /withReturnTo\(`\/drug-intelligence\/cases\/\$\{encodeURIComponent\(caseId\)\}`/);
  assert.match(personPageSrc, /getSafeReturnTo\(searchParams\)/);
  assert.match(personPageSrc, /resolvePersonProfileCaseContext\(/);
  assert.match(personPageSrc, /searchParams\.get\("caseId"\)/);
  assert.doesNotMatch(personPageSrc, /resolvePersonProfileCaseContext\(returnTo/);
});

test("Search and Persons list do not invent case context on Person Profile links", () => {
  assert.match(searchCardSrc, /drugEntityDetailPath\(/);
  assert.doesNotMatch(searchCardSrc, /drugPersonProfilePath/);
  assert.doesNotMatch(searchCardSrc, /caseId=/);
  assert.match(personsListSrc, /\/drug-intelligence\/persons\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.doesNotMatch(personsListSrc, /drugPersonProfilePath/);
  const href = drugEntityDetailPath("PERSON", "04d2ac30-976a-460d-b77d-31e74153e59f");
  assert.equal(href.includes("caseId="), false);
  assert.equal(drugPersonProfilePath("04d2ac30-976a-460d-b77d-31e74153e59f").includes("caseId="), false);
});

test("browser Back and returnTo stay URL-state only — no replace-on-mount, no DB case session", () => {
  assert.doesNotMatch(personPageSrc, /router\.replace/);
  assert.doesNotMatch(profileServiceSrc, /currentCaseId/);
  assert.match(personPageSrc, /data-testid="back-via-return-to"/);
  const withBoth = withReturnTo(
    drugPersonProfilePath("04d2ac30-976a-460d-b77d-31e74153e59f", { caseId: "11111111-1111-4111-8111-111111111111" }),
    "/drug-intelligence/cases/11111111-1111-4111-8111-111111111111"
  );
  const params = new URLSearchParams(withBoth.split("?")[1]);
  assert.equal(params.get("caseId"), "11111111-1111-4111-8111-111111111111");
  assert.equal(getSafeReturnTo(params), "/drug-intelligence/cases/11111111-1111-4111-8111-111111111111");
});

test("invalid or unrelated case context fails closed to aggregate mode", () => {
  const personIdCases = ["11111111-1111-4111-8111-111111111111"];
  assert.equal(resolvePersonProfileCaseContext("not-valid", personIdCases), null);
  assert.equal(resolvePersonProfileCaseContext("22222222-2222-4222-8222-222222222222", personIdCases), null);
  assert.equal(resolvePersonProfileCaseContext("https://evil.example", personIdCases), null);
});

test("masked presentation is used for phone/SIM/IMEI in provenance UI; unmasked values are not interpolated raw", () => {
  assert.match(personPageSrc, /presentPhoneNumber\(phone\.phoneNumber\.normalizedNumber,\s*canViewFull\)/);
  assert.match(personPageSrc, /presentIdentifierValue\(row\.sim\.iccid,\s*canViewFull\)/);
  assert.match(personPageSrc, /presentIdentifierValue\(d\.device\.imei1,\s*canViewFull\)/);
  assert.equal(presentPhoneNumber("0812345678", false), "081-xxx-5678");
  assert.notEqual(presentPhoneNumber("0812345678", false), "0812345678");
});

test("getProfile batches entity loads — no per-phone findById / no caseLocationsForCase loop / no DrugCaseRepository.list", () => {
  const getProfile = profileServiceSrc.slice(profileServiceSrc.indexOf("async getProfile"), profileServiceSrc.indexOf("private async computeDataQuality"));
  assert.match(getProfile, /findByIdsPhones/);
  assert.match(getProfile, /findByIdsSims/);
  assert.match(getProfile, /caseLocationsForCases/);
  assert.doesNotMatch(getProfile, /findPhoneNumberById/);
  assert.doesNotMatch(getProfile, /caseLocationsForCase\(/);
  assert.doesNotMatch(getProfile, /\.list\(/);
  assert.doesNotMatch(getProfile, /findLocationById/);
});

test("overview uses current-case vs other-case sections, not a database-style comparison table", () => {
  assert.match(provenanceUiSrc, /DrugPersonCaseSplitOverview/);
  assert.match(provenanceUiSrc, /person-current-case-section/);
  assert.match(provenanceUiSrc, /person-other-cases-section/);
  assert.match(provenanceUiSrc, /person-aggregate-banner/);
  assert.match(provenanceUiSrc, /person-intelligence-summary/);
  assert.match(provenanceUiSrc, /di\.profile\.fromCurrentCase/);
  assert.match(provenanceUiSrc, /di\.profile\.fromOtherCasesAdditional/);
  assert.match(provenanceUiSrc, /di\.profile\.noneInThisCase/);
  assert.match(personPageSrc, /DrugPersonCaseSplitOverview/);
  assert.match(personPageSrc, /currentCaseId \? \(/);
  assert.match(personPageSrc, /person-phones-current-section/);
  assert.doesNotMatch(provenanceUiSrc, /person-provenance-current-col/);
  assert.doesNotMatch(provenanceUiSrc, /DrugPersonRelatedCountsTable/);
  assert.doesNotMatch(personPageSrc, /DrugPersonRelatedCountsTable/);
  const intelCopy = dictionarySrc.slice(dictionarySrc.indexOf('"di.profile.intelligenceTitle"'), dictionarySrc.indexOf('"di.profile.seenFromNamedCase"'));
  assert.doesNotMatch(intelCopy, /เครือข่ายใหญ่|ผู้ค้ารายใหญ่|มีความเสี่ยงสูง|ใช้เบอร์นี้ก่อเหตุ/);
});

test("aggregate entry points do not fabricate current-case context", () => {
  assert.match(networkNodeSrc, /drugEntityDetailPath\(node\.type, node\.id\)/);
  assert.doesNotMatch(networkNodeSrc, /drugPersonProfilePath/);
  assert.doesNotMatch(mapPopupSrc, /drugPersonProfilePath/);
  assert.doesNotMatch(mapPopupSrc, /persons\/\$\{encodeURIComponent\(person\.personId\)\}\?/);
  assert.doesNotMatch(mapPersonsDrawerSrc, /drugPersonProfilePath/);
  assert.doesNotMatch(mapPersonsDrawerSrc, /persons\/\$\{encodeURIComponent\(p\.personId\)\}\?/);
  assert.match(timelineSrc, /\/drug-intelligence\/persons\/\$\{encodeURIComponent\(p\.personId\)\}/);
  assert.doesNotMatch(timelineSrc, /drugPersonProfilePath/);
  assert.doesNotMatch(timelineSrc, /persons\/\$\{encodeURIComponent\(p\.personId\)\}\?/);
});

test("case person drawer dedupes phones client-side without extra queries or schema changes", () => {
  assert.match(drawerSrc, /presentDrawerPhones\(detail\.data\.phones,\s*caseId \?\? null\)/);
  assert.doesNotMatch(drawerSrc, /\$\{phone\.caseId\}-\$\{phone\.phoneNumberId\}/);
  assert.doesNotMatch(drawerSrc, /findPhoneNumberById/);
  const getPersonDetail = caseServiceSrc.slice(caseServiceSrc.indexOf("async getPersonDetail"), caseServiceSrc.indexOf("function summarizeSeizedItems"));
  assert.match(getPersonDetail, /phones,/);
  assert.doesNotMatch(prismaSchemaSrc, /PersonProvenance/);
});

test("RBAC masking remains gated on drug.edit and is not bypassed in provenance presentation", () => {
  assert.match(personPageSrc, /can\("drug.edit"\)/);
  assert.match(drawerSrc, /can\("drug.edit"\)/);
  assert.match(provenanceUiSrc, /presentPhoneNumber\(/);
  assert.match(provenanceUiSrc, /presentIdentifierValue\(/);
});
