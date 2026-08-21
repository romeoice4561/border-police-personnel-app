import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrugMatchSignals, deriveMatchConfidence, type DrugMatchableIdentity } from "@/lib/drug_intelligence/drug_person_matching";

function identity(overrides: Partial<DrugMatchableIdentity>): DrugMatchableIdentity {
  return {
    identifiers: [],
    primaryFullName: "",
    aliases: [],
    dateOfBirth: null,
    normalizedPhones: [],
    deviceImeis: [],
    vehicleVins: [],
    caseIds: [],
    ...overrides,
  };
}

test("exact Thai ID match produces a STRONG signal and HIGH confidence", () => {
  const a = identity({ identifiers: [{ type: "THAI_ID", value: "1103700123456" }], primaryFullName: "สมชาย ใจดี" });
  const b = identity({ identifiers: [{ type: "THAI_ID", value: "1103700123456" }], primaryFullName: "สมชาย ใจดี สกุลอื่น" });

  const signals = computeDrugMatchSignals(a, b);
  assert.ok(signals.some((s) => s.kind === "IDENTIFIER_THAI_ID" && s.strength === "STRONG"));
  assert.equal(deriveMatchConfidence(signals), "HIGH");
});

test("normalized phone overlap produces a MEDIUM signal, never STRONG on its own", () => {
  const a = identity({ normalizedPhones: ["66812345678"] });
  const b = identity({ normalizedPhones: ["66812345678"] });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "PHONE_NUMBER");
  assert.equal(signals[0].strength, "MEDIUM");
  assert.equal(deriveMatchConfidence(signals), "MEDIUM");
});

test("same IMEI produces a MEDIUM DEVICE_IMEI signal", () => {
  const a = identity({ deviceImeis: ["356789101234567"] });
  const b = identity({ deviceImeis: ["356789101234567", "999999999999999"] });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "DEVICE_IMEI");
  assert.equal(signals[0].matchedValue, "356789101234567");
});

test("name-only match (no identifier/phone/device) is WEAK and yields LOW confidence", () => {
  const a = identity({ primaryFullName: "สมหญิง รักไทย" });
  const b = identity({ primaryFullName: "สมหญิง รักไทย" });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "NAME_EXACT");
  assert.equal(signals[0].strength, "WEAK");
  assert.equal(deriveMatchConfidence(signals), "LOW");
});

test("name comparison is case/whitespace-insensitive but never fuzzy (no partial match)", () => {
  const a = identity({ primaryFullName: "  Somchai   Jaidee " });
  const b = identity({ primaryFullName: "somchai jaidee" });
  const c = identity({ primaryFullName: "Somchai Jaideeextra" });

  assert.equal(computeDrugMatchSignals(a, b).length, 1);
  assert.equal(computeDrugMatchSignals(a, c).length, 0); // no fuzzy/substring matching
});

test("alias match: a's alias matching b's primary name produces ALIAS_MATCH", () => {
  const a = identity({ primaryFullName: "สมชาย ใจดี", aliases: ["ป๊อก"] });
  const b = identity({ primaryFullName: "ป๊อก" });

  const signals = computeDrugMatchSignals(a, b);
  assert.ok(signals.some((s) => s.kind === "ALIAS_MATCH" && s.matchedValue === "ป๊อก"));
});

test("conflicting identifiers of the SAME type but different values never signal a match", () => {
  const a = identity({ identifiers: [{ type: "THAI_ID", value: "1111111111111" }] });
  const b = identity({ identifiers: [{ type: "THAI_ID", value: "2222222222222" }] });

  assert.equal(computeDrugMatchSignals(a, b).length, 0);
});

test("OTHER/UNKNOWN identifier type match is WEAK, not STRONG — never treated as a verified national ID", () => {
  const a = identity({ identifiers: [{ type: "OTHER", value: "some-code" }] });
  const b = identity({ identifiers: [{ type: "OTHER", value: "some-code" }] });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals[0].strength, "WEAK");
  assert.equal(deriveMatchConfidence(signals), "LOW");
});

test("appearing in the same case alone is a WEAK signal — never proof of shared identity", () => {
  const a = identity({ caseIds: ["case-1"] });
  const b = identity({ caseIds: ["case-1", "case-2"] });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "SAME_CASE");
  assert.equal(signals[0].strength, "WEAK");
});

test("date of birth match alone is WEAK", () => {
  const dob = new Date("1990-05-15T00:00:00.000Z");
  const a = identity({ dateOfBirth: dob });
  const b = identity({ dateOfBirth: new Date("1990-05-15T00:00:00.000Z") });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "DATE_OF_BIRTH");
  assert.equal(signals[0].strength, "WEAK");
});

test("multiple simultaneous signals: STRONG identifier + MEDIUM phone + WEAK name still resolves to HIGH (strongest wins)", () => {
  const a = identity({
    identifiers: [{ type: "PASSPORT", value: "AA123456" }],
    normalizedPhones: ["66812345678"],
    primaryFullName: "John Smith",
  });
  const b = identity({
    identifiers: [{ type: "PASSPORT", value: "AA123456" }],
    normalizedPhones: ["66812345678"],
    primaryFullName: "John Smith",
  });

  const signals = computeDrugMatchSignals(a, b);
  assert.equal(signals.length, 3);
  assert.equal(deriveMatchConfidence(signals), "HIGH");
});

test("completely unrelated identities produce zero signals", () => {
  const a = identity({ primaryFullName: "Alice", identifiers: [{ type: "THAI_ID", value: "111" }] });
  const b = identity({ primaryFullName: "Bob", identifiers: [{ type: "THAI_ID", value: "222" }] });

  assert.equal(computeDrugMatchSignals(a, b).length, 0);
  assert.equal(deriveMatchConfidence([]), "LOW");
});
