import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDrugSearchQuery } from "@/lib/drug_intelligence/search_query_classifier";

test("empty/whitespace query classifies as GENERAL_TEXT", () => {
  assert.equal(classifyDrugSearchQuery(""), "GENERAL_TEXT");
  assert.equal(classifyDrugSearchQuery("   "), "GENERAL_TEXT");
});

test("10-digit Thai mobile number classifies as PHONE", () => {
  assert.equal(classifyDrugSearchQuery("0812345678"), "PHONE");
  assert.equal(classifyDrugSearchQuery("081-234-5678"), "PHONE");
});

test("66-prefixed 11-digit number classifies as PHONE", () => {
  assert.equal(classifyDrugSearchQuery("66812345678"), "PHONE");
  assert.equal(classifyDrugSearchQuery("+66812345678"), "PHONE");
});

test("13-digit Thai national ID classifies as IDENTIFIER", () => {
  assert.equal(classifyDrugSearchQuery("1103700123456"), "IDENTIFIER");
  assert.equal(classifyDrugSearchQuery("1-1037-00123-45-6"), "IDENTIFIER");
});

test("15-digit numeric string classifies as IMEI", () => {
  assert.equal(classifyDrugSearchQuery("353918123456789"), "IMEI");
});

test("16-digit numeric string (IMEISV) classifies as IMEI", () => {
  assert.equal(classifyDrugSearchQuery("3539181234567890"), "IMEI");
});

test("IMEI with spaces still classifies as IMEI", () => {
  assert.equal(classifyDrugSearchQuery("353918 123456 789"), "IMEI");
});

test("case-number-shaped query classifies as CASE_NUMBER", () => {
  assert.equal(classifyDrugSearchQuery("DRUG-2569-00125"), "CASE_NUMBER");
  assert.equal(classifyDrugSearchQuery("ตชด.44-2569-001"), "CASE_NUMBER");
});

test("Thai vehicle plate (letters + digits) classifies as VEHICLE_REGISTRATION", () => {
  assert.equal(classifyDrugSearchQuery("กข1234"), "VEHICLE_REGISTRATION");
  assert.equal(classifyDrugSearchQuery("1กข2345"), "VEHICLE_REGISTRATION");
});

test("pure Thai name with no digits classifies as PERSON_NAME", () => {
  assert.equal(classifyDrugSearchQuery("สมชาย"), "PERSON_NAME");
  assert.equal(classifyDrugSearchQuery("สมชาย ใจดี"), "PERSON_NAME");
});

test("pure Latin name with no digits classifies as PERSON_NAME", () => {
  assert.equal(classifyDrugSearchQuery("John Smith"), "PERSON_NAME");
});

test("classification never throws on unusual input", () => {
  assert.doesNotThrow(() => classifyDrugSearchQuery("!@#$%^&*()"));
  assert.doesNotThrow(() => classifyDrugSearchQuery("12"));
});
