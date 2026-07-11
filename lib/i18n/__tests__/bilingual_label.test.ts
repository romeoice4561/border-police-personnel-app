import { test } from "node:test";
import assert from "node:assert/strict";

import { bilingual, formatBilingual, FIELD_LABELS } from "@/lib/i18n/bilingual_label";

test("bilingual() builds a { th, en } pair", () => {
  assert.deepEqual(bilingual("วันเกิด", "Date of Birth"), { th: "วันเกิด", en: "Date of Birth" });
});

test("formatBilingual renders 'Thai / English'", () => {
  assert.equal(formatBilingual(bilingual("จังหวัดภูมิลำเนา", "Home Province")), "จังหวัดภูมิลำเนา / Home Province");
});

test("FIELD_LABELS spec examples match the phase spec's own worked examples", () => {
  assert.equal(formatBilingual(FIELD_LABELS.dateOfBirth), "วันเกิด / Date of Birth");
  assert.equal(formatBilingual(FIELD_LABELS.homeProvince), "จังหวัดภูมิลำเนา / Home Province");
  assert.equal(formatBilingual(FIELD_LABELS.battalion), "กองกำกับการ / Battalion");
  assert.equal(formatBilingual(FIELD_LABELS.company), "กองร้อย / Company");
  assert.equal(formatBilingual(FIELD_LABELS.bloodGroup), "กรุ๊ปเลือด / Blood Group");
});

test("every FIELD_LABELS entry has non-empty th and en text", () => {
  for (const [key, value] of Object.entries(FIELD_LABELS)) {
    assert.ok(value.th.length > 0, `${key} missing Thai label`);
    assert.ok(value.en.length > 0, `${key} missing English label`);
  }
});
