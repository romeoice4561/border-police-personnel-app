/**
 * useOfficerWorkspace financial-field hardening tests (Phase 45.1 hardening
 * pass). Covers the write-only bank-account-number behavior that the
 * server-boundary redaction fix (officer_financial_redaction.ts) requires:
 * the officer prop this hook receives has ALREADY had bankAccountNumber
 * masked by the page before it reaches the client, so the draft must never
 * be seeded from that value, and a blank save must mean "leave unchanged,"
 * never "clear the stored value."
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { hasStoredBankAccountNumber, bankAccountNumberSavePatch } from "@/components/officer/use_officer_workspace";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function fakeOfficer(overrides: Partial<OfficerWithRelations> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "OFF-1",
    rank: "ร.ต.ท.",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    bankAccountNumber: null,
    ...overrides,
  } as unknown as OfficerWithRelations;
}

test("6/12. hasStoredBankAccountNumber is true when the (already-masked) value is present — the editor uses this, never the value itself, to show an 'on file' hint", () => {
  const officer = fakeOfficer({ bankAccountNumber: "xxxxxx6789" }); // as it arrives post-redaction
  assert.equal(hasStoredBankAccountNumber(officer), true);
});

test("hasStoredBankAccountNumber is false for null/empty — legacy records with no bank account remain correctly represented", () => {
  assert.equal(hasStoredBankAccountNumber(fakeOfficer({ bankAccountNumber: null })), false);
  assert.equal(hasStoredBankAccountNumber(fakeOfficer({ bankAccountNumber: "" })), false);
});

test("6. bankAccountNumberSavePatch: a blank draft (admin didn't type a new value) OMITS the key entirely — never sends null, never clobbers the stored value with the masked placeholder", () => {
  const patch = bankAccountNumberSavePatch("");
  assert.equal("bankAccountNumber" in patch, false);
});

test("12/17-analog. bankAccountNumberSavePatch: a real typed value IS included and trimmed", () => {
  const patch = bankAccountNumberSavePatch("  0123456789  ");
  assert.deepEqual(patch, { bankAccountNumber: "0123456789" });
});

test("bankAccountNumberSavePatch treats whitespace-only input the same as blank (omitted, not saved as whitespace)", () => {
  const patch = bankAccountNumberSavePatch("   ");
  assert.equal("bankAccountNumber" in patch, false);
});
