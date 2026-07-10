/**
 * Officer Profile save-schema tests (Phase 23A; Phase 23B relaxed validation).
 *
 * Phase 23B: the schema must accept the real, messy OCR-imported data (empty
 * rank/name, year ranges/Thai dates, ranks outside the standard list) so the
 * import-damaged records that most need human editing can actually be saved —
 * while still enforcing STRUCTURE (required identifying fields present, bounded
 * length, valid email when supplied).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  officerProfileSaveSchema,
  timelineRowSchema,
  educationRowSchema,
  trainingRowSchema,
} from "@/lib/officer_profile/officer_profile_api_schemas";

test("officerProfileSaveSchema accepts an empty body (every section optional)", () => {
  assert.equal(officerProfileSaveSchema.safeParse({}).success, true);
});

test("officerProfileSaveSchema accepts a profile-only save", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { rank: "ร.ต.ท.", phone: "081-234-5678" } });
  assert.equal(result.success, true);
});

test("Phase 23B: an import-damaged profile (empty rank/first/last) is now ACCEPTED so it can be edited/saved", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { rank: "", firstName: "", lastName: "" } });
  assert.equal(result.success, true);
});

test("Phase 23B: a rank outside the standard list (e.g. imported 'ร.ท.') is now ACCEPTED", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { rank: "ร.ท." } });
  assert.equal(result.success, true);
});

test("officerProfileSaveSchema rejects an invalid email (when a non-empty value is supplied)", () => {
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { email: "not-an-email" } }).success, false);
});

test("officerProfileSaveSchema treats a blank email as unset (null), not an error", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { email: "" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.email, null);
});

test("officerProfileSaveSchema rejects an oversized field (length guard still enforced)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { rank: "ก".repeat(600) } });
  assert.equal(result.success, false);
});

test("timelineRowSchema accepts a well-formed dropdown-entered row", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0,
    year: "2560",
    yearValue: 2560,
    rank: "ร.ต.ท.",
    position: "ผบ.ร้อย",
    unit: "ตชด.447",
    source: "เจ้าหน้าที่กรอก",
    verified: "ตรวจแล้ว",
  });
  assert.equal(result.success, true);
});

test("Phase 23B: a timeline row with an imported year RANGE ('2567-ปัจจุบัน') is now ACCEPTED", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0,
    year: "2567-ปัจจุบัน",
    yearValue: null,
    rank: null,
    position: "ผบ.มว.",
    unit: null,
    source: null,
    verified: "ยังไม่ตรวจ",
  });
  assert.equal(result.success, true);
});

test("Phase 23B: a timeline row with a full Thai date ('1 ก.พ. 2532') is now ACCEPTED", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0,
    year: "1 ก.พ. 2532",
    yearValue: 2532,
    rank: null,
    position: "รอง สว.",
    unit: null,
    source: null,
    verified: "ยังไม่ตรวจ",
  });
  assert.equal(result.success, true);
});

test("timelineRowSchema still requires year and position to be non-empty (structure guard)", () => {
  const base = { sequence: 0, yearValue: null, rank: null, unit: null, source: null, verified: "ยังไม่ตรวจ" };
  assert.equal(timelineRowSchema.safeParse({ ...base, year: "", position: "x" }).success, false);
  assert.equal(timelineRowSchema.safeParse({ ...base, year: "2560", position: "" }).success, false);
});

test("timelineRowSchema normalizes blank unit/source to null", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: "", source: "", verified: "ยังไม่ตรวจ",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.unit, null);
    assert.equal(result.data.source, null);
  }
});

test("educationRowSchema requires institution; blank year/degree/notes normalize to null", () => {
  const result = educationRowSchema.safeParse({ year: "", institution: "โรงเรียนนายร้อยตำรวจ", degree: "", notes: "" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.year, null);
    assert.equal(result.data.degree, null);
  }
  assert.equal(educationRowSchema.safeParse({ year: null, institution: "", degree: null, notes: null }).success, false);
});

test("trainingRowSchema requires course; blank year/organization/notes normalize to null", () => {
  const result = trainingRowSchema.safeParse({ year: "2560", course: "หลักสูตรผู้บังคับหมู่", organization: "", notes: "" });
  assert.equal(result.success, true);
  assert.equal(trainingRowSchema.safeParse({ year: null, course: "", organization: null, notes: null }).success, false);
});

// ── Phase 26B Part 3: structured date model ──────────────────────────────────

test("timelineRowSchema accepts a row with structured day/month/yearBE and derives effectiveDate server-side", () => {
  const base = { sequence: 0, year: "1 มิถุนายน 2560", yearValue: 2560, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse({ ...base, day: 1, month: 6, yearBE: 2560 });
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.data.effectiveDate);
    assert.equal(result.data.effectiveDate!.getUTCFullYear(), 2017);
    assert.equal(result.data.effectiveDate!.getUTCMonth(), 5);
    assert.equal(result.data.effectiveDate!.getUTCDate(), 1);
  }
});

test("timelineRowSchema derives effectiveDate from yearBE alone, defaulting month/day to Jan 1", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse({ ...base, yearBE: 2560 });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.effectiveDate!.getUTCMonth(), 0);
    assert.equal(result.data.effectiveDate!.getUTCDate(), 1);
  }
});

test("timelineRowSchema leaves effectiveDate null when day/month/yearBE are all omitted (row not yet migrated)", () => {
  const base = { sequence: 0, year: "2567-ปัจจุบัน", yearValue: null, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse(base);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.effectiveDate, null);
});

test("timelineRowSchema rejects an out-of-range day/month/yearBE rather than silently truncating", () => {
  const base = { sequence: 0, year: "x", yearValue: null, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  assert.equal(timelineRowSchema.safeParse({ ...base, day: 32 }).success, false);
  assert.equal(timelineRowSchema.safeParse({ ...base, month: 13 }).success, false);
  assert.equal(timelineRowSchema.safeParse({ ...base, yearBE: 1000 }).success, false);
});

test("timelineRowSchema accepts isPresent alongside a known start date", () => {
  const base = { sequence: 0, year: "2560-ปัจจุบัน", yearValue: null, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse({ ...base, yearBE: 2560, isPresent: true });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.isPresent, true);
});

test("officerProfileSaveSchema validates full timeline/education/training arrays together", () => {
  const result = officerProfileSaveSchema.safeParse({
    timeline: [
      { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "ผบ.ร้อย", unit: null, source: null, verified: "ยังไม่ตรวจ" },
    ],
    education: [{ year: null, institution: "รร.นายร้อยตำรวจ", degree: null, notes: null }],
    training: [{ year: null, course: "หลักสูตร A", organization: null, notes: null }],
  });
  assert.equal(result.success, true);
});

// ── Phase 26B Part C: structured org hierarchy ───────────────────────────────

test("timelineRowSchema accepts a row with structured org hierarchy ids", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: "ตชด.434", source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse({ ...base, headquartersId: 1, regionId: 10, battalionId: 100, companyId: 1000 });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.headquartersId, 1);
    assert.equal(result.data.regionId, 10);
    assert.equal(result.data.battalionId, 100);
    assert.equal(result.data.companyId, 1000);
  }
});

test("timelineRowSchema leaves org hierarchy ids null when omitted (row not yet migrated to the structured picker)", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: "หน่วยเดิม", source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse(base);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.headquartersId, undefined);
    assert.equal(result.data.regionId, undefined);
    assert.equal(result.data.battalionId, undefined);
    assert.equal(result.data.companyId, undefined);
  }
});

test("timelineRowSchema rejects a non-positive org hierarchy id rather than silently accepting garbage", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  assert.equal(timelineRowSchema.safeParse({ ...base, companyId: 0 }).success, false);
  assert.equal(timelineRowSchema.safeParse({ ...base, companyId: -1 }).success, false);
});

test("timelineRowSchema accepts explicit null org hierarchy ids (unlinking)", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: null, source: null, verified: "ยังไม่ตรวจ" };
  const result = timelineRowSchema.safeParse({ ...base, headquartersId: null, regionId: null, battalionId: null, companyId: null });
  assert.equal(result.success, true);
});
