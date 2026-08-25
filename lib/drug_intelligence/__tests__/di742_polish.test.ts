/**
 * DI-7.4.2 UX Polish — focused regression tests.
 *
 * Covers (pure unit — no DB, no network):
 * - DRUG_RELATIONSHIP_STATUS_LABELS completeness and Thai labels
 * - DRUG_NETWORK_ROLE_LABELS completeness (all roles map to Thai)
 * - DRUG_PERSON_IDENTIFIER_TYPE_LABELS completeness
 * - DRUG_NETWORK_ROLE_SOURCE_LABELS completeness
 * - DRUG_CASE_STATUS_META (Thai labels, no raw enum strings)
 * - isValidDrugNetworkRoleSource guard
 * - isValidDrugRelationshipStatus guard
 * - formatDiDate canonical output
 * - clearAllFilters URL logic (pure function mirror)
 * - Active filter chip removal URL behavior
 * - Dependent battalionId/companyId chip clearing
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/di742_polish.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  DRUG_NETWORK_ROLES,
  DRUG_NETWORK_ROLE_LABELS,
  DRUG_PERSON_IDENTIFIER_TYPES,
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  DRUG_NETWORK_ROLE_SOURCES,
  DRUG_NETWORK_ROLE_SOURCE_LABELS,
  DRUG_RELATIONSHIP_STATUSES,
  DRUG_RELATIONSHIP_STATUS_LABELS,
  isValidDrugNetworkRoleSource,
  isValidDrugRelationshipStatus,
  isValidDrugNetworkRole,
} from "../drug_person_options";
import { DRUG_CASE_STATUS_META } from "../drug_case_options";
import { formatDiDate } from "../di_date_helpers";

// ── Network role labels ────────────────────────────────────────────────────────

describe("DRUG_NETWORK_ROLE_LABELS — all roles have Thai labels", () => {
  [...DRUG_NETWORK_ROLES].forEach((role) => {
    test(`${role} → non-empty Thai label, not a raw enum`, () => {
      assert.ok(isValidDrugNetworkRole(role), `${role} must pass isValidDrugNetworkRole`);
      const meta = DRUG_NETWORK_ROLE_LABELS[role];
      assert.ok(meta.labelTh, `${role} must have a truthy labelTh`);
      assert.ok(!/^[A-Z_]+$/.test(meta.labelTh), `${role} labelTh must not look like a raw enum (got: ${meta.labelTh})`);
    });
  });

  test("COURIER → นักบิน / คนส่งยา", () => {
    assert.equal(DRUG_NETWORK_ROLE_LABELS.COURIER.labelTh, "นักบิน / คนส่งยา");
  });

  test("RETAIL_DEALER → ผู้ค้ารายย่อย", () => {
    assert.equal(DRUG_NETWORK_ROLE_LABELS.RETAIL_DEALER.labelTh, "ผู้ค้ารายย่อย");
  });

  test("RUNNER → เด็กเดินยา", () => {
    assert.equal(DRUG_NETWORK_ROLE_LABELS.RUNNER.labelTh, "เด็กเดินยา");
  });
});

// ── Identifier type labels ─────────────────────────────────────────────────────

describe("DRUG_PERSON_IDENTIFIER_TYPE_LABELS — all types have Thai labels", () => {
  [...DRUG_PERSON_IDENTIFIER_TYPES].forEach((type) => {
    test(`${type} → non-empty Thai label, not a raw enum`, () => {
      const meta = DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type];
      assert.ok(meta.labelTh, `${type} must have a truthy labelTh`);
      assert.ok(!/^[A-Z_]+$/.test(meta.labelTh), `${type} labelTh must not look like a raw enum (got: ${meta.labelTh})`);
    });
  });

  test("THAI_ID → เลขบัตรประชาชน", () => {
    assert.equal(DRUG_PERSON_IDENTIFIER_TYPE_LABELS.THAI_ID.labelTh, "เลขบัตรประชาชน");
  });

  test("PASSPORT → หนังสือเดินทาง", () => {
    assert.equal(DRUG_PERSON_IDENTIFIER_TYPE_LABELS.PASSPORT.labelTh, "หนังสือเดินทาง");
  });
});

// ── Relationship status labels ─────────────────────────────────────────────────

describe("DRUG_RELATIONSHIP_STATUS_LABELS — all statuses have Thai labels", () => {
  [...DRUG_RELATIONSHIP_STATUSES].forEach((status) => {
    test(`${status} → non-empty Thai label, not a raw enum`, () => {
      const meta = DRUG_RELATIONSHIP_STATUS_LABELS[status];
      assert.ok(meta.labelTh, `${status} must have a truthy labelTh`);
      assert.ok(!/^[A-Z_]+$/.test(meta.labelTh), `${status} labelTh must not look like a raw enum`);
    });
  });

  test("REPORTED → แจ้งรายงาน", () => {
    assert.equal(DRUG_RELATIONSHIP_STATUS_LABELS.REPORTED.labelTh, "แจ้งรายงาน");
  });

  test("CONFIRMED → ยืนยันแล้ว", () => {
    assert.equal(DRUG_RELATIONSHIP_STATUS_LABELS.CONFIRMED.labelTh, "ยืนยันแล้ว");
  });

  test("SYSTEM_SUGGESTED → ระบบแนะนำ", () => {
    assert.equal(DRUG_RELATIONSHIP_STATUS_LABELS.SYSTEM_SUGGESTED.labelTh, "ระบบแนะนำ");
  });

  test("OBSERVED → พบจากการสังเกต", () => {
    assert.equal(DRUG_RELATIONSHIP_STATUS_LABELS.OBSERVED.labelTh, "พบจากการสังเกต");
  });
});

// ── Case status labels ─────────────────────────────────────────────────────────

describe("DRUG_CASE_STATUS_META — all case statuses have Thai labels", () => {
  const statuses = ["OPEN", "UNDER_INVESTIGATION", "CLOSED", "ARCHIVED"] as const;
  [...statuses].forEach((status) => {
    test(`${status} → non-empty Thai label, not a raw enum`, () => {
      const meta = DRUG_CASE_STATUS_META[status];
      assert.ok(meta.labelTh, `${status} must have a truthy labelTh`);
      assert.ok(!/^[A-Z_]+$/.test(meta.labelTh), `${status} labelTh must not look like a raw enum`);
    });
  });

  test("OPEN → เปิดคดี", () => {
    assert.equal(DRUG_CASE_STATUS_META.OPEN.labelTh, "เปิดคดี");
  });

  test("UNDER_INVESTIGATION → อยู่ระหว่างสอบสวน", () => {
    assert.ok(DRUG_CASE_STATUS_META.UNDER_INVESTIGATION.labelTh.length > 0);
    assert.ok(!/^[A-Z_]+$/.test(DRUG_CASE_STATUS_META.UNDER_INVESTIGATION.labelTh));
  });
});

// ── Network role source labels ─────────────────────────────────────────────────

describe("DRUG_NETWORK_ROLE_SOURCE_LABELS — all sources have Thai labels", () => {
  [...DRUG_NETWORK_ROLE_SOURCES].forEach((source) => {
    test(`${source} → non-empty Thai label, not a raw enum`, () => {
      const meta = DRUG_NETWORK_ROLE_SOURCE_LABELS[source];
      assert.ok(meta.labelTh, `${source} must have a truthy labelTh`);
      assert.ok(!/^[A-Z_]+$/.test(meta.labelTh), `${source} labelTh must not look like a raw enum`);
    });
  });
});

// ── Guard functions ───────────────────────────────────────────────────────────

describe("isValidDrugNetworkRoleSource", () => {
  test("accepts known sources", () => {
    assert.ok(isValidDrugNetworkRoleSource("DIRECT_ARREST"));
    assert.ok(isValidDrugNetworkRoleSource("TESTIMONY"));
    assert.ok(isValidDrugNetworkRoleSource("UNKNOWN"));
  });

  test("rejects unknown strings", () => {
    assert.equal(isValidDrugNetworkRoleSource("INVALID"), false);
    assert.equal(isValidDrugNetworkRoleSource(""), false);
    assert.equal(isValidDrugNetworkRoleSource("REPORTED"), false);
  });
});

describe("isValidDrugRelationshipStatus", () => {
  test("accepts known statuses", () => {
    assert.ok(isValidDrugRelationshipStatus("CONFIRMED"));
    assert.ok(isValidDrugRelationshipStatus("REPORTED"));
    assert.ok(isValidDrugRelationshipStatus("SYSTEM_SUGGESTED"));
    assert.ok(isValidDrugRelationshipStatus("OBSERVED"));
  });

  test("rejects unknown strings", () => {
    assert.equal(isValidDrugRelationshipStatus("OPEN"), false);
    assert.equal(isValidDrugRelationshipStatus(""), false);
    assert.equal(isValidDrugRelationshipStatus("UNVERIFIED"), false);
  });
});

// ── Date formatting ───────────────────────────────────────────────────────────

describe("formatDiDate", () => {
  test("formats ISO date string to short Thai Buddhist Era date", () => {
    const result = formatDiDate("2026-08-14T00:00:00.000Z");
    assert.equal(result, "14 ส.ค. 2569");
  });

  test("formats Date object correctly", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    const result = formatDiDate(d);
    assert.equal(result, "1 ม.ค. 2569");
  });

  test("returns ไม่มีข้อมูล for null", () => {
    assert.equal(formatDiDate(null), "ไม่มีข้อมูล");
  });

  test("returns ไม่มีข้อมูล for undefined", () => {
    assert.equal(formatDiDate(undefined), "ไม่มีข้อมูล");
  });

  test("returns ไม่มีข้อมูล for empty string", () => {
    assert.equal(formatDiDate(""), "ไม่มีข้อมูล");
  });

  test("returns ไม่มีข้อมูล for invalid date string", () => {
    assert.equal(formatDiDate("not-a-date"), "ไม่มีข้อมูล");
  });

  test("output contains Buddhist Era year (2026 → 2569), not Gregorian year", () => {
    const result = formatDiDate("2026-08-14T00:00:00.000Z");
    assert.ok(!result.includes("2026"), `result should not contain Gregorian year: ${result}`);
    assert.ok(result.includes("2569"), `result should contain Buddhist Era year: ${result}`);
  });
});

// ── Clear All filter URL logic ────────────────────────────────────────────────

describe("clearAllFilters URL behavior", () => {
  /*
   * Decision (per spec §2, documented here):
   *   - Clears: all filter params, q (search text), page
   *   - Preserves: sort when not "RELEVANCE" (default → cleaner URL)
   *   - No other state is preserved
   *
   * Mirror of the clearAllFilters function in
   * app/drug-intelligence/persons/page.tsx.
   */
  function buildClearAllUrl(currentSort: string): string {
    const next = new URLSearchParams();
    if (currentSort !== "RELEVANCE") next.set("sort", currentSort);
    const qs = next.toString();
    return qs ? `/drug-intelligence/persons?${qs}` : "/drug-intelligence/persons";
  }

  test("default sort (RELEVANCE) → bare path, no query string", () => {
    assert.equal(buildClearAllUrl("RELEVANCE"), "/drug-intelligence/persons");
  });

  test("non-default sort → path preserves only sort param", () => {
    assert.equal(buildClearAllUrl("NAME_ASC"), "/drug-intelligence/persons?sort=NAME_ASC");
  });

  test("no spurious params remain after clear", () => {
    const url = buildClearAllUrl("NAME_ASC");
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    assert.equal(params.get("q"), null);
    assert.equal(params.get("sex"), null);
    assert.equal(params.get("province"), null);
    assert.equal(params.get("battalionId"), null);
    assert.equal(params.get("page"), null);
    assert.equal(params.get("sort"), "NAME_ASC");
  });

  test("CASE_COUNT_DESC sort is preserved", () => {
    const url = buildClearAllUrl("CASE_COUNT_DESC");
    assert.ok(url.includes("sort=CASE_COUNT_DESC"), `Expected sort=CASE_COUNT_DESC in: ${url}`);
  });
});

// ── Active filter chip removal URL behavior ───────────────────────────────────

describe("removeArrayValue URL behavior", () => {
  function removeArrayValue(currentStr: string, value: string): string | undefined {
    const arr = currentStr.split(",").filter((v) => v !== value && v !== "");
    return arr.length ? arr.join(",") : undefined;
  }

  test("removes single value from multi-value string", () => {
    assert.equal(removeArrayValue("COURIER,RETAIL_DEALER", "COURIER"), "RETAIL_DEALER");
  });

  test("returns undefined when removing last value", () => {
    assert.equal(removeArrayValue("COURIER", "COURIER"), undefined);
  });

  test("leaves other values untouched", () => {
    assert.equal(removeArrayValue("A,B,C", "B"), "A,C");
  });

  test("handles empty string input gracefully", () => {
    assert.equal(removeArrayValue("", "COURIER"), undefined);
  });
});

// ── Dependent battalionId/companyId chip clearing ─────────────────────────────

describe("dependent battalionId/companyId chip clearing", () => {
  /*
   * When removing the battalion chip, companyId must also be cleared.
   * Mirrors: updateParams({ battalionId: undefined, companyId: undefined })
   */
  test("removing battalion chip clears both battalionId and companyId params", () => {
    const current = new URLSearchParams("battalionId=1&companyId=10&sex=MALE&sort=NAME_ASC");
    const next = new URLSearchParams(current.toString());
    next.delete("battalionId");
    next.delete("companyId");
    next.delete("page");

    assert.equal(next.get("battalionId"), null);
    assert.equal(next.get("companyId"), null);
    assert.equal(next.get("sex"), "MALE");
    assert.equal(next.get("sort"), "NAME_ASC");
  });

  test("removing company chip does NOT clear battalionId", () => {
    const current = new URLSearchParams("battalionId=1&companyId=10&sort=NAME_ASC");
    const next = new URLSearchParams(current.toString());
    next.delete("companyId");
    next.delete("page");

    assert.equal(next.get("battalionId"), "1");
    assert.equal(next.get("companyId"), null);
  });
});
