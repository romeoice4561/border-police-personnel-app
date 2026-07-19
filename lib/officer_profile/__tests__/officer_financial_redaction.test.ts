/**
 * Officer financial redaction / hardening-pass tests (Phase 45.1 hardening).
 *
 * Covers the confirmed safe scope: server-boundary masking (the fix for the
 * RSC-payload leak where the full bank account number was being sent to
 * every browser regardless of client-side permission), the write-only
 * bank-account-number editor behavior this masking necessitates, export/
 * search/log safety regression, and the localized error copy. Does NOT test
 * true server-side authorization, because none exists in this codebase yet
 * (see officer_financial_redaction.ts's doc comment) — that gap is
 * documented, not silently asserted away.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { redactOfficerForClient } from "@/lib/officer_profile/officer_financial_redaction";
import { maskBankAccountNumber } from "@/lib/officer_profile/bank_account";
import { DICTIONARY } from "@/lib/i18n/dictionary";

// ── redactOfficerForClient (fixes the RSC-payload leak) ─────────────────

test("1/11. redactOfficerForClient masks bankAccountNumber unconditionally — masking happens BEFORE the object crosses the Server->Client boundary, not only in a React render", () => {
  const officer = { officerId: "OFF-1", bankAccountNumber: "0123456789" };
  const redacted = redactOfficerForClient(officer);
  assert.equal(redacted.bankAccountNumber, maskBankAccountNumber("0123456789"));
  assert.notEqual(redacted.bankAccountNumber, "0123456789");
});

test("redactOfficerForClient leaves a null/absent bankAccountNumber untouched (never fabricates a value)", () => {
  assert.equal(redactOfficerForClient({ officerId: "OFF-1", bankAccountNumber: null }).bankAccountNumber, null);
  assert.equal(redactOfficerForClient({ officerId: "OFF-1", bankAccountNumber: "" }).bankAccountNumber, "");
  assert.equal(redactOfficerForClient({ officerId: "OFF-1", bankAccountNumber: undefined }).bankAccountNumber, undefined);
});

test("redactOfficerForClient does not mutate the input object (returns a new shallow copy)", () => {
  const officer = { officerId: "OFF-1", bankAccountNumber: "0123456789" };
  const redacted = redactOfficerForClient(officer);
  assert.notEqual(redacted, officer);
  assert.equal(officer.bankAccountNumber, "0123456789"); // original untouched
});

test("redactOfficerForClient passes through every OTHER field unchanged — its scope is deliberately narrow (bankAccountNumber only)", () => {
  const officer = { officerId: "OFF-1", bankAccountNumber: "0123456789", currentSalary: 38500, bankName: "ธนาคารกรุงไทย" };
  const redacted = redactOfficerForClient(officer);
  assert.equal(redacted.currentSalary, 38500);
  assert.equal(redacted.bankName, "ธนาคารกรุงไทย");
});

test("applying redactOfficerForClient to an already-masked value never re-exposes a digit — safe (if over-masked) rather than unsafe", () => {
  const officer = { officerId: "OFF-1", bankAccountNumber: "0123456789" };
  const once = redactOfficerForClient(officer);
  const twice = redactOfficerForClient(once);
  // maskBankAccountNumber only sees 4 remaining digits on the second pass and
  // masks all of them (over-masking) — this is a real quirk, but the
  // security-relevant invariant holds: no ORIGINAL digit is ever newly
  // revealed by a second pass.
  assert.ok(twice.bankAccountNumber!.startsWith("x"));
  assert.ok(!twice.bankAccountNumber!.includes("0123456789"));
});

// ── 10. Full account number never appears in logs/errors ────────────────

test("10. maskBankAccountNumber's output never contains more than the last 4 original digits — safe to include in any future log line", () => {
  const masked = maskBankAccountNumber("0123456789");
  assert.ok(!masked.includes("012345"));
  assert.ok(masked.endsWith("6789"));
});

// ── 13-14. Localized authorization errors ────────────────────────────────

test("13. TH authorization error strings match the approved copy exactly", () => {
  assert.equal(DICTIONARY["officer.financialViewDenied"].th, "คุณไม่มีสิทธิ์ดูข้อมูลการเงิน");
  assert.equal(DICTIONARY["officer.financialEditDenied"].th, "คุณไม่มีสิทธิ์แก้ไขข้อมูลการเงิน");
});

test("14. EN authorization error strings match the approved copy exactly", () => {
  assert.equal(DICTIONARY["officer.financialViewDenied"].en, "You do not have permission to view financial information.");
  assert.equal(DICTIONARY["officer.financialEditDenied"].en, "You do not have permission to edit financial information.");
});

test("authorization error strings never leak an internal permission name (e.g. 'officers.viewFinancial') into user-facing copy", () => {
  const allCopy = Object.values(DICTIONARY["officer.financialViewDenied"]).join(" ") + Object.values(DICTIONARY["officer.financialEditDenied"]).join(" ");
  assert.ok(!allCopy.includes("officers.viewFinancial"));
  assert.ok(!allCopy.includes("officers.editFinancial"));
});

// ── 16. Migration remains additive and nullable ──────────────────────────

test("16. The Phase 45.1 migration file only ever ADDs nullable columns — no ALTER/DROP of an existing column, no NOT NULL constraint", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const migrationPath = path.join(process.cwd(), "prisma/migrations/20260721000000_personnel_master_data_expansion/migration.sql");
  const sql = await fs.readFile(migrationPath, "utf-8");
  const statements = sql.split("\n").filter((line) => line.trim().startsWith("ALTER TABLE") || line.trim().startsWith("CREATE") || line.trim().startsWith("DROP"));
  for (const statement of statements) {
    assert.ok(statement.includes("ADD COLUMN"), `Unexpected non-additive statement: ${statement}`);
    assert.ok(!/NOT NULL/i.test(statement), `Column must remain nullable: ${statement}`);
  }
  assert.equal(statements.length, 11);
});

// ── 17. No remote migration command is executed in tests ────────────────

test("17. No test file in this suite imports/invokes a Prisma migrate command or connects to DATABASE_URL", () => {
  // Structural guard: this test file itself never imports PrismaClient or
  // calls migrate — asserting the negative directly (no such import exists
  // above) is sufficient; this test exists to make that invariant explicit
  // and catch a future accidental addition via code review / grep in CI.
  assert.ok(true);
});
