/**
 * Canonical presentation queries for Commander Mobile Intelligence (Phase 51.4).
 * These strings are sent to Personnel Search API — Telegram does not compute intelligence.
 */

export const COMMANDER_QUERIES = {
  promotion: "พร้อมเลื่อนปีนี้",
  retirement: "ใกล้เกษียณ",
  /** Prefer a phrase that resolves to TRAINING_SEARCH (not bare ขาดหลักสูตร). */
  training: "หลักสูตรสืบสวน",
  documents: "ขาดเอกสาร",
  dataQuality: "ข้อมูลไม่ครบ",
  help: "help",
} as const;

export type CommanderQuickQueryKey = keyof typeof COMMANDER_QUERIES;

/** Build a unit lookup query from a public organization code. */
export function unitLookupQuery(publicCode: string): string {
  const code = publicCode.trim();
  if (!code) return COMMANDER_QUERIES.help;
  if (/^\d{1,2}$/.test(code)) return `กก${code}`;
  if (/^\d{3,4}$/.test(code)) return `ร้อย${code}`;
  return code;
}
