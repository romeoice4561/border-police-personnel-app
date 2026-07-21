/**
 * Phase 49A.2B — Timeline organization field round-trip persistence.
 *
 * Proves structured org labels and legacy `unit` persist independently with
 * no cross-field shifting during serialize → Zod → service → DB → read-back.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";
import { handleOfficerProfileSave } from "@/lib/officer_profile/officer_profile_api_handlers";
import { timelineRowSchema, officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";
import {
  displayOrgLabel,
  hydrateOrgLabel,
  resolvePersistedLegacyUnit,
  serializeTimelineDraftForSave,
  type TimelineOrgPersistenceDraft,
} from "@/lib/officer_profile/timeline_org_persistence";

function officerInput(ov: Partial<OfficerInput> = {}): OfficerInput {
  return {
    officerId: "ภาค1/5",
    rank: "ร.ต.ท.",
    firstName: "อนิรุทธิ์",
    lastName: "ขาวจันทร์คง",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 19,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    driveFileId: null,
    thumbnailUrl: null,
    webViewUrl: null,
    ...ov,
  };
}

function baseDraft(ov: Partial<TimelineOrgPersistenceDraft> = {}): TimelineOrgPersistenceDraft {
  return {
    year: "2560",
    rank: "TEST-RANK",
    position: "TEST-POSITION",
    positionLevel: "Unknown",
    unit: "TEST-LEGACY-UNIT",
    source: "manual",
    verified: "ยังไม่ตรวจ",
    day: null,
    month: null,
    yearBE: 2560,
    appointmentCycle: 2560,
    isPresent: false,
    headquartersId: null,
    headquartersText: "TEST-BUREAU",
    regionId: null,
    regionText: "TEST-DIVISION",
    battalionId: null,
    battalionText: "TEST-SUBDIVISION",
    companyId: null,
    companyText: "TEST-COMPANY",
    appointmentOrder: "",
    workLine: "",
    verificationStatus: "PENDING",
    verifiedBy: "tester",
    verifiedDate: "",
    verificationRemark: "round-trip",
    ...ov,
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/officers/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("resolvePersistedLegacyUnit never substitutes structured org labels", () => {
  assert.equal(resolvePersistedLegacyUnit("TEST-LEGACY-UNIT"), "TEST-LEGACY-UNIT");
  assert.equal(resolvePersistedLegacyUnit("  "), null);
  assert.equal(resolvePersistedLegacyUnit(""), null);
});

test("serializeTimelineDraftForSave keeps every org field in its own slot — no shifting into unit", () => {
  const payload = serializeTimelineDraftForSave(baseDraft(), 0);
  assert.equal(payload.unit, "TEST-LEGACY-UNIT");
  assert.equal(payload.headquartersText, "TEST-BUREAU");
  assert.equal(payload.regionText, "TEST-DIVISION");
  assert.equal(payload.battalionText, "TEST-SUBDIVISION");
  assert.equal(payload.companyText, "TEST-COMPANY");
  assert.equal(payload.position, "TEST-POSITION");
  assert.equal(payload.rank, "TEST-RANK");
  assert.notEqual(payload.unit, payload.companyText);
  assert.notEqual(payload.unit, payload.battalionText);
});

test("serializeTimelineDraftForSave: only legacy unit populated", () => {
  const payload = serializeTimelineDraftForSave(
    baseDraft({
      headquartersText: "",
      regionText: "",
      battalionText: "",
      companyText: "",
      unit: "ชื่อหน่วยเดิมเท่านั้น",
    }),
    0
  );
  assert.equal(payload.unit, "ชื่อหน่วยเดิมเท่านั้น");
  assert.equal(payload.headquartersText, null);
  assert.equal(payload.regionText, null);
  assert.equal(payload.battalionText, null);
  assert.equal(payload.companyText, null);
});

test("serializeTimelineDraftForSave: structured fields plus different legacy unit", () => {
  const payload = serializeTimelineDraftForSave(
    baseDraft({
      headquartersText: "กองบัญชาการ",
      regionText: "กองบังคับการ",
      battalionText: "กองกำกับ",
      companyText: "กองร้อย/หน่วย",
      unit: "ชื่อหน่วยเดิม",
    }),
    0
  );
  assert.equal(payload.headquartersText, "กองบัญชาการ");
  assert.equal(payload.regionText, "กองบังคับการ");
  assert.equal(payload.battalionText, "กองกำกับ");
  assert.equal(payload.companyText, "กองร้อย/หน่วย");
  assert.equal(payload.unit, "ชื่อหน่วยเดิม");
});

test("serializeTimelineDraftForSave: blank optional org fields stay null", () => {
  const payload = serializeTimelineDraftForSave(
    baseDraft({
      headquartersText: "  ",
      regionText: "",
      battalionText: "\t",
      companyText: "",
      unit: "",
    }),
    0
  );
  assert.equal(payload.headquartersText, null);
  assert.equal(payload.regionText, null);
  assert.equal(payload.battalionText, null);
  assert.equal(payload.companyText, null);
  assert.equal(payload.unit, null);
});

test("serializeTimelineDraftForSave: mixed Thai/English and unmatched master values", () => {
  const payload = serializeTimelineDraftForSave(
    baseDraft({
      headquartersText: "บช.น. HQ-Alpha",
      regionText: "บก.น.9 Division",
      battalionText: "สน.ท่าข้าม",
      companyText: "Investigation Unit",
      unit: "สน.ท่าข้าม LEGACY",
    }),
    0
  );
  assert.equal(payload.headquartersText, "บช.น. HQ-Alpha");
  assert.equal(payload.regionText, "บก.น.9 Division");
  assert.equal(payload.battalionText, "สน.ท่าข้าม");
  assert.equal(payload.companyText, "Investigation Unit");
  assert.equal(payload.unit, "สน.ท่าข้าม LEGACY");
});

test("hydrateOrgLabel prefers stored text over resolved master label", () => {
  assert.equal(hydrateOrgLabel("TEST-COMPANY", "Master Company Name"), "TEST-COMPANY");
  assert.equal(hydrateOrgLabel("", "Master Company Name"), "Master Company Name");
  assert.equal(hydrateOrgLabel(null, "Master Company Name"), "Master Company Name");
  assert.equal(hydrateOrgLabel(null, null), "");
  assert.equal(displayOrgLabel("x", "y"), "x");
  assert.equal(displayOrgLabel(null, null), null);
});

test("timelineRowSchema accepts and preserves org label texts field-by-field", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0,
    year: "2560",
    yearValue: 2560,
    rank: "TEST-RANK",
    position: "TEST-POSITION",
    unit: "TEST-LEGACY-UNIT",
    source: "manual",
    verified: "ยังไม่ตรวจ",
    headquartersText: "TEST-BUREAU",
    regionText: "TEST-DIVISION",
    battalionText: "TEST-SUBDIVISION",
    companyText: "TEST-COMPANY",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.unit, "TEST-LEGACY-UNIT");
  assert.equal(result.data.headquartersText, "TEST-BUREAU");
  assert.equal(result.data.regionText, "TEST-DIVISION");
  assert.equal(result.data.battalionText, "TEST-SUBDIVISION");
  assert.equal(result.data.companyText, "TEST-COMPANY");
});

test("API contract: PATCH unique org fields then read-back equals submitted values exactly", async () => {
  const db = new InMemoryDatabaseClient();
  const officers = new OfficerRepository(db);
  await officers.upsert(officerInput());
  const officer = await officers.findByOfficerId("ภาค1/5");
  assert.ok(officer);

  const service = new OfficerProfileService({ db });
  const payload = serializeTimelineDraftForSave(baseDraft(), 0);
  const body = {
    timeline: [payload],
  };
  assert.equal(officerProfileSaveSchema.safeParse(body).success, true);

  const res = await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest(body));
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { timelineRowCount: number; officerId: string } };
  assert.equal(json.data.timelineRowCount, 1);

  const timelineRepo = new TimelineRepository(db);
  const row = await timelineRepo.findByOfficerAndSequence(officer.id, 0);
  assert.ok(row);
  assert.equal(row.unit, "TEST-LEGACY-UNIT");
  assert.equal(row.headquartersText, "TEST-BUREAU");
  assert.equal(row.regionText, "TEST-DIVISION");
  assert.equal(row.battalionText, "TEST-SUBDIVISION");
  assert.equal(row.companyText, "TEST-COMPANY");
  assert.equal(row.position, "TEST-POSITION");
  assert.equal(row.rank, "TEST-RANK");
  assert.equal(row.verificationStatus, "PENDING");
  assert.equal(row.verifiedBy, "tester");
  assert.equal(row.verificationRemark, "round-trip");

  // No duplicate rows
  assert.equal(await timelineRepo.countForOfficer(officer.id), 1);

  // Officer current unit unchanged by historical timeline save
  const after = await officers.findByOfficerId("ภาค1/5");
  assert.equal(after?.currentUnit, "ตชด.447");
  assert.equal(after?.currentPosition, "ผบ.ร้อย");
});

test("API contract: edit existing timeline row preserves independent org fields on second save", async () => {
  const db = new InMemoryDatabaseClient();
  const officers = new OfficerRepository(db);
  await officers.upsert(officerInput());
  const officer = await officers.findByOfficerId("ภาค1/5");
  assert.ok(officer);
  const service = new OfficerProfileService({ db });

  const first = serializeTimelineDraftForSave(baseDraft(), 0);
  assert.equal((await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ timeline: [first] }))).status, 200);

  const second = serializeTimelineDraftForSave(
    baseDraft({
      companyText: "EDITED-COMPANY",
      unit: "EDITED-LEGACY",
      battalionText: "EDITED-SUBDIVISION",
    }),
    0
  );
  assert.equal((await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ timeline: [second] }))).status, 200);

  const row = await new TimelineRepository(db).findByOfficerAndSequence(officer.id, 0);
  assert.ok(row);
  assert.equal(row.companyText, "EDITED-COMPANY");
  assert.equal(row.unit, "EDITED-LEGACY");
  assert.equal(row.battalionText, "EDITED-SUBDIVISION");
  assert.equal(row.headquartersText, "TEST-BUREAU");
  assert.equal(row.regionText, "TEST-DIVISION");
  assert.equal(await new TimelineRepository(db).countForOfficer(officer.id), 1);
});

test("API contract: timeline ordering preserved across save", async () => {
  const db = new InMemoryDatabaseClient();
  await new OfficerRepository(db).upsert(officerInput());
  const officer = await new OfficerRepository(db).findByOfficerId("ภาค1/5");
  assert.ok(officer);
  const service = new OfficerProfileService({ db });

  const rows = [
    serializeTimelineDraftForSave(baseDraft({ year: "2550", yearBE: 2550, unit: "A", companyText: "CA" }), 0),
    serializeTimelineDraftForSave(baseDraft({ year: "2560", yearBE: 2560, unit: "B", companyText: "CB" }), 1),
  ];
  assert.equal((await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ timeline: rows }))).status, 200);

  const repo = new TimelineRepository(db);
  const a = await repo.findByOfficerAndSequence(officer.id, 0);
  const b = await repo.findByOfficerAndSequence(officer.id, 1);
  assert.equal(a?.unit, "A");
  assert.equal(a?.companyText, "CA");
  assert.equal(b?.unit, "B");
  assert.equal(b?.companyText, "CB");
});

test("save serializer source no longer collapses companyText into unit", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const source = await fs.readFile(path.join(process.cwd(), "components/officer/use_officer_workspace.ts"), "utf-8");
  assert.equal(source.includes("resolvedUnitText"), false);
  assert.equal(source.includes("row.companyText || row.battalionText"), false);
  assert.match(source, /serializeTimelineDraftForSave/);
});
