/**
 * Suggestion / action descriptors for resolved organizations (Phase 51.1A).
 * Presentation mapping (Telegram buttons, etc.) stays in client adapters.
 */
import type { SearchAction } from "@/lib/personnel_search/contracts";
import type { ResolvedEntity } from "@/lib/personnel_entities/contracts";

/**
 * Safe unit follow-up actions — relative descriptors only (no hostnames).
 */
export function buildUnitSuggestionActions(entity: ResolvedEntity): SearchAction[] {
  const publicCode = entity.publicCode ?? "";
  const unitKey = entity.type === "company"
    ? `company:${publicCode}`
    : entity.type === "division"
      ? `division:${publicCode}`
      : `region:${publicCode}`;

  return [
    {
      type: "view_unit",
      labelTh: "ดูกำลังพล",
      labelEn: "View strength",
      payload: { unitKey, publicCode, intentHint: "UNIT_LOOKUP" },
    },
    {
      type: "view_promotion",
      labelTh: "ดูผู้พร้อมเลื่อน",
      labelEn: "View promotion-ready",
      payload: { unitKey, publicCode, intentHint: "PROMOTION_SEARCH" },
    },
    {
      type: "refine_query",
      labelTh: "ดูเกษียณ",
      labelEn: "View retirement",
      payload: { unitKey, publicCode, intentHint: "RETIREMENT_SEARCH", queryHint: "ใกล้เกษียณ" },
    },
    {
      type: "view_training",
      labelTh: "ดูหลักสูตร",
      labelEn: "View training",
      payload: { unitKey, publicCode, intentHint: "TRAINING_SEARCH" },
    },
    {
      type: "view_documents",
      labelTh: "ดูเอกสาร",
      labelEn: "View documents",
      payload: { unitKey, publicCode, intentHint: "DOCUMENT_SEARCH" },
    },
    {
      type: "open_dashboard",
      labelTh: "เปิด Dashboard",
      labelEn: "Open Dashboard",
      payload: { href: "/commander-promotion", unitKey, publicCode },
    },
  ];
}
