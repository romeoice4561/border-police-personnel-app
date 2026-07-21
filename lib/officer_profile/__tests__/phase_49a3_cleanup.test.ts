/**
 * Phase 49A.3 — Gallery search contract + timeline order/work-line persistence.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assetMatchesSearch,
  isNumericOrgCodeQuery,
  textHasStandaloneNumericToken,
} from "@/lib/gallery/asset_search";
import { timelineSourceDisplay } from "@/components/officer/career_timeline_section";
import {
  serializeTimelineDraftForSave,
  type TimelineOrgPersistenceDraft,
} from "@/lib/officer_profile/timeline_org_persistence";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { TimelineRepository } from "@/lib/database/repositories/timeline_repository";
import { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";
import { handleOfficerProfileSave } from "@/lib/officer_profile/officer_profile_api_handlers";
import { localizedReadinessLabel, localizedPrimaryActionLabel } from "@/lib/integration/documents/localize_document_intelligence";

test("gallery: 414 matches ร้อย ตชด.414 and standalone path token", () => {
  assert.equal(assetMatchesSearch({ company: "ร้อย ตชด.414" }, "414"), true);
  assert.equal(assetMatchesSearch({ relativePath: "maps/414/file.jpg" }, "414"), true);
  assert.equal(assetMatchesSearch({ folderName: "กองร้อย 414" }, "414"), true);
  assert.equal(assetMatchesSearch({ unitNumber: "414" }, "414"), true);
});

test("gallery: 414 does not match 41, 4140, or 1414", () => {
  assert.equal(assetMatchesSearch({ company: "ร้อย ตชด.41" }, "414"), false);
  assert.equal(assetMatchesSearch({ company: "ร้อย ตชด.4140" }, "414"), false);
  assert.equal(assetMatchesSearch({ company: "ร้อย ตชด.1414" }, "414"), false);
  assert.equal(textHasStandaloneNumericToken("4140", "414"), false);
  assert.equal(isNumericOrgCodeQuery("414"), true);
  assert.equal(isNumericOrgCodeQuery("ภาค 4"), false);
});

test("gallery: Thai/English text search is case-insensitive and whitespace-normalized", () => {
  assert.equal(assetMatchesSearch({ description: "แผนที่ ตั้งกองร้อย" }, "  แผนที่  "), true);
  assert.equal(assetMatchesSearch({ remarks: "Neighbor Map" }, "neighbor"), true);
});

test("gallery: empty query matches everything (unfiltered)", () => {
  assert.equal(assetMatchesSearch({ company: "x" }, ""), true);
  assert.equal(assetMatchesSearch({ company: "x" }, "   "), true);
});

test("timelineSourceDisplay prefers appointmentOrder over source", () => {
  assert.equal(timelineSourceDisplay("ตร.507/51 ลง 31 ก.ค.51", "เจ้าตัวกรอก", "ไม่ระบุ"), "ตร.507/51 ลง 31 ก.ค.51");
  assert.equal(timelineSourceDisplay("", "เจ้าตัวกรอก", "ไม่ระบุ"), "เจ้าตัวกรอก");
  assert.equal(timelineSourceDisplay(null, null, "ไม่ระบุ"), "ไม่ระบุ");
});

function baseDraft(ov: Partial<TimelineOrgPersistenceDraft> = {}): TimelineOrgPersistenceDraft {
  return {
    year: "2560",
    rank: "ร.ต.ท.",
    position: "ผบ.ร้อย",
    positionLevel: "Unknown",
    unit: "ตชด.414",
    source: "เจ้าตัวกรอก",
    verified: "ยังไม่ตรวจ",
    day: null,
    month: null,
    yearBE: 2560,
    appointmentCycle: 2560,
    isPresent: false,
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    appointmentOrder: "ตร.507/51 ลง 31 ก.ค.51",
    workLine: "งานสอบสวน",
    verificationStatus: "",
    verifiedBy: "",
    verifiedDate: "",
    verificationRemark: "",
    ...ov,
  };
}

test("serializeTimelineDraftForSave persists appointmentOrder and workLine independently of source", () => {
  const payload = serializeTimelineDraftForSave(baseDraft(), 0);
  assert.equal(payload.appointmentOrder, "ตร.507/51 ลง 31 ก.ค.51");
  assert.equal(payload.workLine, "งานสอบสวน");
  assert.equal(payload.source, "เจ้าตัวกรอก");
});

test("serializeTimelineDraftForSave: custom workLine and blank order", () => {
  const payload = serializeTimelineDraftForSave(
    baseDraft({ appointmentOrder: "", workLine: "งานพิเศษเฉพาะกิจ" }),
    0
  );
  assert.equal(payload.appointmentOrder, null);
  assert.equal(payload.workLine, "งานพิเศษเฉพาะกิจ");
});

function officerInput(): OfficerInput {
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
  };
}

test("API round-trip: appointmentOrder + workLine persist and reload exactly", async () => {
  const db = new InMemoryDatabaseClient();
  await new OfficerRepository(db).upsert(officerInput());
  const officer = await new OfficerRepository(db).findByOfficerId("ภาค1/5");
  assert.ok(officer);
  const service = new OfficerProfileService({ db });
  const body = { timeline: [serializeTimelineDraftForSave(baseDraft(), 0)] };
  const res = await handleOfficerProfileSave(
    service,
    "ภาค1/5",
    new Request("http://localhost/api/officers/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  assert.equal(res.status, 200);
  const row = await new TimelineRepository(db).findByOfficerAndSequence(officer.id, 0);
  assert.ok(row);
  assert.equal(row.appointmentOrder, "ตร.507/51 ลง 31 ก.ค.51");
  assert.equal(row.workLine, "งานสอบสวน");
  assert.equal(row.source, "เจ้าตัวกรอก");

  // Second save with custom workLine
  const body2 = {
    timeline: [serializeTimelineDraftForSave(baseDraft({ workLine: "งานพิเศษ", appointmentOrder: "บช.น.211/55 ลง 25 พ.ค.55" }), 0)],
  };
  assert.equal(
    (
      await handleOfficerProfileSave(
        service,
        "ภาค1/5",
        new Request("http://localhost/api/officers/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body2),
        })
      )
    ).status,
    200
  );
  const row2 = await new TimelineRepository(db).findByOfficerAndSequence(officer.id, 0);
  assert.equal(row2?.appointmentOrder, "บช.น.211/55 ลง 25 พ.ค.55");
  assert.equal(row2?.workLine, "งานพิเศษ");
});

test("Document Readiness labels follow language", () => {
  assert.equal(localizedReadinessLabel("INCOMPLETE", "th"), "เอกสารไม่ครบ");
  assert.equal(localizedReadinessLabel("INCOMPLETE", "en"), "Documents Incomplete");
  assert.equal(
    localizedPrimaryActionLabel({ primaryAction: "UPLOAD_MISSING", missingRequiredDocuments: ["HOUSE_REGISTRATION", "GP7"] }, "en"),
    "Upload missing documents"
  );
  assert.match(
    localizedPrimaryActionLabel({ primaryAction: "UPLOAD_MISSING", missingRequiredDocuments: ["HOUSE_REGISTRATION"] }, "th"),
    /อัปโหลด/
  );
});

test("e-PF empty slot must open Create mode (not details-only)", async () => {
  const { resolveEpfDrawerMode } = await import("@/lib/document/epf_create_upload");
  assert.equal(resolveEpfDrawerMode(false, "details"), "create");
  assert.equal(resolveEpfDrawerMode(false, "create"), "create");
});
