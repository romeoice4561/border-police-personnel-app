/**
 * Money display formatting for salary fields.
 *
 * Policy:
 * - whole amounts → "48,200 บาท" (no .00)
 * - fractional → "48,200.50 บาท" (always 2 decimal digits)
 *
 * Pure data — no I/O, no React.
 */

import { roundMoney2 } from "@/lib/officer_profile/money_draft";

function isWholeBaht(amount: number): boolean {
  return Math.abs(amount - Math.round(amount)) < 1e-9;
}

export function formatMoneyTh(amount: number): string {
  const n = roundMoney2(amount);
  if (isWholeBaht(n)) {
    return `${Math.round(n).toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;
  }
  return `${n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} บาท`;
}

export function formatMoneyEn(amount: number): string {
  const n = roundMoney2(amount);
  if (isWholeBaht(n)) {
    return `THB ${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `THB ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
