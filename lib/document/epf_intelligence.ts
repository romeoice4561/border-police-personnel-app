/**
 * e-PF Intelligence (Phase 46A — Electronic Personnel File Intelligence
 * Dashboard).
 *
 * Pure derivation layer over the documents already loaded for an officer —
 * no new DB fields, no new tables, no network I/O. Every number here is
 * computed from OfficerDocument rows (+ the already-resolved portrait) that
 * the page already fetched. Where a real signal doesn't exist (e.g. no
 * documents at all, so "largest file" is undefined), the result is `null` —
 * callers must render "Unknown"/an empty state, never invent a value.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { getDocumentTypes } from "@/lib/document/document_types";
import { categoryForTypeCode, getDocumentCategories } from "@/lib/document/document_categories";

// ── Active-document helpers ─────────────────────────────────────────────────

/** Most recent active document per type code, from the full (all-version) list. */
export function activeDocumentsByType(documents: readonly OfficerDocument[]): Map<string, OfficerDocument> {
  const map = new Map<string, OfficerDocument>();
  for (const doc of documents) {
    if (!doc.isActive) continue;
    const existing = map.get(doc.documentType);
    if (!existing || doc.version > existing.version) map.set(doc.documentType, doc);
  }
  return map;
}

// ── KPI dashboard ────────────────────────────────────────────────────────────

export interface EpfDashboardStats {
  totalDocuments: number;
  categoriesUsed: number;
  categoriesTotal: number;
  totalStorageBytes: number;
  /** null when there are zero active documents (nothing to compare). */
  largestDocument: OfficerDocument | null;
  /** null when there are zero active documents with a known uploadedAt. */
  mostRecentDocument: OfficerDocument | null;
}

export function computeDashboardStats(documents: readonly OfficerDocument[]): EpfDashboardStats {
  const active = [...activeDocumentsByType(documents).values()];
  const categoriesUsedSet = new Set(active.map((d) => categoryForTypeCode(d.documentType).code));

  let totalStorageBytes = 0;
  let largestDocument: OfficerDocument | null = null;
  let mostRecentDocument: OfficerDocument | null = null;

  for (const doc of active) {
    if (doc.fileSize != null) {
      totalStorageBytes += doc.fileSize;
      if (!largestDocument || (largestDocument.fileSize ?? 0) < doc.fileSize) largestDocument = doc;
    }
    if (doc.uploadedAt) {
      const t = new Date(doc.uploadedAt).getTime();
      const currentT = mostRecentDocument?.uploadedAt ? new Date(mostRecentDocument.uploadedAt).getTime() : -Infinity;
      if (t > currentT) mostRecentDocument = doc;
    }
  }

  return {
    totalDocuments: active.length,
    categoriesUsed: categoriesUsedSet.size,
    categoriesTotal: getDocumentCategories().length,
    totalStorageBytes,
    largestDocument,
    mostRecentDocument,
  };
}

// ── Completeness intelligence ───────────────────────────────────────────────

export type CompletenessItemState = "present" | "missing" | "unknown";

export interface CompletenessItem {
  /** Document type code, or a synthetic code for non-document signals (e.g. "OFFICIAL_PORTRAIT"). */
  code: string;
  state: CompletenessItemState;
}

/**
 * The recommended checklist (spec §2 example list). Codes map 1:1 to the
 * document type registry except OFFICIAL_PORTRAIT, which is a synthetic code
 * resolved from the officer's portrait (source !== "PLACEHOLDER"), not a
 * document row — the portrait pipeline is a separate, already-existing
 * system (lib/server/officer_portrait_service.ts) and is intentionally never
 * duplicated into a document upload here.
 */
export const RECOMMENDED_CHECKLIST_CODES: readonly string[] = [
  "GP7",
  "OFFICIAL_PORTRAIT",
  "NATIONAL_ID",
  "HOUSE_REGISTRATION",
  "EDUCATION_CERTIFICATE",
  "TRAINING_CERTIFICATE",
  "AWARD",
  "MEDICAL_DOCUMENT",
  "SALARY_DOCUMENT",
  "ANNUAL_EVALUATION",
  "FIREARMS_QUALIFICATION",
];

export interface CompletenessResult {
  items: CompletenessItem[];
  presentCount: number;
  totalCount: number;
  /** Integer 0-100. 0 when totalCount is 0 (never divides by zero, never fabricates). */
  percent: number;
}

/**
 * `hasOfficialPortrait` — pass `portrait.source !== "PLACEHOLDER"` from the
 * already-resolved ResolvedOfficerPortrait; this function stays pure/testable
 * without importing the portrait service.
 */
export function computeCompleteness(
  documents: readonly OfficerDocument[],
  hasOfficialPortrait: boolean
): CompletenessResult {
  const active = activeDocumentsByType(documents);
  const items: CompletenessItem[] = RECOMMENDED_CHECKLIST_CODES.map((code) => {
    if (code === "OFFICIAL_PORTRAIT") {
      return { code, state: hasOfficialPortrait ? "present" : "missing" };
    }
    return { code, state: active.has(code) ? "present" : "missing" };
  });

  const presentCount = items.filter((i) => i.state === "present").length;
  const totalCount = items.length;
  const percent = totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);

  return { items, presentCount, totalCount, percent };
}

/** Just the missing items, in checklist order — feeds the Missing Document Panel. */
export function missingChecklistItems(completeness: CompletenessResult): CompletenessItem[] {
  return completeness.items.filter((i) => i.state === "missing");
}

// ── Recent activity ──────────────────────────────────────────────────────────

export type RecentActivityKind = "uploaded" | "updated";

export interface RecentActivityEntry {
  documentType: string;
  kind: RecentActivityKind;
  /** The timestamp this entry is ordered by (uploadedAt for "uploaded", updatedAt for "updated"). */
  at: Date;
  document: OfficerDocument;
}

/**
 * Newest-first activity feed. A document counts as "uploaded" when its
 * version === 1 (first-ever upload for that type); version > 1 counts as
 * "updated" (Replace). Both use real, existing timestamps — uploadedAt for
 * the upload event, updatedAt for the most recent write to the row
 * (Replace or metadata edit). No synthetic "edit log" table is created.
 */
export function computeRecentActivity(documents: readonly OfficerDocument[], limit = 10): RecentActivityEntry[] {
  const entries: RecentActivityEntry[] = [];
  for (const doc of documents) {
    if (!doc.isActive) continue;
    const kind: RecentActivityKind = doc.version === 1 ? "uploaded" : "updated";
    const at = doc.uploadedAt ? new Date(doc.uploadedAt) : doc.updatedAt ? new Date(doc.updatedAt) : null;
    if (!at) continue; // no known timestamp — never fabricate one
    entries.push({ documentType: doc.documentType, kind, at, document: doc });
  }
  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries.slice(0, limit);
}

// ── Storage summary ──────────────────────────────────────────────────────────

export interface StorageSummary {
  totalBytes: number;
  /** null when there are zero active documents with a known fileSize. */
  averageBytes: number | null;
  largestDocument: OfficerDocument | null;
  imageCount: number;
  pdfCount: number;
  otherCount: number;
}

export function computeStorageSummary(documents: readonly OfficerDocument[]): StorageSummary {
  const active = [...activeDocumentsByType(documents).values()];
  let totalBytes = 0;
  let sizedCount = 0;
  let largestDocument: OfficerDocument | null = null;
  let imageCount = 0;
  let pdfCount = 0;
  let otherCount = 0;

  for (const doc of active) {
    if (doc.fileSize != null) {
      totalBytes += doc.fileSize;
      sizedCount += 1;
      if (!largestDocument || (largestDocument.fileSize ?? 0) < doc.fileSize) largestDocument = doc;
    }
    if (doc.mimeType?.startsWith("image/")) imageCount += 1;
    else if (doc.mimeType === "application/pdf") pdfCount += 1;
    else otherCount += 1;
  }

  return {
    totalBytes,
    averageBytes: sizedCount > 0 ? Math.round(totalBytes / sizedCount) : null,
    largestDocument,
    imageCount,
    pdfCount,
    otherCount,
  };
}

// ── Category dashboard rollups ───────────────────────────────────────────────

export interface CategoryRollup {
  categoryCode: string;
  documentCount: number;
  totalBytes: number;
  /** null when no document in this category has a known uploadedAt. */
  lastUpdated: Date | null;
  presentCount: number;
  totalCount: number;
  percent: number;
}

/**
 * Per-category rollup for the Category Dashboard (spec §7): count, storage,
 * last-updated, and a completion state scoped to the type codes that belong
 * to this category AND appear in the recommended checklist (categories with
 * no checklist items show percent=0/totalCount=0 rather than a fabricated
 * ratio over arbitrary registry types).
 */
export function computeCategoryRollups(documents: readonly OfficerDocument[]): CategoryRollup[] {
  const active = activeDocumentsByType(documents);
  const categories = getDocumentCategories();
  const types = getDocumentTypes();

  return categories.map((cat) => {
    const typesInCategory = types.filter((t) => cat.typeCodes.includes(t.code));
    let documentCount = 0;
    let totalBytes = 0;
    let lastUpdated: Date | null = null;

    for (const typeDef of typesInCategory) {
      const doc = active.get(typeDef.code);
      if (!doc) continue;
      documentCount += 1;
      if (doc.fileSize != null) totalBytes += doc.fileSize;
      if (doc.uploadedAt) {
        const t = new Date(doc.uploadedAt);
        if (!lastUpdated || t > lastUpdated) lastUpdated = t;
      }
    }

    const checklistCodesInCategory = RECOMMENDED_CHECKLIST_CODES.filter((code) => cat.typeCodes.includes(code));
    const presentCount = checklistCodesInCategory.filter((code) => active.has(code)).length;
    const totalCount = checklistCodesInCategory.length;
    const percent = totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);

    return { categoryCode: cat.code, documentCount, totalBytes, lastUpdated, presentCount, totalCount, percent };
  });
}
