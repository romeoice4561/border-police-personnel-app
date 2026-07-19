/**
 * Draft-state helpers for monetary inputs that support satang (2 decimal places).
 * Keep the controlled input as a string while typing; parse only for calc/save.
 */

/** Round to 2 decimal places without floating-point artifacts (e.g. 49126.999999). */
export function roundMoney2(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Sanitize a keystroke draft for money editing.
 * Allows "", "3", "3773", "3773.", "3773.5", "3773.50".
 * Optionally normalizes a clear decimal comma ("3773,50" → "3773.50")
 * without treating thousands ("3,773") as a decimal.
 */
export function sanitizeMoneyDraftInput(raw: string): string {
  let s = raw;

  // Clear decimal-comma form only: digits + single comma + 0–2 fraction digits.
  if (/^\d+,\d{0,2}$/.test(s)) {
    s = s.replace(",", ".");
  }

  // Strip everything except digits and dots (blocks e/E/+/-/spaces).
  s = s.replace(/[^\d.]/g, "");

  const dot = s.indexOf(".");
  if (dot === -1) return s;

  const intPart = s.slice(0, dot).replace(/\./g, "");
  const fracPart = s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${fracPart}`;
}

/** True when the draft is empty or matches ^\d*(\.\d{0,2})?$ */
export function isAcceptableMoneyDraft(raw: string): boolean {
  return raw === "" || /^\d*(\.\d{0,2})?$/.test(raw);
}

/**
 * Parse a money draft to a number for calculation/save.
 * "" / "." / incomplete trailing dot with no digits → null
 * "3773." → 3773 (treat trailing dot as whole baht while typing)
 */
export function parseMoneyDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ".") return null;

  let s = trimmed;
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (/^\d+\.$/.test(s)) s = s.slice(0, -1);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney2(n);
}

/** Coerce Prisma Decimal | number | string | null into a finite number or null. */
export function moneyFieldToNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? roundMoney2(value) : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? roundMoney2(n) : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? roundMoney2(n) : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? roundMoney2(n) : null;
}
