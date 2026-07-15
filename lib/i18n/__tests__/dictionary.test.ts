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
