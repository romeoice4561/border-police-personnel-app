/**
 * Training Intelligence Engine — domain model (Phase 45).
 *
 * Pure type declarations — no logic, no I/O. See docs/TRAINING_INTELLIGENCE.md
 * for the full data-flow and rationale.
 *
 * SCHEMA REALITY (Phase 45 audit — see docs/TRAINING_INTELLIGENCE.md):
 * `Training` (prisma/schema.prisma) has only `course` (free text),
 * `organization` (free text), `year` (free-text string, NOT a real date),
 * and `notes`. There is NO completion date, NO expiry/valid-until date, NO
 * certificate number, and NO verification status field anywhere on
 * `Training`. Every field below that depends on one of those (completionDate,
 * expiryDate, certificateNumber, verified) is consequently ALWAYS null for
 * real data today — never fabricated, never guessed. This is a genuine data
 * limitation, not an oversight in this engine.
 */

import type { DurationYMD } from "@/lib/personnel_calendar";

/** One piece of evidence a course requirement can be matched against — a normalized view of a single Training row. */
export interface TrainingRecordEvidence {
  recordId: number;
  courseName: string;
  /** Null when the course name could not be reliably normalized — see course_normalization.ts. Never a guessed/fuzzy key. */
  normalizedCourseKey: string | null;
  provider: string | null;
  /** ISO date (YYYY-MM-DD), when derivable from the free-text `year` field. Null otherwise — `Training.year` is a free-text string, not a real date column, so this is a best-effort parse, never fabricated. */
  completionDate: string | null;
  /** Always null today — `Training` has no expiry/valid-until column. Kept as an explicit field so a future schema addition (see docs/TRAINING_INTELLIGENCE.md's Known Limitations) requires no type change, only a new source of truth. */
  expiryDate: string | null;
  /** Always null today — `Training` has no certificate-number column. */
  certificateNumber: string | null;
  /** Always null today — `Training` has no verification-status column (contrast with `OfficerSkill`, which has one). Null means "verification is not tracked for this record type," distinct from `false` ("tracked and explicitly unverified"). */
  verified: boolean | null;
  source: string | null;
}

export type TrainingRequirementStatus =
  | "Completed"
  | "Missing"
  | "ExpiringSoon"
  | "Expired"
  | "Unverified"
  | "Unknown";

export interface TrainingRequirementResult {
  requirementKey: string;
  displayNameTh: string;
  status: TrainingRequirementStatus;
  matchedRecordIds: number[];
  completionDate: string | null;
  expiryDate: string | null;
  reasonTh: string | null;
}

export type TrainingStatus =
  | "Complete"
  | "MissingRequired"
  | "ExpiringSoon"
  | "Expired"
  | "Unverified"
  | "NoPolicy"
  | "NoData"
  | "Unknown";

/**
 * The full Training Intelligence summary for one officer — the ONE shape
 * Dashboard/Search/Officer Workspace all read. `available: false` only when
 * the underlying officer/training data itself could not be loaded (never
 * used to mean "no policy" or "no records" — those are `NoPolicy`/`NoData`
 * trainingStatus values instead, each with its own explicit, truthful
 * count/state — see docs/TRAINING_INTELLIGENCE.md).
 */
export interface TrainingSummary {
  available: boolean;
  asOfDate: string;

  totalRecords: number;
  verifiedRecords: number;
  unverifiedRecords: number;

  completedCourseCount: number;
  missingRequiredCourseCount: number;
  expiringSoonCount: number;
  expiredCount: number;

  requiredRequirements: TrainingRequirementResult[];
  completedCourses: TrainingRecordEvidence[];
  missingRequirements: TrainingRequirementResult[];
  expiringSoon: TrainingRequirementResult[];
  expired: TrainingRequirementResult[];

  trainingStatus: TrainingStatus;
  displayStatusTh: string;
  recommendationsTh: string[];

  /** Data-quality flags — see data_quality.ts. Never causes records to be altered/deleted. */
  dataQualityFlags: TrainingDataQualityFlag[];

  reason?: string;
}

export type TrainingDataQualityFlagCode =
  | "MISSING_COURSE_NAME"
  | "INVALID_DATE"
  | "COMPLETION_AFTER_EXPIRY"
  | "DUPLICATE_CERTIFICATE_NUMBER"
  | "DUPLICATE_COURSE_RECORD"
  | "UNVERIFIED_RECORD";

export interface TrainingDataQualityFlag {
  code: TrainingDataQualityFlagCode;
  recordIds: number[];
  messageTh: string;
}

/** Expiry-awareness band — only ever computed when a record actually carries an expiryDate (never fabricated for Training records today; see the module doc comment). */
export type ExpiryBand = "valid" | "expiring_soon" | "urgent" | "expires_today" | "expired";

export interface ExpirySummary {
  available: boolean;
  band: ExpiryBand | null;
  remainingDays: number | null;
}

/** Re-exported for consumers that want the raw duration shape alongside the Thai display string. */
export type { DurationYMD };
