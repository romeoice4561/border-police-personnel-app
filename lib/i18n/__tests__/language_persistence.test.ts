import { test } from "node:test";
import assert from "node:assert/strict";

import { isLanguage, translate, DEFAULT_LANGUAGE, type Language } from "@/lib/i18n/dictionary";

// Phase 43 — language selection + persistence contract.
//
// The LanguageProvider reads/writes localStorage under the key "bpp.language"
// via useSyncExternalStore. These tests exercise the pure contract that backs
// it (validation + resolution) the same way the provider does, without a DOM:
// a stored value is honored iff it's a valid language, else the default is
// used — which is exactly "refresh preserves the chosen language, and an
// absent/garbage value falls back to Thai".

function resolveStored(raw: string | null): Language {
  return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
}

test("a persisted valid language is restored (refresh preserves EN)", () => {
  assert.equal(resolveStored("en"), "en");
  assert.equal(resolveStored("th"), "th");
});

test("absent or invalid persisted value falls back to the default (Thai)", () => {
  assert.equal(resolveStored(null), "th");
  assert.equal(resolveStored(""), "th");
  assert.equal(resolveStored("fr"), "th");
  assert.equal(resolveStored("garbage"), "th");
});

test("switching language changes what every keyed string resolves to (instant switch)", () => {
  // Simulate the provider handing the active language to t().
  const th = (key: Parameters<typeof translate>[0]) => translate(key, "th");
  const en = (key: Parameters<typeof translate>[0]) => translate(key, "en");
  assert.notEqual(th("commander.foundOfficers"), en("commander.foundOfficers"));
  assert.equal(en("commander.foundOfficers"), "Found Officers");
  assert.equal(th("commander.foundOfficers"), "พบกำลังพล");
});
