import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsvDocument, csvCell, CSV_UTF8_BOM, neutralizeCsvFormula } from "@/lib/export/csv";

test("formula-injection prefixes are neutralized", () => {
  const fixtures = ["=CMD|' /C calc'!A0", "+SUM(1,1)", "-10+20", "@SUM(1,1)", "\t=1+1"];
  for (const value of fixtures) {
    const neutralized = neutralizeCsvFormula(value);
    assert.equal(neutralized.startsWith("'"), true, value);
    assert.equal(csvCell(value), `"${neutralized.replace(/"/g, '""')}"`);
  }
});

test("Thai text, emoji, and ordinary numbers are unchanged", () => {
  assert.equal(neutralizeCsvFormula("ภาษาไทย"), "ภาษาไทย");
  assert.equal(neutralizeCsvFormula("ปกติ"), "ปกติ");
  assert.equal(csvCell("ภาษาไทย"), `"ภาษาไทย"`);
  assert.equal(csvCell("hello 👋"), `"hello 👋"`);
  assert.equal(csvCell(123), "123");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(-123), "-123");
});

test("RFC 4180 quotes commas, quotes, and CRLF", () => {
  assert.equal(csvCell("a,b"), `"a,b"`);
  assert.equal(csvCell('say "hi"'), `"say ""hi"""`);
  assert.equal(csvCell("line1\r\nline2"), `"line1\r\nline2"`);
});

test("document has UTF-8 BOM, canonical then localized headers", () => {
  const csv = buildCsvDocument(
    [{ key: "caseNumber", label: "เลขคดี" }],
    [{ caseNumber: "ตชด.1" }]
  );
  assert.equal(csv.startsWith(CSV_UTF8_BOM), true);
  assert.match(csv, /"caseNumber"/);
  assert.match(csv, /"เลขคดี"/);
  assert.match(csv, /"ตชด.1"/);
});
