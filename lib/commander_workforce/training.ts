/**
 * Training section — aggregates TrainingSummary.trainingStatus only.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type { WorkforceMetric, WorkforceTrainingSection } from "@/lib/commander_workforce/types";
import type { TrainingStatus } from "@/lib/intelligence/training/types";

const TRAINING_STATUSES: readonly TrainingStatus[] = [
  "Complete",
  "MissingRequired",
  "ExpiringSoon",
  "Expired",
  "Unverified",
  "NoPolicy",
  "NoData",
  "Unknown",
];

const LABEL_TH: Record<TrainingStatus, string> = {
  Complete: "ครบหลักสูตร",
  MissingRequired: "ขาดหลักสูตรจำเป็น",
  ExpiringSoon: "หลักสูตรใกล้หมดอายุ",
  Expired: "หลักสูตรหมดอายุ",
  Unverified: "ยังไม่ยืนยัน",
  NoPolicy: "ไม่มีนโยบายหลักสูตร",
  NoData: "ไม่มีข้อมูลหลักสูตร",
  Unknown: "ไม่ทราบสถานะ",
};

export function buildTrainingSection(officers: readonly CommanderQueryOfficer[]): WorkforceTrainingSection {
  const counts = Object.fromEntries(TRAINING_STATUSES.map((s) => [s, 0])) as Record<TrainingStatus, number>;

  for (const officer of officers) {
    const status = officer.trainingIntelligence?.trainingStatus ?? "Unknown";
    if (status in counts) counts[status as TrainingStatus] += 1;
    else counts.Unknown += 1;
  }

  const total = officers.length;
  const incomplete = counts.MissingRequired + counts.Expired + counts.ExpiringSoon + counts.Unverified;

  // Training.expiryDate is always null in current schema — ExpiringSoon may still
  // appear from engine status when policy exists; metric remains available as a status count.
  const anyPolicyConfigured = officers.some(
    (o) =>
      o.trainingIntelligence?.trainingStatus &&
      o.trainingIntelligence.trainingStatus !== "NoPolicy"
  );

  const byStatus: WorkforceMetric[] = TRAINING_STATUSES.map((status) => ({
    key: `training:${status}`,
    labelTh: LABEL_TH[status],
    count: counts[status],
    percentage: total > 0 ? Math.round((counts[status] / total) * 1000) / 10 : null,
    availability:
      status === "MissingRequired" && !anyPolicyConfigured
        ? { status: "unavailable", reason: "NOT_APPLICABLE" }
        : { status: "available" },
    drilldown: buildWorkforceDrilldown({
      id: `training:${status}`,
      label: LABEL_TH[status],
      filters: { trainingStatus: status },
    }),
  }));

  return {
    totalEvaluated: total,
    complete: counts.Complete,
    incomplete,
    missingRequired: counts.MissingRequired,
    expired: counts.Expired,
    expiringSoon: counts.ExpiringSoon,
    unknown: counts.Unknown,
    noPolicy: counts.NoPolicy,
    noData: counts.NoData,
    byStatus,
    expiringSoonAvailability: { status: "available" },
  };
}
