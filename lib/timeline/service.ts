import type { OfficerWithRelations } from "@/lib/database/query_types";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { officerFullName } from "@/lib/ui/officer_summary";
import { adaptAnnualSalaryHistory } from "@/lib/salary_step";
import { buildPersonnelTimeline } from "@/lib/timeline/builder";
import type { Timeline, TimelineBuilderInput } from "@/lib/timeline/types";

function firstTimelineDate(officer: OfficerWithRelations): Date | null {
  const dates = officer.timeline
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

export type BuildOfficerTimelineOptions = Omit<TimelineBuilderInput, "officer" | "career" | "salaryHistory" | "training" | "documents">;

export function buildOfficerTimeline(officer: OfficerWithRelations, options: BuildOfficerTimelineOptions = {}): Timeline {
  return buildPersonnelTimeline({
    ...options,
    officer: {
      officerId: officer.officerId,
      displayName: officerFullName(officer),
      rank: officer.rank,
      organization: officer.currentUnit,
      createdAt: officer.createdAt,
      dateOfBirth: officer.dateOfBirth,
      governmentServiceStartDate: firstTimelineDate(officer),
    },
    career: officer.timeline.map((row) => ({
      id: row.id,
      date: toEffectiveDate(row),
      rank: row.rank,
      position: row.position,
      unit: row.unit,
      organization: row.unit,
      source: row.source,
      isPresent: row.isPresent,
    })),
    salaryHistory: adaptAnnualSalaryHistory(officer.salaryHistory, {
      awardTypeForStep: (steps) => (steps >= 2 ? "DOUBLE_STEP" : "NORMAL"),
    }),
    training: officer.training.map((row) => ({
      id: row.id,
      title: row.course,
      year: row.year,
      organization: row.organization,
    })),
    documents: officer.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      title: doc.title,
      uploadedAt: doc.uploadedAt,
      updatedAt: doc.updatedAt,
      verifiedAt: doc.verifiedAt,
      isActive: doc.isActive,
    })),
  });
}
