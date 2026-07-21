import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateThaiNationalId,
  validateIsoDate,
  validateExpiryAfterIssue,
  validateDatePlausibility,
  validateRequired,
  validatePassportNumberPattern,
  validateDriverLicenseNumberPattern,
  mergeValidationResults,
} from "@/lib/extraction/field_validation";

// A real, checksum-valid Thai national ID computed via the standard mod-11
// algorithm (first12 = "110120025489", check digit = 6).
const VALID_THAI_ID = "1101200254896";

test("validateThaiNationalId: accepts a real checksum-valid ID", () => {
  const result = validateThaiNationalId(VALID_THAI_ID);
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings, []);
});

test("validateThaiNationalId: rejects a wrong check digit", () => {
  const tampered = VALID_THAI_ID.slice(0, 12) + "0"; // wrong check digit
  const result = validateThaiNationalId(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.warnings[0].includes("Checksum"));
});

test("validateThaiNationalId: accepts a formatted ID with separators", () => {
  const formatted = "1-1012-00254-89-6";
  assert.equal(validateThaiNationalId(formatted).valid, true);
});

test("validateThaiNationalId: rejects wrong digit count", () => {
  const result = validateThaiNationalId("123456789");
  assert.equal(result.valid, false);
  assert.ok(result.warnings[0].includes("13 digits"));
});

test("validateIsoDate: accepts a real calendar date", () => {
  assert.equal(validateIsoDate("2026-07-20").valid, true);
});

test("validateIsoDate: rejects Feb 30 (not a real date)", () => {
  const result = validateIsoDate("2026-02-30");
  assert.equal(result.valid, false);
});

test("validateIsoDate: rejects a malformed string", () => {
  assert.equal(validateIsoDate("20/07/2026").valid, false);
});

test("validateExpiryAfterIssue: passes when expiry is after issue", () => {
  assert.equal(validateExpiryAfterIssue("2020-01-01", "2030-01-01").valid, true);
});

test("validateExpiryAfterIssue: fails when expiry is before issue", () => {
  const result = validateExpiryAfterIssue("2030-01-01", "2020-01-01");
  assert.equal(result.valid, false);
  assert.ok(result.warnings[0].includes("must be after"));
});

test("validateExpiryAfterIssue: fails when expiry equals issue (must be strictly after)", () => {
  const result = validateExpiryAfterIssue("2025-01-01", "2025-01-01");
  assert.equal(result.valid, false);
});

test("validateExpiryAfterIssue: passes (no-op) when either date is missing", () => {
  assert.equal(validateExpiryAfterIssue(null, "2030-01-01").valid, true);
  assert.equal(validateExpiryAfterIssue("2020-01-01", null).valid, true);
});

test("validateDatePlausibility: flags a date implausibly far in the future", () => {
  const result = validateDatePlausibility("2100-01-01", { maxFutureYears: 20 }, new Date("2026-01-01"));
  assert.equal(result.valid, false);
});

test("validateDatePlausibility: accepts a date within the plausible window", () => {
  const result = validateDatePlausibility("2030-01-01", { maxFutureYears: 20 }, new Date("2026-01-01"));
  assert.equal(result.valid, true);
});

test("validateRequired: fails on null", () => {
  assert.equal(validateRequired(null, "Name").valid, false);
});

test("validateRequired: fails on whitespace-only", () => {
  assert.equal(validateRequired("   ", "Name").valid, false);
});

test("validateRequired: passes on a real value", () => {
  assert.equal(validateRequired("สมชาย", "Name").valid, true);
});

test("validatePassportNumberPattern: accepts a plausible passport number", () => {
  assert.equal(validatePassportNumberPattern("AA1234567").valid, true);
});

test("validatePassportNumberPattern: rejects an implausible string", () => {
  assert.equal(validatePassportNumberPattern("not-a-passport").valid, false);
});

test("validateDriverLicenseNumberPattern: accepts a plausible license number", () => {
  assert.equal(validateDriverLicenseNumberPattern("12345678").valid, true);
});

test("validateDriverLicenseNumberPattern: rejects too few digits", () => {
  assert.equal(validateDriverLicenseNumberPattern("123").valid, false);
});

test("mergeValidationResults: invalid if any constituent result is invalid", () => {
  const merged = mergeValidationResults({ valid: true, warnings: [] }, { valid: false, warnings: ["bad"] });
  assert.equal(merged.valid, false);
  assert.deepEqual(merged.warnings, ["bad"]);
});

test("mergeValidationResults: valid when all constituent results are valid", () => {
  const merged = mergeValidationResults({ valid: true, warnings: [] }, { valid: true, warnings: [] });
  assert.equal(merged.valid, true);
});
