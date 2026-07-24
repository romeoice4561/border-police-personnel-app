/**
 * Personnel Search Gateway public surface (Phase 51).
 */
export * from "@/lib/personnel_search/types";
export * from "@/lib/personnel_search/contracts";
export * from "@/lib/personnel_search/normalizer";
export * from "@/lib/personnel_search/intent";
export * from "@/lib/personnel_search/parser";
export * from "@/lib/personnel_search/ranking";
export * from "@/lib/personnel_search/permission";
export * from "@/lib/personnel_search/formatter";
export * from "@/lib/personnel_search/gateway";
export { searchPersons, needsDisambiguation, sortDisambiguation } from "@/lib/personnel_search/search_person";
export { searchUnit } from "@/lib/personnel_search/search_unit";
export { searchPromotion, promotionSummaryTh } from "@/lib/personnel_search/search_promotion";
export { searchRetirement, retirementSummaryTh } from "@/lib/personnel_search/search_retirement";
export { searchTraining, trainingSummaryTh } from "@/lib/personnel_search/search_training";
export { searchDocuments, documentSummaryTh } from "@/lib/personnel_search/search_documents";
export { searchContacts } from "@/lib/personnel_search/search_contact";
export { searchDataQuality, dataQualitySummaryTh } from "@/lib/personnel_search/search_data_quality";
