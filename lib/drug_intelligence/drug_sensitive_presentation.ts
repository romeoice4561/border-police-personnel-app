/**
 * Centralized sensitive-data presentation for Drug Intelligence (Phase DI-1
 * Round 2, Section 19).
 *
 * The single place every UI component masks a national ID / passport /
 * alien ID / phone number for display — never hardcoded per-component
 * (Section 19's explicit instruction). Mirrors
 * lib/officer_profile/bank_account.ts's maskBankAccountNumber convention:
 * masking is a pure display transform, never an access-control decision by
 * itself — callers still decide whether to fetch/render the FULL value at
 * all based on permission (`can("drug.read")` etc.) before calling these.
 *
 * Pure data — no I/O, no React.
 */

/**
 * Masks all but the last 4 characters, e.g. "1103700123456" ->
 * "xxxxxxxxx3456". Used for THAI_ID/PASSPORT/ALIEN_ID/OTHER identifier
 * values and citizen-id-shaped free text. Short values (≤4 chars) are fully
 * masked rather than shown in full, so a short/malformed identifier never
 * accidentally displays unmasked.
 */
export function maskIdentifierValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "x".repeat(Math.max(trimmed.length, 1));
  const visible = trimmed.slice(-4);
  return `${"x".repeat(trimmed.length - 4)}${visible}`;
}

/**
 * Masks a phone's middle digits while keeping the leading and trailing
 * groups readable, e.g. "0812345678" -> "081-xxx-5678". Works on the
 * matching-key format ("66812345678") or any raw input by extracting
 * digits first, then re-applying a Thai-style display grouping.
 */
export function maskPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "x".repeat(Math.max(digits.length, 1));
  const withoutCountryCode = digits.startsWith("66") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  if (withoutCountryCode.length !== 10) {
    // Not a standard 10-digit Thai mobile shape — mask everything except the last 4, same rule as identifiers.
    return maskIdentifierValue(withoutCountryCode);
  }
  return `${withoutCountryCode.slice(0, 3)}-xxx-${withoutCountryCode.slice(6)}`;
}

/**
 * Renders an identifier for display given the viewer's permission — full
 * value only when `canViewFull` is true (Section 19: "List/dashboard ไม่ควร
 * แสดง full sensitive data โดย default"). `canViewFull` is `can("drug.edit")`
 * at every call site: a drug.read-only viewer (e.g. commander) always sees
 * masked values, even on the Case Workspace; only a drug.edit holder (admin,
 * by default) sees the full value — a stricter gate than mere `drug.read`,
 * matching Section 20's "authenticated != เห็นทุกอย่าง". This is the ONE
 * function every Drug Intelligence component should call rather than
 * inlining a ternary — changing the masking rule or the permission gate
 * later only ever touches this file.
 */
export function presentIdentifierValue(value: string, canViewFull: boolean): string {
  return canViewFull ? value : maskIdentifierValue(value);
}

export function presentPhoneNumber(value: string, canViewFull: boolean): string {
  return canViewFull ? value : maskPhoneNumber(value);
}
