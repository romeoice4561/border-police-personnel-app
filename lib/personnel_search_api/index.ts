/**
 * Personnel Search API public surface (Phase 51.1).
 */
export * from "@/lib/personnel_search_api/contracts";
export * from "@/lib/personnel_search_api/errors";
export * from "@/lib/personnel_search_api/validation";
export * from "@/lib/personnel_search_api/pagination";
export * from "@/lib/personnel_search_api/audit";
export * from "@/lib/personnel_search_api/sanitize";
export * from "@/lib/personnel_search_api/rate_limit";
export { handlePersonnelSearchRequest } from "@/lib/personnel_search_api/handler";
export type { PersonnelSearchHandlerDeps } from "@/lib/personnel_search_api/handler";
