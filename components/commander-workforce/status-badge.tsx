/**
 * Semantic executive badges — Thai labels only, design-token tones.
 */
import { Badge } from "@/components/ui/badge";

export type WorkforceBadgeKind =
  | "ready"
  | "urgent"
  | "review"
  | "complete"
  | "attention"
  | "critical"
  | "info";

const BADGE_COPY: Record<WorkforceBadgeKind, { label: string; tone: "accent" | "good" | "warning" | "serious" | "critical" | "neutral" }> = {
  ready: { label: "พร้อม", tone: "good" },
  urgent: { label: "เร่งด่วน", tone: "warning" },
  review: { label: "ต้องตรวจสอบ", tone: "serious" },
  complete: { label: "ครบแล้ว", tone: "good" },
  attention: { label: "ควรติดตาม", tone: "accent" },
  critical: { label: "วิกฤต", tone: "critical" },
  info: { label: "ข้อมูล", tone: "neutral" },
};

export function StatusBadge({ kind }: { kind: WorkforceBadgeKind }) {
  const cfg = BADGE_COPY[kind];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function badgeKindForPromotionStatus(status: string): WorkforceBadgeKind | null {
  switch (status) {
    case "EligibleThisYear":
      return "ready";
    case "AlreadyEligible":
      return "attention";
    case "MissingTraining":
    case "MissingDocuments":
      return "attention";
    case "RetirementRestricted":
      return "urgent";
    case "Unknown":
      return "review";
    default:
      return null;
  }
}

export function badgeKindForSeverity(severity: "critical" | "urgent" | "attention" | "info"): WorkforceBadgeKind {
  if (severity === "critical") return "critical";
  if (severity === "urgent") return "urgent";
  if (severity === "attention") return "attention";
  return "info";
}
