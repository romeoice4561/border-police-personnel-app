/**
 * TrainingStatus -> Badge tone mapping (Phase 45), matching the same
 * convention as lib/intelligence/promotion/status_tone.ts so Dashboard,
 * Commander Search, and the Officer Workspace share ONE mapping.
 */
import type { TrainingStatus } from "@/lib/intelligence/training/types";
import type { BadgeProps } from "@/components/ui/badge";

export const TRAINING_STATUS_TONE: Record<TrainingStatus, NonNullable<BadgeProps["tone"]>> = {
  Complete: "good",
  MissingRequired: "serious",
  ExpiringSoon: "warning",
  Expired: "critical",
  Unverified: "warning",
  NoPolicy: "neutral",
  NoData: "neutral",
  Unknown: "neutral",
};
