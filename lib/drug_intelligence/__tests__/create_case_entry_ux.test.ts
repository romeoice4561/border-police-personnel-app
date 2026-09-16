/**
 * Create Case operational UX + BPP/joint-org reference integration.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/create_case_entry_ux.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

import {
  BPP_REGION_LABELS,
  BPP_UNIT_MASTER,
  bppBattalionLabelsForRegion,
  bppCompanyLabelsForBattalion,
} from "@/lib/drug_intelligence/bpp_unit_master";
import { JOINT_DRUG_ENFORCEMENT_ORG_LABELS, JOINT_DRUG_ENFORCEMENT_ORG_GROUPS } from "@/lib/drug_intelligence/joint_drug_enforcement_orgs";
import { resolveBppOrgSelection, participatingUnitHasSelection } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import { formatThaiTime, isValidThaiTime, parseThaiTime, stepThaiTimeHour, stepThaiTimeMinute, commitThaiTimeParts } from "@/lib/drug_intelligence/thai_time";
import {
  buildCreateCaseRequest,
  createEmptyDraft,
  createEmptyParticipatingUnitDraft,
  createEmptySeizedItemDraft,
  validateDraft,
} from "@/lib/drug_intelligence/create_case_draft";
import { leadUnitDisplayText, patchForOurArrestRole, reportingUnitDisplayText } from "@/lib/drug_intelligence/our_arrest_role";
import { DRUG_MEASUREMENT_KINDS } from "@/lib/drug_intelligence/drug_seized_item_options";
import { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";
import { kilogramsToGrams } from "@/lib/drug_intelligence/drug_seized_item_analytics";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function engineFromSeedNames(): OrganizationEngine {
  const tree: OrgTree = {
    headquarters: [{ id: 1, code: "BPP", nameTh: "บช.ตชด." }],
    regions: [{ id: 4, code: "4", nameTh: "ภาค 4", headquartersId: 1 }],
    battalions: [
      { id: 41, code: "41", nameTh: "กก.ตชด.41", regionId: 4 },
      { id: 44, code: "44", nameTh: "กก.ตชด.44", regionId: 4 },
    ],
    companies: [
      { id: 414, code: "414", nameTh: "ตชด.414", battalionId: 41 },
      { id: 444, code: "444", nameTh: "ตชด.444", battalionId: 44 },
      { id: 449, code: "449", nameTh: "ตชด.449", battalionId: 44 },
    ],
  };
  return new OrganizationEngine(tree);
}

test("A: Create Case case-record label is บันทึกคดี", () => {
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.field\.caseNumber": tr\("บันทึกคดี"/);
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  assert.match(arrest, /t\("di\.field\.caseNumber"\)/);
});

test("B: case-record example contains สภ.แม่จัน คดีอาญาที่ 23/2569", () => {
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.hint\.caseNumber":\s+tr\("สภ\.แม่จัน คดีอาญาที่ 23\/2569"/);
});

test("C: BPP Region → Battalion → Company mapping matches the supplied reference file", () => {
  const reference = JSON.parse(read("docs/reference/bpp-unit-master.txt")) as Record<string, Record<string, string[]>>;
  assert.deepEqual(Object.keys(BPP_UNIT_MASTER), Object.keys(reference));
  for (const region of Object.keys(reference)) {
    assert.deepEqual(bppBattalionLabelsForRegion(region), Object.keys(reference[region]));
    for (const battalion of Object.keys(reference[region])) {
      assert.deepEqual([...bppCompanyLabelsForBattalion(region, battalion)], reference[region][battalion]);
    }
  }
});

test("D: กก.ตชด.41 limits companies to ร้อย ตชด.414–417", () => {
  assert.deepEqual([...bppCompanyLabelsForBattalion("บก.ตชด.ภาค 4", "กก.ตชด.41")], [
    "ร้อย ตชด.414",
    "ร้อย ตชด.415",
    "ร้อย ตชด.416",
    "ร้อย ตชด.417",
  ]);
  assert.equal(bppCompanyLabelsForBattalion("บก.ตชด.ภาค 4", "กก.ตชด.41").includes("ร้อย ตชด.444"), false);
});

test("E: กก.ตชด.44 includes 444–449 exactly as the reference", () => {
  assert.deepEqual([...bppCompanyLabelsForBattalion("บก.ตชด.ภาค 4", "กก.ตชด.44")], [
    "ร้อย ตชด.444",
    "ร้อย ตชด.445",
    "ร้อย ตชด.446",
    "ร้อย ตชด.447",
    "ร้อย ตชด.448",
    "ร้อย ตชด.449",
  ]);
});

test("F: external/joint organization suggestions come from the supplied reference", () => {
  const reference = JSON.parse(read("docs/reference/หน่วยที่ชอบจับยา.txt")) as Record<string, string[]>;
  assert.deepEqual(JOINT_DRUG_ENFORCEMENT_ORG_GROUPS, reference);
  assert.ok(JOINT_DRUG_ENFORCEMENT_ORG_LABELS.includes("บช.ปส."));
  assert.ok(JOINT_DRUG_ENFORCEMENT_ORG_LABELS.includes("สำนักงาน ป.ป.ส."));
  assert.ok(JOINT_DRUG_ENFORCEMENT_ORG_LABELS.includes("กรมสอบสวนคดีพิเศษ (DSI)"));
  assert.ok(JOINT_DRUG_ENFORCEMENT_ORG_LABELS.includes("ภ.1"));
});

test("G: other-unit fallback remains available on arrest and units steps", () => {
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  const units = read("components/drug_intelligence/create_case_units_step.tsx");
  const sourcePicker = read("components/drug_intelligence/create_case_org_source_picker.tsx");
  assert.match(arrest, /di\.org\.fallbackOption/);
  assert.match(units, /CreateCaseOrgSourcePicker/);
  assert.match(sourcePicker, /di\.org\.fallbackOption/);
  assert.match(arrest, /useManualUnit: true/);
});

test("H: reporting unit and lead arrest unit remain distinct fields", () => {
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  assert.match(arrest, /di\.field\.reportingUnit/);
  assert.match(arrest, /di\.arrestUnit\.sectionLabel/);
  assert.match(arrest, /sameAsReportingUnit/);
  assert.match(arrest, /leadCompanyId/);
  assert.equal(arrest.includes("applyReportingUnit"), true);
  assert.equal(arrest.includes("applyLeadSource"), true);

  const draft = createEmptyDraft();
  draft.caseNumber = "สภ.แม่จัน คดีอาญาที่ 23/2569";
  draft.title = "ทดสอบ";
  draft.companyText = "ร้อย ตชด.414";
  draft.leadCompanyText = "ร้อย ตชด.444";
  draft.sameAsReportingUnit = false;
  const req = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(req.reportingUnitText, "ร้อย ตชด.414");
  assert.equal(req.leadUnitText, "ร้อย ตชด.444");
});

test("I: primary seized quantity field is explicitly labelled จำนวน / น้ำหนัก", () => {
  const seized = read("components/drug_intelligence/create_case_seized_step.tsx");
  assert.match(seized, /di\.seized\.countQuantity/);
  assert.match(seized, /di\.seized\.massQuantity/);
  assert.match(seized, /di\.seized\.primaryQuantityHeading/);
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.seized\.countQuantity":\s+tr\("จำนวน"/);
  assert.match(dict, /"di\.seized\.massQuantity":\s+tr\("น้ำหนัก"/);
});

test("J: COUNT / MASS remain distinct; VOLUME is not invented as a persisted kind", () => {
  assert.deepEqual([...DRUG_MEASUREMENT_KINDS], ["COUNT", "MASS"]);
  assert.equal((DRUG_MEASUREMENT_KINDS as readonly string[]).includes("VOLUME"), false);

  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  const countItem = createEmptySeizedItemDraft();
  countItem.drugCategory = "METHAMPHETAMINE_TABLET";
  countItem.measurementKind = "COUNT";
  countItem.drugType = "ยาบ้า";
  countItem.quantity = "2000";
  countItem.unit = "เม็ด";
  countItem.weightKilograms = "99";
  draft.seizedItems.push(countItem);
  const countReq = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(countReq.seizedItems[0].measurementKind, "COUNT");
  assert.equal(countReq.seizedItems[0].quantity, 2000);
  assert.equal(countReq.seizedItems[0].weightGrams, null);

  const massDraft = createEmptyDraft();
  massDraft.caseNumber = "X";
  massDraft.title = "X";
  const massItem = createEmptySeizedItemDraft();
  massItem.drugCategory = "CRYSTAL_METHAMPHETAMINE";
  massItem.measurementKind = "MASS";
  massItem.drugType = "ไอซ์";
  massItem.weightKilograms = "1.5";
  massItem.quantity = "2000";
  massDraft.seizedItems.push(massItem);
  const massReq = buildCreateCaseRequest(massDraft, "a", "b");
  assert.equal(massReq.seizedItems[0].measurementKind, "MASS");
  assert.equal(massReq.seizedItems[0].quantity, null);
  assert.equal(massReq.seizedItems[0].weightGrams, kilogramsToGrams(1.5));

  const volumeDraft = createEmptyDraft();
  volumeDraft.caseNumber = "X";
  volumeDraft.title = "X";
  const volumeItem = createEmptySeizedItemDraft();
  volumeItem.drugCategory = "OTHER";
  volumeItem.otherDrugCategoryLabel = "น้ำยา";
  volumeItem.measurementKind = "VOLUME";
  volumeItem.drugType = "น้ำยา";
  volumeDraft.seizedItems.push(volumeItem);
  const volumeErrors = validateDraft(volumeDraft);
  assert.ok(volumeErrors.some((e) => e.message.includes("ปริมาตร")));
});

test("K: packaging quantity remains secondary optional packageCount", () => {
  const seized = read("components/drug_intelligence/create_case_seized_step.tsx");
  assert.match(seized, /di\.seized\.packagingSection/);
  assert.match(seized, /packageCount/);
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  const item = createEmptySeizedItemDraft();
  item.drugCategory = "METHAMPHETAMINE_TABLET";
  item.measurementKind = "COUNT";
  item.drugType = "ยาบ้า";
  item.quantity = "2000";
  item.packageCount = "10";
  draft.seizedItems.push(item);
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.seizedItems[0].quantity, 2000);
  assert.equal(req.seizedItems[0].packageCount, 10);
});

test("L: raw/official description remains available", () => {
  const seized = read("components/drug_intelligence/create_case_seized_step.tsx");
  assert.match(seized, /di\.seized\.drugType/);
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.seized\.drugType": tr\("รายละเอียดตามที่บันทึก"/);
});

test("M: time entry is optional HH:mm and easy to select via hour/minute", () => {
  assert.equal(isValidThaiTime(""), true);
  assert.equal(isValidThaiTime("14:30"), true);
  assert.equal(isValidThaiTime("24:00"), false);
  assert.deepEqual(parseThaiTime("14:30"), { hour: "14", minute: "30" });
  assert.equal(formatThaiTime("07", "05"), "07:05");
  const picker = read("components/ui/thai_time_picker.tsx");
  assert.match(picker, /ชั่วโมง/);
  assert.match(picker, /นาที/);
  assert.match(picker, /ล้างเวลา/);
  assert.equal(picker.includes("from \"@/components/ui/select\""), false);
  assert.equal(/<select[\s>]/i.test(picker), false);
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  assert.match(arrest, /ThaiTimePicker/);
  assert.equal(arrest.includes('type="time"'), false);
});

test("N: investigator name/phone are real persisted case-contact fields, not fake UI", () => {
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  assert.equal([...arrest.matchAll(/di\.investigator\.sectionLabel/g)].length, 1);
  assert.equal([...arrest.matchAll(/id="di-investigatorName"/g)].length, 1);
  assert.equal([...arrest.matchAll(/id="di-investigatorPhone"/g)].length, 1);
  assert.match(arrest, /di\.investigator\.name/);
  assert.match(arrest, /di\.investigator\.phone/);
  const draftSrc = read("lib/drug_intelligence/create_case_draft.ts");
  assert.match(draftSrc, /investigatorName/);
  assert.match(draftSrc, /investigatorPhone/);
  const types = read("lib/drug_intelligence/drug_case_types.ts");
  assert.match(types, /investigatorName/);
  const schema = read("prisma/schema.prisma");
  const drugCaseBlock = schema.slice(schema.indexOf("model DrugCase {"), schema.indexOf("model DrugCaseParticipatingUnit"));
  assert.match(drugCaseBlock, /investigatorName/);
  assert.match(drugCaseBlock, /investigatorPhone/);
  const officerBlock = schema.slice(schema.indexOf("model DrugCaseOfficer {"), schema.indexOf("model DrugPerson {"));
  assert.equal(officerBlock.includes("investigatorPhone"), false);
});

test("Step 1 renders exactly one investigator-contact heading, name input, and phone input", () => {
  const arrest = read("components/drug_intelligence/create_case_arrest_step.tsx");
  const page = read("app/drug-intelligence/cases/new/page.tsx");
  assert.equal((page.match(/<CreateCaseArrestStep/g) ?? []).length, 1);
  assert.equal((arrest.match(/di\.investigator\.sectionLabel/g) ?? []).length, 1);
  assert.equal((arrest.match(/id="di-investigatorName"/g) ?? []).length, 1);
  assert.equal((arrest.match(/id="di-investigatorPhone"/g) ?? []).length, 1);
  const headingBeforeReporting = arrest.indexOf("di.investigator.sectionLabel");
  const reporting = arrest.indexOf("di.field.reportingUnit");
  const status = arrest.indexOf("di.field.status");
  assert.ok(status >= 0 && headingBeforeReporting > status && headingBeforeReporting < reporting);
});

test("cascade keeps master-list labels while resolving existing DB company names like ตชด.414", () => {
  const resolved = resolveBppOrgSelection(engineFromSeedNames(), {
    regionText: "บก.ตชด.ภาค 4",
    battalionText: "กก.ตชด.41",
    companyText: "ร้อย ตชด.414",
  });
  assert.equal(resolved.regionText, "บก.ตชด.ภาค 4");
  assert.equal(resolved.battalionText, "กก.ตชด.41");
  assert.equal(resolved.companyText, "ร้อย ตชด.414");
  assert.equal(resolved.companyId, 414);
  assert.equal(resolved.battalionId, 41);
  assert.equal(resolved.regionId, 4);
  assert.equal(resolved.headquartersId, 1);
});

test("unknown typed unit does not invent organization ids", () => {
  const resolved = resolveBppOrgSelection(engineFromSeedNames(), {
    regionText: "หน่วยที่ไม่มีในรายการ",
    battalionText: "",
    companyText: "",
  });
  assert.equal(resolved.regionId, null);
  assert.equal(resolved.battalionId, null);
  assert.equal(resolved.companyId, null);
  assert.equal(resolved.regionText, "หน่วยที่ไม่มีในรายการ");
});

test("joint org participating unit stores text only and does not copy reporting/lead", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.414";
  const unit = createEmptyParticipatingUnitDraft();
  unit.useManualUnit = true;
  unit.manualUnitText = "สำนักงาน ป.ป.ส.";
  draft.participatingUnits.push(unit);
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.reportingUnitText, "ร้อย ตชด.414");
  assert.equal(req.leadUnitText, null);
  assert.equal(req.participatingUnits?.[0]?.unitText, "สำนักงาน ป.ป.ส.");
  assert.equal(req.participatingUnits?.[0]?.headquartersId ?? null, null);
});

test("BPP participating unit with labels but no ids is still submitted as unitText", () => {
  const unit = createEmptyParticipatingUnitDraft();
  unit.regionText = "บก.ตชด.ภาค 4";
  unit.battalionText = "กก.ตชด.41";
  unit.companyText = "ร้อย ตชด.414";
  assert.equal(participatingUnitHasSelection(unit), true);
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.participatingUnits.push(unit);
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.participatingUnits?.[0]?.unitText, "ร้อย ตชด.414");
});

test("region list is exactly the four BPP commands from the master file", () => {
  assert.deepEqual([...BPP_REGION_LABELS], ["บก.ตชด.ภาค 1", "บก.ตชด.ภาค 2", "บก.ตชด.ภาค 3", "บก.ตชด.ภาค 4"]);
});

test("A polish: time picker does not use a 24-row native hour dropdown", () => {
  const picker = read("components/ui/thai_time_picker.tsx");
  assert.equal(/<select[\s>]/i.test(picker), false);
  assert.equal(picker.includes("from \"@/components/ui/select\""), false);
  assert.match(picker, /stepThaiTimeHour/);
  assert.match(picker, /THAI_TIME_QUICK_MINUTES/);
  assert.match(picker, /น\./);
});

test("B polish: any valid HH:mm remains supported including non-5-minute values", () => {
  assert.equal(isValidThaiTime("09:30"), true);
  assert.equal(isValidThaiTime("09:07"), true);
  assert.equal(commitThaiTimeParts("9", "7"), "09:07");
  assert.equal(stepThaiTimeHour("09:07", 1), "10:07");
  assert.equal(stepThaiTimeMinute("09:07", 5), "09:12");
});

test("C polish: clear time is represented as an empty optional HH:mm", () => {
  const picker = read("components/ui/thai_time_picker.tsx");
  assert.match(picker, /ล้างเวลา/);
  assert.match(picker, /onChange\(""\)/);
  assert.equal(isValidThaiTime(""), true);
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.arrestTime = "";
  assert.equal(buildCreateCaseRequest(draft, "a", "b").arrestTime, null);
  draft.arrestTime = "09:30";
  assert.equal(buildCreateCaseRequest(draft, "a", "b").arrestTime, "09:30");
});

test("D polish: lead-role selection copies reporting unit into lead without a new persisted role field", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.414";
  Object.assign(draft, patchForOurArrestRole("LEAD"));
  assert.equal(draft.ourArrestRole, "LEAD");
  assert.equal(draft.sameAsReportingUnit, true);
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.reportingUnitText, "ร้อย ตชด.414");
  assert.equal(req.leadUnitText, "ร้อย ตชด.414");
  assert.equal("ourArrestRole" in req, false);
});

test("E polish: participating-role selection does not overwrite reporting unit", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.414";
  Object.assign(draft, patchForOurArrestRole("SUPPORTING"));
  draft.useLeadManualUnit = true;
  draft.leadManualUnitText = "บช.ปส.";
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.reportingUnitText, "ร้อย ตชด.414");
  assert.equal(req.leadUnitText, "บช.ปส.");
  assert.notEqual(req.reportingUnitText, req.leadUnitText);
  assert.equal((req.participatingUnits ?? []).length, 0);
});

test("F polish: external lead unit can still be represented as manual lead text", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.414";
  Object.assign(draft, patchForOurArrestRole("SUPPORTING"));
  draft.useLeadManualUnit = true;
  draft.leadManualUnitText = "สำนักงาน ป.ป.ส.";
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.leadHeadquartersId, null);
  assert.equal(req.leadUnitText, "สำนักงาน ป.ป.ส.");
  assert.equal(reportingUnitDisplayText(draft), "ร้อย ตชด.414");
  assert.equal(leadUnitDisplayText(draft), "สำนักงาน ป.ป.ส.");
});

test("G polish: BPP lead cascade labels still resolve for กก.ตชด.41 → ร้อย ตชด.414", () => {
  const resolved = resolveBppOrgSelection(engineFromSeedNames(), {
    regionText: "บก.ตชด.ภาค 4",
    battalionText: "กก.ตชด.41",
    companyText: "ร้อย ตชด.414",
  });
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.417";
  Object.assign(draft, patchForOurArrestRole("SUPPORTING"));
  draft.leadRegionText = resolved.regionText;
  draft.leadBattalionText = resolved.battalionText;
  draft.leadCompanyText = resolved.companyText;
  draft.leadCompanyId = resolved.companyId;
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.leadUnitText, "ร้อย ตชด.414");
  assert.equal(req.leadCompanyId, 414);
  assert.equal(req.reportingUnitText, "ร้อย ตชด.417");
});

test("H polish: participating units remain distinct from lead unit", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "X";
  draft.title = "X";
  draft.companyText = "ร้อย ตชด.414";
  Object.assign(draft, patchForOurArrestRole("SUPPORTING"));
  draft.useLeadManualUnit = true;
  draft.leadManualUnitText = "บช.ปส.";
  const unit = createEmptyParticipatingUnitDraft();
  unit.useManualUnit = true;
  unit.manualUnitText = "กรมศุลกากร";
  draft.participatingUnits.push(unit);
  const req = buildCreateCaseRequest(draft, "a", "b");
  assert.equal(req.leadUnitText, "บช.ปส.");
  assert.equal(req.participatingUnits?.[0]?.unitText, "กรมศุลกากร");
  assert.notEqual(req.participatingUnits?.[0]?.unitText, req.leadUnitText);
  assert.notEqual(req.participatingUnits?.[0]?.unitText, req.reportingUnitText);
});

test("I polish: Step 2 participating-unit flow is still present and not a second lead picker", () => {
  const units = read("components/drug_intelligence/create_case_units_step.tsx");
  assert.match(units, /di\.participatingUnits\.sectionLabel/);
  assert.match(units, /CreateCaseOrgSourcePicker/);
  assert.equal(units.includes("ourArrestRole"), false);
  assert.equal(units.includes("sameAsReportingUnit"), false);
});

test("J polish: Create Case submit payload remains compatible with existing backend fields", () => {
  const draft = createEmptyDraft();
  draft.caseNumber = "สภ.แม่จัน คดีอาญาที่ 23/2569";
  draft.title = "ทดสอบ";
  draft.arrestTime = "09:30";
  Object.assign(draft, patchForOurArrestRole("LEAD"));
  draft.companyText = "ร้อย ตชด.414";
  const req = buildCreateCaseRequest(draft, "mock:admin", "Administrator");
  assert.equal(req.caseNumber, "สภ.แม่จัน คดีอาญาที่ 23/2569");
  assert.equal(req.arrestTime, "09:30");
  assert.ok("reportingUnitText" in req);
  assert.ok("leadUnitText" in req);
  assert.ok("participatingUnits" in req);
  assert.equal("ourArrestRole" in req, false);
  assert.equal(req.investigatorName, null);
  assert.equal(req.investigatorPhone, null);
});

test("K polish: our-unit role remains UI-only; investigator contact is a real DrugCase column", () => {
  const schema = read("prisma/schema.prisma");
  const drugCaseBlock = schema.slice(schema.indexOf("model DrugCase {"), schema.indexOf("model DrugCaseParticipatingUnit"));
  assert.equal(drugCaseBlock.includes("ourArrestRole"), false);
  assert.match(drugCaseBlock, /investigatorName/);
  const types = read("lib/drug_intelligence/drug_case_types.ts");
  assert.equal(types.includes("ourArrestRole"), false);
  const picker = read("components/ui/thai_time_picker.tsx");
  assert.equal(picker.includes("from \"@radix-ui"), false);
});
