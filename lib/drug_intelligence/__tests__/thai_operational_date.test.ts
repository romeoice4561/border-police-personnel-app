/**
 * Thai operational date presentation contracts (weekday + DATE-only safety).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatDiDate,
  formatDiDateTime,
  formatThaiCompactDate,
  formatThaiCompactDateTime,
  formatThaiOperationalDate,
  formatThaiOperationalDateTime,
  formatThaiOperationalDateWithPlace,
  formatThaiOperationalDateWithClock,
  formatThaiClockLabel,
  formatThaiOperationalTime,
  resolveThaiCalendarParts,
} from "@/lib/drug_intelligence/di_date_helpers";

const ROOT = process.cwd();

test("2026-08-10 → วันจันทร์ที่ 10 ส.ค. 69", () => {
  assert.equal(formatThaiOperationalDate("2026-08-10"), "วันจันทร์ที่ 10 ส.ค. 69");
  assert.equal(formatDiDate("2026-08-10"), "วันจันทร์ที่ 10 ส.ค. 69");
});

test("2026-08-01 → วันเสาร์ที่ 1 ส.ค. 69", () => {
  assert.equal(formatThaiOperationalDate("2026-08-01"), "วันเสาร์ที่ 1 ส.ค. 69");
});

test("Sunday and leap day weekday labels", () => {
  assert.equal(formatThaiOperationalDate("2026-08-09"), "วันอาทิตย์ที่ 9 ส.ค. 69");
  assert.equal(formatThaiOperationalDate("2024-02-29"), "วันพฤหัสบดีที่ 29 ก.พ. 67");
});

test("Dec → Jan Buddhist year rollover uses short BE", () => {
  assert.equal(formatThaiOperationalDate("2025-12-31"), "วันพุธที่ 31 ธ.ค. 68");
  assert.equal(formatThaiOperationalDate("2026-01-01"), "วันพฤหัสบดีที่ 1 ม.ค. 69");
});

test("DATE-only timezone safety: calendar day never shifts", () => {
  assert.equal(formatThaiOperationalDate("2026-08-10"), "วันจันทร์ที่ 10 ส.ค. 69");
  assert.equal(formatThaiOperationalDate("2026-08-10T00:00:00.000Z"), "วันจันทร์ที่ 10 ส.ค. 69");
  const parts = resolveThaiCalendarParts("2026-08-10");
  assert.equal(parts?.hasClockTime, false);
  assert.equal(formatThaiOperationalDateTime("2026-08-10"), "วันจันทร์ที่ 10 ส.ค. 69");
  assert.equal(formatThaiOperationalTime("2026-08-10"), null);
});

test("Bangkok datetime around midnight keeps Bangkok calendar day", () => {
  // 2026-08-10 00:30 Bangkok = 2026-08-09 17:30 UTC
  const rendered = formatThaiOperationalDateTime("2026-08-09T17:30:00.000Z");
  assert.equal(rendered, "วันจันทร์ที่ 10 ส.ค. 69 เวลา 00:30 น.");
});

test("missing time does NOT become 00:00", () => {
  assert.equal(formatThaiOperationalDateTime("2026-08-10"), "วันจันทร์ที่ 10 ส.ค. 69");
  assert.doesNotMatch(formatThaiOperationalDateTime("2026-08-10"), /00:00/);
  assert.equal(formatThaiOperationalDateTime("2026-08-10T21:35:00+07:00"), "วันจันทร์ที่ 10 ส.ค. 69 เวลา 21:35 น.");
});

test("separate arrestTime HH:MM pairs without inventing midnight", () => {
  assert.equal(
    formatThaiOperationalDateWithClock("2026-08-01", "21:35"),
    "วันเสาร์ที่ 1 ส.ค. 69 เวลา 21:35 น.",
  );
  assert.equal(formatThaiOperationalDateWithClock("2026-08-01", null), "วันเสาร์ที่ 1 ส.ค. 69");
  assert.equal(formatThaiOperationalDateWithClock("2026-08-01", ""), "วันเสาร์ที่ 1 ส.ค. 69");
  assert.equal(formatThaiClockLabel("21:35"), "21:35 น.");
  assert.equal(formatThaiClockLabel(null), null);
});

test("compact weekday format", () => {
  assert.equal(formatThaiCompactDate("2026-08-10"), "จ. 10 ส.ค. 69");
  assert.equal(formatThaiCompactDate("2026-08-01"), "ส. 1 ส.ค. 69");
  assert.equal(formatThaiCompactDateTime("2026-08-10T14:30:00+07:00"), "จ. 10 ส.ค. 69 · 14:30 น.");
  assert.equal(formatDiDateTime("2026-08-10T14:30:00+07:00"), "จ. 10 ส.ค. 69 · 14:30 น.");
});

test("location pairing helper", () => {
  assert.equal(
    formatThaiOperationalDateWithPlace("2026-08-10", "สุราษฎร์ธานี"),
    "วันจันทร์ที่ 10 ส.ค. 69 · สุราษฎร์ธานี",
  );
});

test("invalid / missing → ไม่มีข้อมูล", () => {
  assert.equal(formatThaiOperationalDate(null), "ไม่มีข้อมูล");
  assert.equal(formatThaiOperationalDate("not-a-date"), "ไม่มีข้อมูล");
});

test("Person case cards and Case identity use canonical operational formatter", () => {
  const identity = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_identity_header.tsx"), "utf8");
  const listCard = readFileSync(join(ROOT, "components/drug_intelligence/drug_case_list_card.tsx"), "utf8");
  const caseHeader = readFileSync(join(ROOT, "components/drug_intelligence/drug_case_identity_header.tsx"), "utf8");
  const personPage = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(identity, /formatThaiOperationalDate|formatDiDate/);
  assert.doesNotMatch(identity, /toLocaleDateString/);
  assert.match(listCard, /formatThaiOperationalDate|formatThaiCompactDate|formatDiDate/);
  assert.doesNotMatch(listCard, /toGregorianDateInputValue\(row\.arrestDate\)/);
  assert.match(caseHeader, /formatThaiOperationalDateWithClock|formatThaiOperationalDate|formatDiDate/);
  assert.doesNotMatch(caseHeader, /toGregorianDateInputValue\(arrestDate\)/);
  assert.match(personPage, /formatDiDate|formatThaiOperationalDate/);
  assert.match(personPage, /formatThaiOperationalDateWithPlace/);
});
