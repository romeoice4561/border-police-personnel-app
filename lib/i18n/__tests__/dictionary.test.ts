import { test } from "node:test";
import assert from "node:assert/strict";

import { DICTIONARY, LANGUAGES, DEFAULT_LANGUAGE, isLanguage, translate, type TranslationKey } from "@/lib/i18n/dictionary";

// Phase 43 — central translation dictionary.

test("DEFAULT_LANGUAGE is Thai and is one of LANGUAGES", () => {
  assert.equal(DEFAULT_LANGUAGE, "th");
  assert.ok((LANGUAGES as readonly string[]).includes(DEFAULT_LANGUAGE));
});

test("isLanguage accepts supported codes, rejects everything else", () => {
  assert.equal(isLanguage("th"), true);
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("zh"), false);
  assert.equal(isLanguage(null), false);
  assert.equal(isLanguage(""), false);
});

test("every dictionary entry has a non-empty string for every supported language", () => {
  for (const [key, entry] of Object.entries(DICTIONARY)) {
    for (const lang of LANGUAGES) {
      assert.ok(typeof entry[lang] === "string" && entry[lang].length > 0, `${key}.${lang} missing`);
    }
  }
});

test("translate resolves the requested language", () => {
  assert.equal(translate("commander.foundOfficers", "th"), "พบกำลังพล");
  assert.equal(translate("commander.foundOfficers", "en"), "Found Officers");
  assert.equal(translate("dashboard.statistics", "en"), "Statistics");
  assert.equal(translate("profile.dateOfBirth", "th"), "วันเกิด");
});

test("translate falls back to the raw key for an unknown key (degrades visibly, never throws)", () => {
  assert.equal(translate("does.not.exist" as TranslationKey, "en"), "does.not.exist");
});

test("the ticket's example keys all exist", () => {
  const required: TranslationKey[] = [
    "profile.personalInformation",
    "profile.dateOfBirth",
    "profile.currentAge",
    "profile.bloodGroup",
    "commander.foundOfficers",
    "dashboard.statistics",
  ];
  for (const key of required) {
    assert.ok(DICTIONARY[key], `missing key ${key}`);
  }
});

// Phase 45.2 — Officer Profile language-consistency + Commander Intelligence copy.

test("Phase 45.2 org hierarchy / timeline keys exist and never fall back to a hardcoded slash-joined string", () => {
  const required: TranslationKey[] = [
    "officer.orgHierarchy.headquarters",
    "officer.orgHierarchy.region",
    "officer.orgHierarchy.battalion",
    "officer.orgHierarchy.company",
    "officer.timeline.appointmentCycle",
    "officer.timeline.positionLevel",
  ];
  for (const key of required) {
    assert.ok(DICTIONARY[key], `missing key ${key}`);
    assert.ok(!translate(key, "th").includes("/"), `${key} TH value should not be a slash-joined bilingual string`);
    assert.ok(!translate(key, "en").includes("/"), `${key} EN value should not be a slash-joined bilingual string`);
  }
});

test("Phase 45.2 Commander Intelligence keys exist for both languages", () => {
  const required: TranslationKey[] = [
    "commander.intelligence.title",
    "commander.intelligence.profileCompletion",
    "commander.intelligence.recommendations",
    "commander.intelligence.noRecommendations",
    "commander.intelligence.completenessSummaryPrefix",
    "commander.intelligence.priorityScoreLabel",
  ];
  for (const key of required) {
    assert.ok(DICTIONARY[key], `missing key ${key}`);
    assert.ok(translate(key, "th").length > 0);
    assert.ok(translate(key, "en").length > 0);
  }
});

test("Thai mode never shows the raw English word 'Commander Intelligence' for the card title", () => {
  assert.notEqual(translate("commander.intelligence.title", "th"), "Commander Intelligence");
  assert.equal(translate("commander.intelligence.title", "th"), "ข้อมูลวิเคราะห์สำหรับผู้บังคับบัญชา");
});

// Phase 49A.2 — Officer Profile / e-PF localization cleanup.

test("built-in document category labels named in the audit are Thai in TH and English in EN", () => {
  const cases: Array<[TranslationKey, string, string]> = [
    ["officer.trainingEditorCourse", "หลักสูตร", "Course"],
    ["epf.completeness.checklist.HOUSE_REGISTRATION", "ทะเบียนบ้าน", "House Registration"],
    ["epf.completeness.checklist.NATIONAL_ID", "บัตรประจำตัวประชาชน", "National ID Card"],
  ];
  for (const [key, th, en] of cases) {
    assert.equal(translate(key, "th"), th, `${key} TH mismatch`);
    assert.equal(translate(key, "en"), en, `${key} EN mismatch`);
  }
});

test("Achievements no longer resolves to 'Coming Soon' or 'No achievements yet.' in either language", () => {
  const heading = [translate("officer.achievements", "th"), translate("officer.achievements", "en")];
  const empty = [translate("officer.achievementsEmpty", "th"), translate("officer.achievementsEmpty", "en")];
  for (const value of [...heading, ...empty]) {
    assert.notEqual(value, "Coming Soon");
    assert.notEqual(value, "No achievements yet.");
  }
  assert.equal(translate("officer.achievements", "th"), "ผลงานและความสำเร็จ");
});

test("e-PF upload-missing-document action prefix + a real checklist label compose into a specific, non-generic Thai title", () => {
  const prefix = translate("epf.action.uploadMissingNamed", "th");
  const documentLabel = translate("epf.completeness.checklist.HOUSE_REGISTRATION", "th");
  const composed = `${prefix}${documentLabel}`;
  assert.equal(composed, "อัปโหลดทะเบียนบ้าน");
  assert.notEqual(composed, translate("epf.action.uploadMissing", "th"), "the named action title must differ from the old generic phrasing");
});

test("new e-PF card keys (expiry date, upload error labels, no-file/no-history reasons) exist for both languages", () => {
  const required: TranslationKey[] = [
    "epf.cardExpiryDate",
    "epf.cardUploadErrorType",
    "epf.cardUploadErrorSize",
    "epf.cardUploadErrorGeneric",
    "epf.cardNoFileYet",
    "epf.cardNoHistoryYet",
    "epf.cardPreviewThumbnail",
    "epf.dashboard.categoriesUsedExplain",
    "epf.hero.completenessExplain",
  ];
  for (const key of required) {
    assert.ok(DICTIONARY[key], `missing key ${key}`);
    assert.ok(translate(key, "th").length > 0);
    assert.ok(translate(key, "en").length > 0);
  }
});
