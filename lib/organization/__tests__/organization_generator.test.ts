import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getBattalionOptions,
  getCompanyOptions,
  getCompanyNumberOptions,
  getCompanyNameOptions,
  getCompanyNameOptionsSpaced,
} from "@/lib/organization/organization_generator";
import { BATTALION_CODES, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

test("getBattalionOptions returns กก.ตชด.NN for every battalion code, in master-data order", () => {
  const options = getBattalionOptions();
  assert.equal(options.length, BATTALION_CODES.length);
  assert.equal(options[0], "กก.ตชด.11");
  assert.equal(options.at(-1), "กก.ตชด.44");
});

test("getCompanyOptions returns ร้อย ตชด.NNN for every company code, in master-data order", () => {
  const options = getCompanyOptions();
  assert.equal(options.length, COMPANY_NUMBER_CODES.length);
  assert.equal(options[0], "ร้อย ตชด.114");
  assert.equal(options.at(-1), "ร้อย ตชด.449");
});

test("getCompanyNumberOptions returns the bare company codes", () => {
  assert.deepEqual(getCompanyNumberOptions(), [...COMPANY_NUMBER_CODES]);
});

test("getCompanyNameOptions concatenates any prefix directly against every company number", () => {
  const options = getCompanyNameOptions("ชปข.");
  assert.equal(options.length, COMPANY_NUMBER_CODES.length);
  assert.equal(options[0], "ชปข.114");
  assert.ok(options.includes("ชปข.415"));
});

test("getCompanyNameOptionsSpaced inserts a space between any prefix and every company number", () => {
  const options = getCompanyNameOptionsSpaced("แผนที่หน่วยข้างเคียง");
  assert.equal(options[0], "แผนที่หน่วยข้างเคียง 114");
  assert.ok(options.includes("แผนที่หน่วยข้างเคียง 415"));
});
