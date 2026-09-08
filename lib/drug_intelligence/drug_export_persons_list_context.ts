/**
 * Persons-list export context (DI-10E.4).
 * OPERATIONAL_PERSONS supports only: all ACTIVE persons, or ACTIVE persons
 * matching searchQuery. It does not apply persons-page advanced filters.
 */

import type { DrugExportContextV1Input } from "@/lib/drug_intelligence/drug_export_context";
import type { Language } from "@/lib/i18n/dictionary";

export interface PersonsListExportFilters {
  searchQuery?: string;
}

export function personsListFiltersToExportContext(
  filters: PersonsListExportFilters,
  locale: Language
): DrugExportContextV1Input {
  return {
    schemaVersion: 1,
    locale,
    sourceRoute: "/drug-intelligence/reports",
    searchQuery: filters.searchQuery?.trim() || undefined,
  };
}
