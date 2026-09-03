/**
 * Phase 2D.1 — Commander i18n completeness.
 *
 * Structurally ensures every di.command.* key referenced by the Commander
 * UI exists in both TH and EN catalogs, never falls back to the raw key,
 * and that Commander-facing seizure copy does not expose COUNT/MASS jargon.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_i18n_2d1.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DICTIONARY, translate, type TranslationKey } from "@/lib/i18n/dictionary";
import {
  commanderSeizureDisplayUnit,
  formatCommanderDeltaCopy,
  compareCommanderMetric,
} from "@/lib/drug_intelligence/drug_commander_comparison";

const ROOT = process.cwd();
const COMMAND_PAGE = join(ROOT, "app/drug-intelligence/command/page.tsx");
const COMMANDER_UI_DIR = join(ROOT, "components/drug_intelligence");

const KEY_RE = /["'](di\.command\.[A-Za-z0-9]+)["']/g;
const THAI_RE = /[\u0E00-\u0E7F]/;

function extractCommanderKeys(src: string): string[] {
  const keys = new Set<string>();
  for (const match of src.matchAll(KEY_RE)) {
    keys.add(match[1]);
  }
  return [...keys].sort();
}

function commanderUiSources(): Array<{ file: string; src: string }> {
  const files = readdirSync(COMMANDER_UI_DIR)
    .filter((name) => name.startsWith("drug_commander_") && name.endsWith(".tsx"))
    .map((name) => join(COMMANDER_UI_DIR, name));
  return [COMMAND_PAGE, ...files].map((file) => ({
    file,
    src: readFileSync(file, "utf8"),
  }));
}

test("every Commander UI di.command.* key exists in TH and EN and does not fall back to the raw key", () => {
  const sources = commanderUiSources();
  const referenced = new Set<string>();
  for (const { src } of sources) {
    for (const key of extractCommanderKeys(src)) referenced.add(key);
  }

  assert.ok(referenced.size >= 40, `expected a full Commander key set, found ${referenced.size}`);

  for (const key of referenced) {
    const entry = DICTIONARY[key as TranslationKey];
    assert.ok(entry, `missing catalog entry for referenced key ${key}`);
    assert.ok(entry.th.trim().length > 0, `${key} TH is empty`);
    assert.ok(entry.en.trim().length > 0, `${key} EN is empty`);
    assert.notEqual(translate(key as TranslationKey, "th"), key, `${key} TH fell back to the raw key`);
    assert.notEqual(translate(key as TranslationKey, "en"), key, `${key} EN fell back to the raw key`);
    assert.notEqual(entry.th, entry.en, `${key} EN is identical to TH — likely an untranslated fallback`);
    assert.doesNotMatch(entry.en, THAI_RE, `${key} EN contains Thai script`);
    assert.doesNotMatch(entry.th, /^di\.command\./, `${key} TH is still a key`);
    assert.doesNotMatch(entry.en, /^di\.command\./, `${key} EN is still a key`);
  }
});

test("Phase 2D Commander Thai labels match the agreed commander language", () => {
  const expected: Array<[TranslationKey, string]> = [
    ["di.command.situationTitle", "สรุปสถานการณ์"],
    ["di.command.situationNote", "สรุปจากข้อมูลในช่วงเวลาที่เลือก เพื่อช่วยให้เห็นประเด็นสำคัญได้รวดเร็ว"],
    ["di.command.comparisonScope", "เทียบกับช่วงก่อนหน้า"],
    ["di.command.areasFollowTitle", "พื้นที่ที่ควรติดตาม"],
    ["di.command.actionCenterTitle", "รายการที่ควรดำเนินการ"],
    ["di.command.actionCenterNote", "รายการที่ควรตรวจสอบหรือเติมข้อมูลเพื่อให้การวิเคราะห์มีความครบถ้วนยิ่งขึ้น"],
    ["di.command.readinessTitle", "ความพร้อมของข้อมูล"],
    ["di.command.readinessNote", "ตรวจสอบความครบถ้วนของข้อมูลที่ใช้ประกอบการวิเคราะห์"],
    ["di.command.situationOpenCases", "ดูคดี"],
    ["di.command.situationOpenMap", "ดูบนแผนที่"],
    ["di.command.situationOpenSignals", "ตรวจสอบสัญญาณ"],
    ["di.command.situationOpenPersons", "ดูบุคคล"],
    ["di.command.signalStatusNew", "ยังไม่ได้ตรวจสอบ"],
    ["di.command.signalViewDetail", "ดูรายละเอียด"],
    ["di.command.openNetwork", "เปิดผังความเชื่อมโยง"],
    ["di.command.openSearch", "ค้นหาความเชื่อมโยง"],
    ["di.command.actionNewSignals", "สัญญาณใหม่ที่รอตรวจสอบ"],
    ["di.command.actionDuplicates", "ข้อมูลบุคคลซ้ำที่รอตรวจสอบ"],
    ["di.command.actionMissingArrested", "คดีที่ยังไม่มีข้อมูลผู้ถูกจับ/ผู้ต้องหา"],
    ["di.command.actionUnassignedUnit", "คดีที่ยังไม่ระบุหน่วยรายงาน"],
    ["di.command.actionMissingCoords", "คดีที่ยังไม่มีพิกัด"],
    ["di.command.readinessMissingUnit", "ยังไม่ระบุหน่วยรายงาน"],
    ["di.command.readinessMissingCoords", "ยังไม่มีพิกัด"],
    ["di.command.readinessMissingArrested", "ยังไม่มีข้อมูลผู้ถูกจับ/ผู้ต้องหา"],
    ["di.command.readinessIncompleteSeizure", "ประเภทของกลางยังไม่สมบูรณ์"],
    ["di.command.readinessOfPeriod", "ของคดีในช่วงที่เลือก"],
    ["di.command.unitsColMeth", "ยาบ้า (เม็ด)"],
    ["di.command.unitsColCrystal", "ไอซ์ (กก.)"],
  ];

  for (const [key, th] of expected) {
    assert.equal(translate(key, "th"), th, `${key} TH copy drifted`);
    assert.notEqual(translate(key, "en"), key);
    assert.notEqual(translate(key, "en"), th);
  }
});

test("situation summary uses destination-specific action keys, not one generic label", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_situation_section.tsx"), "utf8");
  assert.match(src, /situationOpenCases/);
  assert.match(src, /situationOpenMap/);
  assert.match(src, /situationOpenSignals/);
  assert.match(src, /situationOpenPersons/);
  assert.match(src, /SITUATION_ACTION_KEYS/);
});

test("seizure cards present operational units, not COUNT/MASS jargon", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_seizure_section.tsx"), "utf8");
  assert.match(src, /commanderSeizureDisplayUnit/);
  assert.doesNotMatch(src, /\(\{item\.measurementKind\}\)/);
  assert.doesNotMatch(src, /\(COUNT\)|\(MASS\)/);
  assert.equal(commanderSeizureDisplayUnit("COUNT", "เม็ด", "th"), "เม็ด");
  assert.equal(commanderSeizureDisplayUnit("MASS", null, "th"), "กก.");
  assert.equal(commanderSeizureDisplayUnit("MASS", null, "en"), "kg");
});

test("English comparison copy is usable and still hides a zero-denominator percentage", () => {
  const up = formatCommanderDeltaCopy(compareCommanderMetric(8, 0), "cases", "en");
  assert.match(up.changeText, /up 8 cases from the previous period/);
  assert.equal(up.percentText, "No previous-period data");
  assert.doesNotMatch(up.percentText, /Infinity|NaN|%/);

  const down = formatCommanderDeltaCopy(compareCommanderMetric(5, 7), "คดี", "th");
  assert.match(down.changeText, /ลดลง 2 คดีจากช่วงก่อน/);
  assert.equal(down.percentText, "−28.6%");
});

test("Commander UI sources never interpolate a raw di.command. key as visible text", () => {
  for (const { file, src } of commanderUiSources()) {
    assert.doesNotMatch(
      src,
      />\s*di\.command\.[A-Za-z0-9]+\s*</,
      `${file} contains a literal di.command.* text node`
    );
  }
});
