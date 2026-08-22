import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeImeiMatchingKey, normalizeSerialMatchingKey } from "@/lib/drug_intelligence/imei_matching_key";
import { normalizeVehicleRegistrationMatchingKey, normalizeVinMatchingKey } from "@/lib/drug_intelligence/vehicle_matching_key";

test("normalizeImeiMatchingKey strips all non-digit separators", () => {
  assert.equal(normalizeImeiMatchingKey("353918123456789"), "353918123456789");
  assert.equal(normalizeImeiMatchingKey("353918 123456 789"), "353918123456789");
  assert.equal(normalizeImeiMatchingKey("353918-123456-789"), "353918123456789");
});

test("normalizeSerialMatchingKey uppercases and strips whitespace/dashes", () => {
  assert.equal(normalizeSerialMatchingKey("abc-123 def"), "ABC123DEF");
});

test("normalizeVehicleRegistrationMatchingKey strips whitespace/dashes, preserves Thai letters as typed", () => {
  assert.equal(normalizeVehicleRegistrationMatchingKey("กข 1234"), "กข1234");
  assert.equal(normalizeVehicleRegistrationMatchingKey("กข-1234"), "กข1234");
  assert.equal(normalizeVehicleRegistrationMatchingKey("กข1234"), "กข1234");
});

test("normalizeVinMatchingKey uppercases and strips whitespace/dashes", () => {
  assert.equal(normalizeVinMatchingKey("1hgcm826-54a 004352"), "1HGCM82654A004352");
});
