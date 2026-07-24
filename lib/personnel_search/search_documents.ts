/**
 * Document search — existing document intelligence / expiry only.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { fuzzyContains } from "@/lib/personnel_search/normalizer";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

function docTypeHaystack(officer: CommanderQueryOfficer): string {
  const missing = (officer.documentIntelligence?.missingRequiredDocuments ?? []).join(" ");
  const expiryTypes = (officer.documentExpiryInfo ?? [])
    .map((e) => `${e.document.documentType ?? ""} ${e.document.title ?? ""} ${e.document.originalFilename ?? ""}`)
    .join(" ");
  return `${missing} ${expiryTypes}`;
}

export function searchDocuments(
  officers: CommanderQueryOfficer[],
  parsed: ParsedSearchQuery
): CommanderQueryOfficer[] {
  const q = parsed.raw;

  return officers.filter((o) => {
    const docs = o.documentIntelligence;
    const expiry = o.documentExpiryInfo ?? [];
    const hay = docTypeHaystack(o);

    if (/ขาดเอกสาร|documents?\s*missing/i.test(q)) {
      return (
        o.flagCodes.includes("DOCUMENTS_MISSING") ||
        o.promotionIntelligence.promotionStatus === "MissingDocuments" ||
        docs?.readinessLevel === "INCOMPLETE" ||
        docs?.readinessLevel === "BLOCKED" ||
        (docs?.missingRequiredCount ?? 0) > 0
      );
    }
    if (/หมดอายุ|expired/i.test(q)) {
      return expiry.some((e) => e.status === "expired") || (docs?.expiredCount ?? 0) > 0;
    }
    if (/บัตรประชาชน|citizen|id\s*card/i.test(q)) {
      return fuzzyContains(hay, "บัตรประชาชน") || /CITIZEN|ID_CARD/i.test(hay);
    }
    if (/ใบขับขี่|driving|license/i.test(q)) {
      return fuzzyContains(hay, "ใบขับขี่") || /DRIVER|LICENSE/i.test(hay);
    }
    return o.flagCodes.includes("DOCUMENTS_MISSING") || (docs != null && docs.readinessLevel !== "READY");
  });
}

export function documentSummaryTh(officer: CommanderQueryOfficer): string {
  return (
    officer.documentIntelligence?.readinessLabelTh ??
    (officer.flagCodes.includes("DOCUMENTS_MISSING") ? "ขาดเอกสาร" : "—")
  );
}
