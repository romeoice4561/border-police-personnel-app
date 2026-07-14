import { addDays, compareDates, dateOnly, utcDate } from "@/lib/personnel_calendar";
import { calculateRetirement } from "@/lib/personnel_calendar/retirement";
import { fiscalYearEnd } from "@/lib/personnel_calendar/fiscal_year";
import { summarizeTimeline } from "@/lib/timeline/summary";
import { dedupeTimelineEvents, sortTimelineEvents } from "@/lib/timeline/sort";
import type {
  Timeline,
  TimelineBuilderInput,
  TimelineCategory,
  TimelineEvent,
  TimelineEventType,
  TimelineManualEventInput,
  TimelineOfficerRef,
  TimelineSeverity,
  TimelineSource,
} from "@/lib/timeline/types";

function isFuture(date: Date, asOf: Date): boolean {
  return compareDates(date, asOf) > 0;
}

function eventBase(
  input: {
    id: string;
    type: TimelineEventType;
    date: Date;
    title: string;
    description?: string;
    category: TimelineCategory;
    severity: TimelineSeverity;
    source: TimelineSource;
    officer: TimelineOfficerRef;
    metadata?: Readonly<Record<string, unknown>>;
  },
  asOf: Date
): TimelineEvent {
  const future = isFuture(input.date, asOf);
  return {
    ...input,
    date: dateOnly(input.date),
    future,
    past: !future,
  };
}

function manualToEvent(input: TimelineManualEventInput, officer: TimelineOfficerRef, asOf: Date, fallbackType: TimelineEventType): TimelineEvent {
  return eventBase(
    {
      id: input.id,
      type: fallbackType,
      date: input.date,
      title: input.title,
      description: input.description,
      category: input.category ?? "manual",
      severity: input.severity ?? "neutral",
      source: input.source ?? "manual",
      officer,
      metadata: input.metadata,
    },
    asOf
  );
}

function salaryReviewDate(fiscalYear: number, reviewCycle: string): Date {
  if (reviewCycle === "APRIL") return utcDate(fiscalYear, 4, 1);
  if (reviewCycle === "OCTOBER") return utcDate(fiscalYear - 1, 10, 1);
  return fiscalYearEnd(fiscalYear);
}

export function buildTimelineEvents(input: TimelineBuilderInput): TimelineEvent[] {
  const asOf = dateOnly(input.asOf ?? new Date());
  const officer = input.officer;
  const events: TimelineEvent[] = [];

  if (officer.createdAt) {
    events.push(eventBase({
      id: `${officer.officerId}:officer-created`,
      type: "OFFICER_CREATED",
      date: officer.createdAt,
      title: "Officer record created",
      category: "system",
      severity: "neutral",
      source: "officer",
      officer,
    }, asOf));
  }

  if (officer.governmentServiceStartDate) {
    events.push(eventBase({
      id: `${officer.officerId}:government-service-started`,
      type: "GOVERNMENT_SERVICE_STARTED",
      date: officer.governmentServiceStartDate,
      title: "Government service started",
      category: "career",
      severity: "success",
      source: "personnel_calendar",
      officer,
    }, asOf));
  }

  for (const row of input.career ?? []) {
    if (!row.date) continue;
    const title = row.position ? `Position: ${row.position}` : "Career timeline entry";
    events.push(eventBase({
      id: `${officer.officerId}:career:${row.id}`,
      type: "POSITION_CHANGE",
      date: row.date,
      title,
      description: row.rank ? `Rank: ${row.rank}` : undefined,
      category: "career",
      severity: row.isPresent ? "success" : "info",
      source: "career_timeline",
      officer,
      metadata: {
        rank: row.rank,
        position: row.position,
        unit: row.unit,
        organization: row.organization,
        source: row.source,
        isPresent: row.isPresent,
      },
    }, asOf));

    if (row.rank) {
      events.push(eventBase({
        id: `${officer.officerId}:rank:${row.id}`,
        type: "RANK_CHANGE",
        date: row.date,
        title: `Rank changed to ${row.rank}`,
        category: "promotion",
        severity: "info",
        source: "career_timeline",
        officer,
        metadata: { rank: row.rank, position: row.position },
      }, asOf));
    }

    if (row.organization || row.unit) {
      events.push(eventBase({
        id: `${officer.officerId}:organization:${row.id}`,
        type: "ORGANIZATION_CHANGED",
        date: row.date,
        title: `Organization changed to ${row.organization ?? row.unit}`,
        category: "organization",
        severity: "info",
        source: "career_timeline",
        officer,
        metadata: { organization: row.organization, unit: row.unit },
      }, asOf));
    }
  }

  const promotion = input.promotionResult;
  if (promotion) {
    const title = promotion.eligible ? "Promotion eligibility available" : "Promotion eligibility requires action";
    events.push(eventBase({
      id: `${officer.officerId}:promotion-evaluation`,
      type: promotion.eligible ? "UPCOMING_ELIGIBILITY" : "PROMOTION",
      date: asOf,
      title,
      description: promotion.suggestedNextSteps.map((step) => step.label).join(" ") || undefined,
      category: "promotion",
      severity: promotion.eligible ? "success" : "warning",
      source: "promotion_engine",
      officer,
      metadata: { score: promotion.score, maxScore: promotion.maxScore, eligible: promotion.eligible },
    }, asOf));
  }

  for (const record of input.salaryHistory ?? []) {
    events.push(eventBase({
      id: `${officer.officerId}:salary:${record.fiscalYear}:${record.reviewCycle}`,
      type: "SALARY_STEP",
      date: salaryReviewDate(record.fiscalYear, record.reviewCycle),
      title: `Salary step: ${record.stepsAwarded}`,
      description: record.remarks ?? undefined,
      category: "salary",
      severity: record.awardType === "SKIPPED" ? "warning" : record.awardType === "DOUBLE_STEP" ? "success" : "info",
      source: "salary_step_engine",
      officer,
      metadata: { ...record },
    }, asOf));
  }

  if (input.salaryStepResult) {
    const nextReview = salaryReviewDate(input.salaryStepResult.fiscalYear, "OCTOBER");
    if (compareDates(nextReview, asOf) >= 0) {
      events.push(eventBase({
        id: `${officer.officerId}:salary-review:${input.salaryStepResult.fiscalYear}`,
        type: "FUTURE_EVENT",
        date: nextReview,
        title: "Expected salary-step review",
        description: input.salaryStepResult.suggestedActions.map((action) => action.label).join(" ") || undefined,
        category: "salary",
        severity: input.salaryStepResult.manualReview ? "warning" : "info",
        source: "salary_step_engine",
        officer,
        metadata: { eligibility: input.salaryStepResult.eligibility },
      }, asOf));
    }
  }

  for (const training of input.training ?? []) {
    const date = training.date ?? (typeof training.year === "number" ? utcDate(training.year, 1, 1) : null);
    if (date) {
      events.push(eventBase({
        id: `${officer.officerId}:training:${training.id}`,
        type: "TRAINING",
        date,
        title: training.title,
        description: training.organization ?? undefined,
        category: "training",
        severity: "info",
        source: "training",
        officer,
        metadata: { ...training },
      }, asOf));
    }
    if (training.expiresAt) {
      events.push(eventBase({
        id: `${officer.officerId}:training-expiration:${training.id}`,
        type: "FUTURE_EVENT",
        date: training.expiresAt,
        title: `Training expires: ${training.title}`,
        category: "training",
        severity: "warning",
        source: "training",
        officer,
        metadata: { ...training },
      }, asOf));
    }
  }

  for (const award of input.awards ?? []) {
    const date = award.awardedAt ?? award.date;
    if (!date) continue;
    events.push(eventBase({
      id: `${officer.officerId}:award:${award.id}`,
      type: "AWARD",
      date,
      title: award.title,
      description: award.remarks ?? undefined,
      category: "award",
      severity: "success",
      source: "award",
      officer,
      metadata: { ...award },
    }, asOf));
  }

  for (const document of input.documents ?? []) {
    if (document.uploadedAt) {
      events.push(eventBase({
        id: `${officer.officerId}:document-uploaded:${document.id}`,
        type: "DOCUMENT_UPLOADED",
        date: document.uploadedAt,
        title: `Document uploaded: ${document.title}`,
        category: "document",
        severity: document.isActive === false ? "neutral" : "info",
        source: "document",
        officer,
        metadata: { ...document },
      }, asOf));
    }
    if (document.updatedAt && (!document.uploadedAt || compareDates(document.updatedAt, document.uploadedAt) !== 0)) {
      events.push(eventBase({
        id: `${officer.officerId}:document-updated:${document.id}`,
        type: "DOCUMENT_UPDATED",
        date: document.updatedAt,
        title: `Document updated: ${document.title}`,
        category: "document",
        severity: "info",
        source: "document",
        officer,
        metadata: { ...document },
      }, asOf));
    }
    if (document.expiresAt) {
      events.push(eventBase({
        id: `${officer.officerId}:document-expiration:${document.id}`,
        type: "FUTURE_EVENT",
        date: document.expiresAt,
        title: `Document expires: ${document.title}`,
        category: "document",
        severity: "warning",
        source: "document",
        officer,
        metadata: { ...document },
      }, asOf));
    }
  }

  for (const portrait of input.portraits ?? []) {
    const date = portrait.updatedAt ?? portrait.createdAt;
    if (!date) continue;
    events.push(eventBase({
      id: `${officer.officerId}:portrait:${portrait.id}`,
      type: "OFFICIAL_PORTRAIT_UPDATED",
      date,
      title: portrait.title ?? (portrait.isOfficial ? "Official portrait updated" : "Portrait updated"),
      category: "portrait",
      severity: portrait.isOfficial ? "success" : "info",
      source: "portrait",
      officer,
      metadata: { ...portrait },
    }, asOf));
  }

  const retirement = calculateRetirement(officer.dateOfBirth ?? null, asOf);
  if (retirement) {
    events.push(eventBase({
      id: `${officer.officerId}:retirement-eligible`,
      type: "RETIREMENT_ELIGIBLE",
      date: retirement.sixtiethBirthday,
      title: "Retirement eligibility date",
      category: "retirement",
      severity: "warning",
      source: "personnel_calendar",
      officer,
      metadata: { retirementAge: retirement.retirementAge },
    }, asOf));
    events.push(eventBase({
      id: `${officer.officerId}:retirement`,
      type: "RETIREMENT",
      date: retirement.retirementDate,
      title: "Government retirement date",
      category: "retirement",
      severity: retirement.isRetired ? "critical" : "warning",
      source: "personnel_calendar",
      officer,
      metadata: { fiscalYear: retirement.retirementFiscalYear, remaining: retirement.remaining },
    }, asOf));
  }

  for (const event of input.manualEvents ?? []) {
    events.push(manualToEvent(event, officer, asOf, "MANUAL_EVENT"));
  }
  for (const event of input.futureEvents ?? []) {
    events.push(manualToEvent(event, officer, asOf, "FUTURE_EVENT"));
  }

  if (input.salaryStepResult) {
    events.push(eventBase({
      id: `${officer.officerId}:salary-review-next-cycle`,
      type: "FUTURE_EVENT",
      date: addDays(asOf, 90),
      title: "Upcoming salary-step intelligence review",
      category: "salary",
      severity: "info",
      source: "salary_step_engine",
      officer,
      metadata: { eligibility: input.salaryStepResult.eligibility },
    }, asOf));
  }

  return sortTimelineEvents(dedupeTimelineEvents(events), "asc");
}

export function buildPersonnelTimeline(input: TimelineBuilderInput): Timeline {
  const events = buildTimelineEvents(input);
  return {
    officer: input.officer,
    events,
    summary: summarizeTimeline(events),
  };
}
