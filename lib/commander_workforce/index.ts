/**
 * Commander Workforce Intelligence ViewModel — public surface (Phase 52.1).
 */

export * from "@/lib/commander_workforce/types";
export * from "@/lib/commander_workforce/contracts";
export { composeCommanderWorkforceViewModel } from "@/lib/commander_workforce/compose";
export {
  normalizeWorkforceFilters,
  applyWorkforceFilters,
  buildAvailableFilters,
} from "@/lib/commander_workforce/filters";
export { buildWorkforceDrilldown, isApprovedWorkforceHref } from "@/lib/commander_workforce/drilldown";
export { retirementWindowForOfficer } from "@/lib/commander_workforce/retirement";
export { promotionStatusOf } from "@/lib/commander_workforce/promotion";
export { documentStatusForOfficer } from "@/lib/commander_workforce/documents";
export { dataQualityStatusForOfficer } from "@/lib/commander_workforce/data_quality";
