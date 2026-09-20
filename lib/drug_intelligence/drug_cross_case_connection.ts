/**
 * DI-8.2A — Cross-case connection evidence types + pure chronology helpers.
 *
 * Answers “ทำไมสองคดีนี้ถึงเชื่อมกัน?” without requiring Network Graph layout.
 * Conservative: shared province / drug category alone are NOT connections.
 */

export type CrossCaseEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "LOCATION";

export type CrossCaseEvidenceProvenance =
  | "DIRECT_RECORDED"
  | "SHARED_ENTITY"
  | "EXPLICIT_RELATIONSHIP"
  | "INDIRECT_PATH";

export type CrossCaseDirectness = "DIRECT" | "INDIRECT";

export type CrossCaseChronology = "BEFORE" | "AFTER" | "SAME_DAY" | "UNKNOWN";

export interface CrossCaseEvidenceItem {
  entityType: CrossCaseEntityType;
  entityId: string;
  displayLabel: string;
  displayValue: string;
  relationshipType: string;
  provenance: CrossCaseEvidenceProvenance;
  href?: string | null;
}

export interface CrossCaseConnectionCaseSummary {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  arrestTime: string | null;
  province: string | null;
  locationName: string | null;
  status: string | null;
}

export interface CrossCaseConnection {
  sourceCase: CrossCaseConnectionCaseSummary;
  targetCase: CrossCaseConnectionCaseSummary;
  chronology: CrossCaseChronology;
  directness: CrossCaseDirectness;
  hopCount: number;
  evidenceItems: CrossCaseEvidenceItem[];
  pathPreview?: string[] | null;
}

export interface CrossCaseConnectionResult {
  sourceCase: CrossCaseConnectionCaseSummary;
  connections: CrossCaseConnection[];
}

/** Arrest-date chronology relative to the viewing (source) case. Never implies causality. */
export function classifyCaseChronology(
  sourceArrestDate: string | Date | null | undefined,
  targetArrestDate: string | Date | null | undefined,
): CrossCaseChronology {
  const a = toDateOnly(sourceArrestDate);
  const b = toDateOnly(targetArrestDate);
  if (!a || !b) return "UNKNOWN";
  if (b < a) return "BEFORE";
  if (b > a) return "AFTER";
  return "SAME_DAY";
}

export function toDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const slice = value.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

/** Earliest / latest DATE-only from case arrest dates (entity recorded occurrence). */
export function computeEntityOccurrenceBounds(
  arrestDates: readonly (string | Date | null | undefined)[],
): { firstRecordedAt: string | null; lastRecordedAt: string | null } {
  const dates = arrestDates.map(toDateOnly).filter((d): d is string => Boolean(d)).sort();
  if (!dates.length) return { firstRecordedAt: null, lastRecordedAt: null };
  return { firstRecordedAt: dates[0]!, lastRecordedAt: dates[dates.length - 1]! };
}

/** Normalize HH:MM / HH:MM:SS for comparison; never invents 00:00 for missing. */
export function toArrestTimeKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = match[3] != null ? Number(match[3]) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export interface ChronologicalCaseFields {
  caseId: string;
  caseNumber?: string | null;
  arrestDate?: string | Date | null;
  arrestTime?: string | null;
}

/**
 * Canonical person/case chronology:
 * 1. arrestDate ASC (null dates last)
 * 2. arrestTime ASC only when BOTH have a real time (missing ≠ 00:00)
 * 3. caseNumber ASC, then caseId ASC
 */
export function compareCasesChronologically(a: ChronologicalCaseFields, b: ChronologicalCaseFields): number {
  const da = toDateOnly(a.arrestDate);
  const db = toDateOnly(b.arrestDate);
  if (da && db && da !== db) return da.localeCompare(db);
  if (da && !db) return -1;
  if (!da && db) return 1;

  const ta = toArrestTimeKey(a.arrestTime);
  const tb = toArrestTimeKey(b.arrestTime);
  if (ta && tb && ta !== tb) return ta.localeCompare(tb);
  if (ta && !tb) return -1; // known time before unknown — never invent 00:00 for missing
  if (!ta && tb) return 1;

  const na = (a.caseNumber ?? "").trim();
  const nb = (b.caseNumber ?? "").trim();
  if (na !== nb) return na.localeCompare(nb, "th");
  return a.caseId.localeCompare(b.caseId);
}

export function sortCasesChronologically<T extends ChronologicalCaseFields>(cases: readonly T[]): T[] {
  return [...cases].sort(compareCasesChronologically);
}

export function earliestCase<T extends ChronologicalCaseFields>(cases: readonly T[]): T | null {
  const sorted = sortCasesChronologically(cases.filter((c) => toDateOnly(c.arrestDate)));
  return sorted[0] ?? null;
}

export function latestCase<T extends ChronologicalCaseFields>(cases: readonly T[]): T | null {
  const sorted = sortCasesChronologically(cases.filter((c) => toDateOnly(c.arrestDate)));
  return sorted.length ? sorted[sorted.length - 1]! : null;
}

/**
 * Person occurrence fallback hierarchy (DI-8.2A):
 * 1. Linked case arrestDate bounds (preferred)
 * 2. Relationship observation firstSeenAt/lastSeenAt (confirmed observation fields)
 * 3. Never person/entity createdAt/updatedAt
 * 4. null → UI omits / shows insufficient-evidence copy
 */
export function derivePersonOccurrenceBounds(input: {
  arrestDates: readonly (string | Date | null | undefined)[];
  observationTimestamps?: readonly (Date | string | null | undefined)[];
}): { firstRecordedAt: string | null; lastRecordedAt: string | null; source: "ARREST_DATE" | "RELATIONSHIP_OBSERVATION" | "NONE" } {
  const fromArrest = computeEntityOccurrenceBounds(input.arrestDates);
  if (fromArrest.firstRecordedAt && fromArrest.lastRecordedAt) {
    return { ...fromArrest, source: "ARREST_DATE" };
  }
  const observed = (input.observationTimestamps ?? [])
    .map((v) => {
      if (v == null || v === "") return null;
      if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
      const d = toDateOnly(v);
      if (d) return d;
      const parsed = new Date(v);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    })
    .filter((d): d is string => Boolean(d))
    .sort();
  if (observed.length) {
    return { firstRecordedAt: observed[0]!, lastRecordedAt: observed[observed.length - 1]!, source: "RELATIONSHIP_OBSERVATION" };
  }
  return { firstRecordedAt: null, lastRecordedAt: null, source: "NONE" };
}

/** Merge evidence for the same target case; one card per case, many evidence items. */
export function mergeEvidenceByTargetCase(
  sourceCase: CrossCaseConnectionCaseSummary,
  rows: Array<{
    targetCase: CrossCaseConnectionCaseSummary;
    evidence: CrossCaseEvidenceItem;
    directness?: CrossCaseDirectness;
    hopCount?: number;
    pathPreview?: string[] | null;
  }>,
): CrossCaseConnection[] {
  const byTarget = new Map<string, CrossCaseConnection>();
  for (const row of rows) {
    const existing = byTarget.get(row.targetCase.caseId);
    if (!existing) {
      byTarget.set(row.targetCase.caseId, {
        sourceCase,
        targetCase: row.targetCase,
        chronology: classifyCaseChronology(sourceCase.arrestDate, row.targetCase.arrestDate),
        directness: row.directness ?? "DIRECT",
        hopCount: row.hopCount ?? 1,
        evidenceItems: [row.evidence],
        pathPreview: row.pathPreview ?? null,
      });
      continue;
    }
    const key = `${row.evidence.entityType}:${row.evidence.entityId}:${row.evidence.relationshipType}`;
    if (!existing.evidenceItems.some((e) => `${e.entityType}:${e.entityId}:${e.relationshipType}` === key)) {
      existing.evidenceItems.push(row.evidence);
    }
    if (row.directness === "INDIRECT") {
      existing.directness = "INDIRECT";
      existing.hopCount = Math.max(existing.hopCount, row.hopCount ?? existing.hopCount);
    }
    if (row.pathPreview?.length) existing.pathPreview = row.pathPreview;
  }

  return [...byTarget.values()].sort((a, b) => {
    const da = toDateOnly(a.targetCase.arrestDate) ?? "9999-99-99";
    const db = toDateOnly(b.targetCase.arrestDate) ?? "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.targetCase.caseNumber.localeCompare(b.targetCase.caseNumber, "th");
  });
}

export function chronologyLabelTh(c: CrossCaseChronology): string {
  switch (c) {
    case "BEFORE":
      return "คดีก่อนหน้า";
    case "AFTER":
      return "คดีภายหลัง";
    case "SAME_DAY":
      return "วันเดียวกัน";
    default:
      return "ไม่ทราบลำดับเวลา";
  }
}

export function evidenceTypeLabelTh(type: CrossCaseEntityType): string {
  switch (type) {
    case "PERSON":
      return "บุคคลเดียวกัน";
    case "PHONE":
      return "หมายเลขโทรศัพท์เดียวกัน";
    case "SIM":
      return "SIM เดียวกัน";
    case "DEVICE":
      return "อุปกรณ์ / IMEI เดียวกัน";
    case "VEHICLE":
      return "รถคันเดียวกัน";
    case "LOCATION":
      return "สถานที่เดียวกัน";
  }
}
