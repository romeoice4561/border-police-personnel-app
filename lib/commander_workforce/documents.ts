/**
 * Document section — aggregates OfficerDocumentIntelligence only.
 * No repository access, no file inspection, no invented mandatory policy.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type { WorkforceDocumentSection, WorkforceMetric } from "@/lib/commander_workforce/types";

export type WorkforceDocumentStatusKey =
  | "complete"
  | "incomplete"
  | "expiring"
  | "expired"
  | "missing_required"
  | "unknown";

export function documentStatusForOfficer(officer: CommanderQueryOfficer): WorkforceDocumentStatusKey {
  const doc = officer.documentIntelligence;
  if (!doc) return "unknown";

  if (doc.expiredCount > 0) return "expired";
  if (doc.expiringSoonCount > 0) return "expiring";
  if (doc.missingRequiredCount > 0) return "missing_required";

  if (doc.completenessLevel === "complete" || doc.readinessLevel === "READY") return "complete";
  if (doc.completenessLevel === "partial" || doc.readinessLevel === "NEEDS_REVIEW" || doc.readinessLevel === "INCOMPLETE") {
    return "incomplete";
  }
  if (doc.readinessLevel === "UNKNOWN" || doc.completenessLevel === "critical") {
    return doc.completenessLevel === "critical" ? "incomplete" : "unknown";
  }
  return "unknown";
}

export function buildDocumentSection(officers: readonly CommanderQueryOfficer[]): WorkforceDocumentSection {
  const counts: Record<WorkforceDocumentStatusKey, number> = {
    complete: 0,
    incomplete: 0,
    expiring: 0,
    expired: 0,
    missing_required: 0,
    unknown: 0,
  };

  let missingRequired = 0;
  let expired = 0;
  let expiring = 0;

  for (const officer of officers) {
    const status = documentStatusForOfficer(officer);
    counts[status] += 1;
    const doc = officer.documentIntelligence;
    if (doc) {
      if (doc.missingRequiredCount > 0) missingRequired += 1;
      if (doc.expiredCount > 0) expired += 1;
      if (doc.expiringSoonCount > 0) expiring += 1;
    }
  }

  const total = officers.length;
  const metric = (
    key: WorkforceDocumentStatusKey,
    labelTh: string,
    count: number,
    filters: Record<string, string | boolean>
  ): WorkforceMetric => ({
    key: `documents:${key}`,
    labelTh,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : null,
    availability: { status: "available" },
    drilldown: buildWorkforceDrilldown({
      id: `documents:${key}`,
      label: labelTh,
      filters,
    }),
  });

  const byStatus: WorkforceMetric[] = [
    metric("complete", "เอกสารครบ", counts.complete, { documentCompleteness: "complete" }),
    metric("incomplete", "เอกสารไม่ครบ", counts.incomplete, { documentCompleteness: "partial" }),
    metric("expiring", "ใกล้หมดอายุ", counts.expiring, { expiryStatus: "warning" }),
    metric("expired", "หมดอายุแล้ว", counts.expired, { expiryStatus: "expired" }),
    metric("missing_required", "ขาดเอกสารจำเป็น", counts.missing_required, {
      missingRequiredDocument: true,
    }),
    metric("unknown", "ไม่ทราบสถานะเอกสาร", counts.unknown, { documentReadiness: "UNKNOWN" }),
  ];

  // e-PF completeness: profileCompletenessPercent is the closest canonical field — not a dedicated e-PF summary.
  const withProfile = officers.filter((o) => o.profileCompletenessPercent != null);
  const epfCompleteness: WorkforceMetric = {
    key: "documents:epf_completeness",
    labelTh: "ความครบถ้วนโปรไฟล์ (proxy e-PF)",
    count: withProfile.filter((o) => (o.profileCompletenessPercent ?? 0) >= 80).length,
    percentage:
      withProfile.length > 0
        ? Math.round(
            (withProfile.filter((o) => (o.profileCompletenessPercent ?? 0) >= 80).length /
              withProfile.length) *
              1000
          ) / 10
        : null,
    availability:
      withProfile.length > 0
        ? { status: "available" }
        : { status: "unavailable", reason: "SOURCE_NOT_IMPLEMENTED" },
    drilldown: buildWorkforceDrilldown({
      id: "documents:epf",
      label: "โปรไฟล์ไม่ครบ",
      filters: { flagCode: "PROFILE_INCOMPLETE" },
    }),
    descriptionTh:
      withProfile.length > 0
        ? "ใช้ profileCompletenessPercent ที่มีอยู่ — ไม่ใช่ e-PF vault summary โดยตรง"
        : "ยังไม่มี canonical e-PF completeness summary ในชุดข้อมูลนี้",
  };

  return {
    totalEvaluated: total,
    complete: counts.complete,
    incomplete: counts.incomplete,
    expiring,
    expired,
    missingRequired,
    unknown: counts.unknown,
    byStatus,
    epfCompleteness,
  };
}
