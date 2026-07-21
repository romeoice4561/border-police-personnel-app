/**
 * Phase 49A.3 closure — locale-aware document-type labels + thumbnail scale.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import "@/lib/document/document_categories"; // ensure e-PF types are registered
import { DOCUMENT_CATEGORIES } from "@/lib/document/document_categories";
import {
  getDocumentTypeLabel,
  isBuiltInDocumentTitle,
  resolveDocumentDisplayTitle,
} from "@/lib/document/document_type_labels";
import { findDocumentType } from "@/lib/document/document_types";
import {
  documentThumbnailContentInsetClass,
  documentThumbnailContentScale,
} from "@/lib/ui/media_tokens";

const ALL_18 = DOCUMENT_CATEGORIES.flatMap((c) => [...c.typeCodes]);

const EXPECTED_TH: Record<string, string> = {
  NATIONAL_ID: "บัตรประจำตัวประชาชน",
  DRIVER_LICENSE: "ใบอนุญาตขับขี่",
  HOUSE_REGISTRATION: "ทะเบียนบ้าน",
  PASSPORT: "หนังสือเดินทาง",
  OFFICER_CARD: "บัตรประจำตัวข้าราชการตำรวจ",
  MILITARY_RECORD: "สมุดประวัติรับราชการ",
  GP7: "ก.พ.7",
  APPOINTMENT_ORDER: "คำสั่งแต่งตั้ง",
  EDUCATION_CERTIFICATE: "วุฒิการศึกษา",
  CERTIFICATE: "หนังสือรับรอง",
  TRAINING_CERTIFICATE: "เอกสารการฝึกอบรม",
  AWARD: "เกียรติบัตรและรางวัล",
  MEDICAL_DOCUMENT: "เอกสารทางการแพทย์",
  SALARY_DOCUMENT: "เอกสารเงินเดือน",
  PENSION_DOCUMENT: "เอกสารบำเหน็จบำนาญ",
  FIREARMS_QUALIFICATION: "ผลทดสอบอาวุธปืน",
  ANNUAL_EVALUATION: "แบบประเมินผลประจำปี",
  OTHER: "เอกสารอื่น ๆ",
};

test("all 18 category document types have TH and EN labels", () => {
  assert.equal(ALL_18.length, 18);
  for (const code of ALL_18) {
    const def = findDocumentType(code);
    assert.ok(def, code);
    assert.ok(def!.labelTh.trim().length > 0, `${code} TH`);
    assert.ok(def!.labelEn.trim().length > 0, `${code} EN`);
    assert.equal(getDocumentTypeLabel(code, "th"), EXPECTED_TH[code], code);
    assert.equal(getDocumentTypeLabel(code, "en"), def!.labelEn, code);
  }
});

test("TH mode never shows Passport / Driver License / House Registration as built-in labels", () => {
  assert.notEqual(getDocumentTypeLabel("PASSPORT", "th"), "Passport");
  assert.notEqual(getDocumentTypeLabel("DRIVER_LICENSE", "th"), "Driver License");
  assert.notEqual(getDocumentTypeLabel("HOUSE_REGISTRATION", "th"), "House Registration");
  assert.equal(getDocumentTypeLabel("PASSPORT", "th"), "หนังสือเดินทาง");
  assert.equal(getDocumentTypeLabel("DRIVER_LICENSE", "th"), "ใบอนุญาตขับขี่");
  assert.equal(getDocumentTypeLabel("HOUSE_REGISTRATION", "th"), "ทะเบียนบ้าน");
});

test("raw enum values are not the visible fallback for registered types", () => {
  for (const code of ALL_18) {
    assert.notEqual(getDocumentTypeLabel(code, "th"), code);
    assert.notEqual(getDocumentTypeLabel(code, "en"), code);
  }
});

test("built-in English stored titles re-localize in TH; custom titles stay", () => {
  assert.equal(isBuiltInDocumentTitle("Passport", "PASSPORT"), true);
  assert.equal(resolveDocumentDisplayTitle("Passport", "PASSPORT", "th"), "หนังสือเดินทาง");
  assert.equal(resolveDocumentDisplayTitle("Driver License", "DRIVER_LICENSE", "th"), "ใบอนุญาตขับขี่");
  assert.equal(resolveDocumentDisplayTitle("House Registration", "HOUSE_REGISTRATION", "th"), "ทะเบียนบ้าน");
  assert.equal(resolveDocumentDisplayTitle("สำเนาหนังสือเดินทางฉบับพิเศษ", "PASSPORT", "th"), "สำเนาหนังสือเดินทางฉบับพิเศษ");
  assert.equal(resolveDocumentDisplayTitle("Passport", "PASSPORT", "en"), "Passport");
});

test("thumbnail tokens keep object-contain with a single minimal inset (96%/92%)", () => {
  assert.equal(documentThumbnailContentScale("md"), 0.96);
  assert.equal(documentThumbnailContentScale("sm"), 0.92);
  assert.equal(documentThumbnailContentInsetClass("md"), "inset-[2%]");
  assert.equal(documentThumbnailContentInsetClass("sm"), "inset-[4%]");

  const thumbSrc = readFileSync(path.join(process.cwd(), "components/ui/media/DocumentThumbnail.tsx"), "utf8");
  assert.match(thumbSrc, /object-contain/);
  assert.match(thumbSrc, /documentThumbnailContentInsetClass/);
  assert.match(thumbSrc, /data-fit="contain"/);
  // Decorative backdrop may use object-cover; foreground document must not.
  assert.doesNotMatch(thumbSrc, /data-fit="contain"[\s\S]{0,120}object-cover/);
  assert.doesNotMatch(thumbSrc, /p-1\.5/);

  const portraitSrc = readFileSync(path.join(process.cwd(), "components/ui/media/PortraitAvatar.tsx"), "utf8");
  assert.match(portraitSrc, /object-cover/);
});

test("Create/Details/Card surfaces call locale-aware helpers (not hardwired labelEn primary)", () => {
  const card = readFileSync(path.join(process.cwd(), "components/officer/epf/epf_document_card.tsx"), "utf8");
  const create = readFileSync(path.join(process.cwd(), "components/officer/epf/epf_create_upload_drawer.tsx"), "utf8");
  const detail = readFileSync(path.join(process.cwd(), "components/officer/epf/epf_detail_drawer.tsx"), "utf8");
  assert.match(card, /resolveDocumentDisplayTitle/);
  assert.match(card, /getDocumentTypeLabel/);
  assert.doesNotMatch(card, /doc\?\.title \|\| labelEn/);
  assert.match(create, /getDocumentTypeLabel/);
  assert.doesNotMatch(create, /labelEn/);
  assert.match(detail, /resolveDocumentDisplayTitle|getDocumentTypeLabel/);
});
