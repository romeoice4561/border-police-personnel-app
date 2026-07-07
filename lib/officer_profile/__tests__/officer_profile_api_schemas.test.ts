import { test } from "node:test";
import assert from "node:assert/strict";

import {
  officerProfileSaveSchema,
  timelineRowSchema,
  educationRowSchema,
  trainingRowSchema,
} from "@/lib/officer_profile/officer_profile_api_schemas";

test("officerProfileSaveSchema accepts an empty body (every section optional)", () => {
  const result = officerProfileSaveSchema.safeParse({});
  assert.equal(result.success, true);
});

test("officerProfileSaveSchema accepts a profile-only save", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { rank: "ร.ต.ท.", phone: "081-234-5678" },
  });
  assert.equal(result.success, true);
});

test("officerProfileSaveSchema rejects an invalid rank", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { rank: "ผู้กอง" } });
  assert.equal(result.success, false);
});

test("officerProfileSaveSchema rejects an invalid email", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { email: "not-an-email" } });
  assert.equal(result.success, false);
});

test("timelineRowSchema accepts a well-formed row with a valid year/rank/source/verified", () => {
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

test("timelineRowSchema rejects a 2-digit year shorthand", () => {
  const result = timelineRowSchema.safeParse({
    sequence: 0,
    year: "60",
    yearValue: null,
    rank: null,
    position: "ผบ.ร้อย",
    unit: null,
    source: null,
    verified: "ยังไม่ตรวจ",
  });
  assert.equal(result.success, false);
});

test("timelineRowSchema rejects an unrecognized source/verified value", () => {
  const base = { sequence: 0, year: "2560", yearValue: 2560, rank: null, position: "x", unit: null };
  assert.equal(timelineRowSchema.safeParse({ ...base, source: "Carrier Pigeon", verified: "ยังไม่ตรวจ" }).success, false);
  assert.equal(timelineRowSchema.safeParse({ ...base, source: null, verified: "Confirmed" }).success, false);
});

test("educationRowSchema requires institution but allows null year/degree/notes", () => {
  const result = educationRowSchema.safeParse({ year: null, institution: "โรงเรียนนายร้อยตำรวจ", degree: null, notes: null });
  assert.equal(result.success, true);
  assert.equal(educationRowSchema.safeParse({ institution: "" }).success, false);
});

test("trainingRowSchema requires course but allows null year/organization/notes", () => {
  const result = trainingRowSchema.safeParse({ year: "2560", course: "หลักสูตรผู้บังคับหมู่", organization: null, notes: null });
  assert.equal(result.success, true);
  assert.equal(trainingRowSchema.safeParse({ course: "" }).success, false);
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
