/**
 * Bank account number helpers (Phase 45.1 — Task 6).
 *
 * The account number is stored as TEXT (never a numeric type) specifically
 * so leading zeros survive round-trip exactly as entered — this module is
 * the single place that normalization and masking happen, so every reader
 * (edit form, read-only profile, save flow) agrees on the same rule.
 *
 * Pure data — no I/O, no React.
 */

/** Trims and collapses internal whitespace; does NOT strip hyphens (a legitimate visual separator some banks use in printed material). */
export function normalizeBankAccountNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/**
 * Masks all but the last 4 characters for read-only display, e.g.
 * "1234567890" -> "xxxxxx7890". Never used to gate access on its own —
 * callers decide whether the FULL value or the masked value is fetched/
 * rendered based on RBAC (see lib/auth/roles.ts's officers.edit /
 * financial.viewFull permissions).
 */
export function maskBankAccountNumber(value: string): string {
  const digitsOnly = value.replace(/[^0-9]/g, "");
  if (digitsOnly.length <= 4) return "x".repeat(Math.max(value.length, 1));
  const visible = digitsOnly.slice(-4);
  return `${"x".repeat(digitsOnly.length - 4)}${visible}`;
}
