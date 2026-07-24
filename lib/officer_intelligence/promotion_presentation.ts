/**
 * Promotion Intelligence presentation (Phase 49.12).
 *
 * Pure Profile-facing view-model over already-composed
 * OfficerIntelligenceViewModel promotion/identity/service fields.
 * No React, no Date.now/new Date, no policy lookup, no eligibility or
 * tenure recalculation, no ordinal ±1 repairs.
 */
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { MissingEvidenceKey } from "@/lib/promotion/eligibility_policy";

export type PromotionPresentationTone = "good" | "warning" | "serious" | "neutral";

export type RequirementPresentationState = "complete" | "missing" | "unknown" | "blocked";

export type TimelinePresentationState = "past" | "current" | "future" | "unknown";

export type PromotionRequirementPresentation = {
  key: string;
  labelTh: string;
  state: RequirementPresentationState;
  detailTh: string;
};

export type PromotionTimelinePresentation = {
  key: string;
  yearLabel: string;
  titleTh: string;
  detailTh?: string;
  state: TimelinePresentationState;
};

export type PromotionIntelligencePresentation = {
  statusTone: PromotionPresentationTone;
  statusLabelTh: string;
  statusHeadlineTh: string;
  statusSummaryTh: string;

  currentLevelLabel: string | null;
  targetLevelLabel: string | null;
  hasTarget: boolean;

  positionLevelStartLabel: string | null;
  completedTenureLabel: string | null;
  requiredTenureLabel: string | null;
  remainingTenureLabel: string;

  progressCurrent: number | null;
  progressRequired: number | null;
  progressPercent: number | null;
  progressLabelTh: string | null;

  /** Top KPI row — all display-ready; React must not recalculate. */
  kpiStatusLabelTh: string;
  kpiFirstEligibleYearLabel: string;
  /** Percentage only (e.g. "100%") — tenure progress, not appointment odds. */
  kpiReadinessLabel: string;
  kpiRemainingTenureLabel: string;
  /** Clarifies 100% = tenure criterion met, not guaranteed appointment. */
  readinessMeaningTh: string | null;

  firstEligibleYearLabel: string;
  eligibilityYearOrdinalLabel: string | null;
  appointmentRoundLabel: string | null;
  waitingLabel: string | null;

  confidenceLabelTh: string | null;
  reasonTh: string;
  recommendedActionTh: string;

  requirementItems: PromotionRequirementPresentation[];
  requirementsEmptyMessageTh: string | null;
  timelineItems: PromotionTimelinePresentation[];

  /** Compact header KPIs — same object as the detailed card. */
  headerTenureLabelTh: string | null;
  headerQualificationTh: string;
  headerStatusLabelTh: string;
  headerStatusTone: PromotionPresentationTone;
};

const ASSESS_UNAVAILABLE = "ประเมินไม่ได้";
const NO_TARGET = "ไม่มีระดับเป้าหมายถัดไปในข้อมูลปัจจุบัน";

type PresentationInput = Pick<OfficerIntelligenceViewModel, "asOfDate" | "identity" | "service" | "promotion">;

function buddhistYearFromAsOfDate(asOfDate: string): number | null {
  const gregorian = Number(asOfDate.slice(0, 4));
  if (!Number.isFinite(gregorian) || gregorian < 1900) return null;
  return gregorian + 543;
}

function isYearOnlyAnchor(isoDate: string | null): boolean {
  return isoDate != null && /^\d{4}-01-01$/.test(isoDate);
}

function statusToneFor(status: PromotionEligibilityStatus, available: boolean): PromotionPresentationTone {
  if (!available) return "neutral";
  switch (status) {
    case "EligibleThisYear":
      return "good";
    case "AlreadyEligible":
      return "warning";
    case "Waiting":
    case "NotEligible":
      return "warning";
    case "MissingTraining":
    case "MissingDocuments":
    case "RetirementRestricted":
      return "serious";
    case "Unknown":
    default:
      return "neutral";
  }
}

function profileStatusLabel(
  status: PromotionEligibilityStatus,
  available: boolean,
  hasTarget: boolean
): string {
  if (!available || status === "Unknown") return "ข้อมูลยังไม่เพียงพอ";
  if (!hasTarget && (status === "NotEligible" || status === "Waiting")) return NO_TARGET;
  switch (status) {
    case "EligibleThisYear":
      return "ครบคุณสมบัติในปีนี้";
    case "AlreadyEligible":
      return "ครบคุณสมบัติมาแล้ว";
    case "Waiting":
    case "NotEligible":
      return "ยังไม่ครบคุณสมบัติ";
    case "MissingTraining":
      return "ขาดคุณสมบัติด้านการฝึกอบรม";
    case "MissingDocuments":
      return "ขาดเอกสารประกอบการพิจารณา";
    case "RetirementRestricted":
      return "ใกล้เกษียณอายุราชการ";
    default:
      return "ข้อมูลยังไม่เพียงพอ";
  }
}

function requirementDetail(state: RequirementPresentationState): string {
  switch (state) {
    case "complete":
      return "ครบแล้ว";
    case "missing":
      return "ยังขาด";
    case "unknown":
      return "ยังไม่มีข้อมูลเพียงพอ";
    case "blocked":
      return "มีข้อจำกัด";
  }
}

function buildRequirementItems(promotion: OfficerIntelligenceViewModel["promotion"]): {
  items: PromotionRequirementPresentation[];
  emptyMessage: string | null;
} {
  const items: PromotionRequirementPresentation[] = [];
  const missing = new Set<MissingEvidenceKey>(promotion.missingEvidence);
  const status = promotion.status;
  const tenureAssessable = promotion.available && status !== "Unknown";

  // Level-start evidence
  if (missing.has("current_position_level_start_date")) {
    items.push({
      key: "level_start",
      labelTh: "ข้อมูลเริ่มดำรงระดับ",
      state: "unknown",
      detailTh: requirementDetail("unknown"),
    });
  }

  // Tenure
  if (!tenureAssessable || missing.has("current_position_level_start_date")) {
    items.push({
      key: "tenure",
      labelTh: "ระยะเวลาดำรงระดับ",
      state: "unknown",
      detailTh: requirementDetail("unknown"),
    });
  } else if (status === "EligibleThisYear" || status === "AlreadyEligible") {
    items.push({
      key: "tenure",
      labelTh: "ระยะเวลาดำรงระดับ",
      state: "complete",
      detailTh: requirementDetail("complete"),
    });
  } else if (status === "Waiting" || status === "NotEligible") {
    items.push({
      key: "tenure",
      labelTh: "ระยะเวลาดำรงระดับ",
      state: "missing",
      detailTh: requirementDetail("missing"),
    });
  }

  // Training — only when engine surfaces it
  if (status === "MissingTraining") {
    items.push({
      key: "training",
      labelTh: "หลักสูตร",
      state: "blocked",
      detailTh: requirementDetail("blocked"),
    });
  } else if (missing.has("training_data")) {
    items.push({
      key: "training",
      labelTh: "หลักสูตร",
      state: "unknown",
      detailTh: requirementDetail("unknown"),
    });
  }

  // Documents
  if (status === "MissingDocuments") {
    items.push({
      key: "documents",
      labelTh: "เอกสารประกอบ",
      state: "missing",
      detailTh: requirementDetail("missing"),
    });
  } else if (missing.has("document_data")) {
    items.push({
      key: "documents",
      labelTh: "เอกสารประกอบ",
      state: "unknown",
      detailTh: requirementDetail("unknown"),
    });
  }

  // Retirement
  if (status === "RetirementRestricted") {
    items.push({
      key: "retirement",
      labelTh: "ข้อจำกัดก่อนเกษียณ",
      state: "blocked",
      detailTh: requirementDetail("blocked"),
    });
  } else if (missing.has("retirement_data")) {
    items.push({
      key: "retirement",
      labelTh: "อายุราชการ",
      state: "unknown",
      detailTh: requirementDetail("unknown"),
    });
  }

  // Other engine blockers already listed on the VM (string form)
  for (const blocker of promotion.blockers) {
    const already =
      (blocker.includes("หลักสูตร") && items.some((i) => i.key === "training")) ||
      (blocker.includes("เอกสาร") && items.some((i) => i.key === "documents")) ||
      (blocker.includes("เกษียณ") && items.some((i) => i.key === "retirement"));
    if (!already) {
      items.push({
        key: `blocker:${blocker}`,
        labelTh: blocker,
        state: "blocked",
        detailTh: requirementDetail("blocked"),
      });
    }
  }

  const hasOpenGap = items.some((i) => i.state !== "complete");
  if (!hasOpenGap && tenureAssessable && (status === "EligibleThisYear" || status === "AlreadyEligible")) {
    return { items, emptyMessage: "ไม่มีข้อจำกัดที่ระบบตรวจพบ" };
  }
  if (items.length === 0) {
    return { items, emptyMessage: "ไม่มีข้อจำกัดที่ระบบตรวจพบ" };
  }
  return { items, emptyMessage: null };
}

function buildTimeline(input: {
  currentLevel: string | null;
  startYearBe: number | null;
  firstEligibleYearBe: number | null;
  appointmentYearBe: number | null;
  status: PromotionEligibilityStatus;
  available: boolean;
  eligibilityYearNumber: number | null;
  waitingYears: number | null;
  yearsInLevel: number | null;
  requiredYears: number | null;
  remainingLabel: string;
}): PromotionTimelinePresentation[] {
  const items: PromotionTimelinePresentation[] = [];
  const levelName = input.currentLevel ?? "ระดับปัจจุบัน";

  if (input.startYearBe != null) {
    items.push({
      key: "start",
      yearLabel: `พ.ศ. ${input.startYearBe}`,
      titleTh: `เริ่มดำรงระดับ${levelName}`,
      state: "past",
    });
  }

  if (input.firstEligibleYearBe != null && input.available && input.status !== "Unknown") {
    const notYet = input.status === "Waiting" || input.status === "NotEligible";
    items.push({
      key: "first_eligible",
      yearLabel: `พ.ศ. ${input.firstEligibleYearBe}`,
      titleTh: notYet ? "คาดว่าจะครบคุณสมบัติครั้งแรก" : "ครบคุณสมบัติครั้งแรก",
      state: notYet ? "future" : input.status === "EligibleThisYear" ? "current" : "past",
    });
  }

  if (!input.available || input.status === "Unknown") {
    items.push({
      key: "current",
      yearLabel: "ปัจจุบัน",
      titleTh: "ข้อมูลยังไม่เพียงพอสำหรับการประเมิน",
      state: "current",
    });
    return items;
  }

  if (input.status === "EligibleThisYear" || input.status === "AlreadyEligible") {
    const ordinal = input.eligibilityYearNumber != null && input.eligibilityYearNumber > 0 ? input.eligibilityYearNumber : null;
    const parts: string[] = [];
    if (ordinal != null) parts.push(`ปีที่ ${ordinal}`);
    if (ordinal != null) parts.push(`รอบที่ ${ordinal}`);
    if (input.waitingYears != null && input.waitingYears > 0) {
      parts.push(`รอการพิจารณามาแล้ว ${input.waitingYears} ปี`);
    }
    const yearLabel =
      input.appointmentYearBe != null ? `พ.ศ. ${input.appointmentYearBe}` : "ปัจจุบัน";
    items.push({
      key: "current",
      yearLabel,
      titleTh: parts.length > 0 ? parts.join(" · ") : "ครบคุณสมบัติในปีนี้",
      state: "current",
    });
    return items;
  }

  if (input.yearsInLevel != null && input.requiredYears != null) {
    items.push({
      key: "current",
      yearLabel: "ปัจจุบัน",
      titleTh: `ดำรงระดับมาแล้ว ${input.yearsInLevel} จาก ${input.requiredYears} ปี`,
      detailTh: input.remainingLabel,
      state: "current",
    });
  } else {
    items.push({
      key: "current",
      yearLabel: "ปัจจุบัน",
      titleTh: input.remainingLabel,
      state: "current",
    });
  }

  return items;
}

function buildReason(input: {
  status: PromotionEligibilityStatus;
  available: boolean;
  currentLevel: string | null;
  targetLevel: string | null;
  requiredYears: number | null;
  yearsHeld: number | null;
  remainingYears: number | null;
  firstEligibleYearBe: number | null;
  appointmentYearBe: number | null;
  eligibilityYearNumber: number | null;
  waitingYears: number | null;
  engineReason: string | null;
  confidenceReason: string | null;
}): string {
  const {
    status,
    available,
    currentLevel,
    targetLevel,
    requiredYears,
    yearsHeld,
    remainingYears,
    firstEligibleYearBe,
    appointmentYearBe,
    eligibilityYearNumber,
    waitingYears,
    engineReason,
    confidenceReason,
  } = input;

  if (!available || status === "Unknown") {
    return (
      confidenceReason ??
      "ยังไม่สามารถประเมินคุณสมบัติด้านระยะเวลาได้ เนื่องจากไม่มีข้อมูลปีเริ่มดำรงระดับตำแหน่งที่เพียงพอ"
    );
  }

  if (status === "AlreadyEligible" && firstEligibleYearBe != null && eligibilityYearNumber != null && waitingYears != null) {
    return `ครบคุณสมบัติด้านระยะเวลาตั้งแต่ พ.ศ. ${firstEligibleYearBe} ปัจจุบันอยู่ในปีที่ ${eligibilityYearNumber} ของการมีสิทธิ์ และรอการพิจารณามาแล้ว ${waitingYears} ปี`;
  }

  if (status === "EligibleThisYear" && currentLevel && targetLevel && requiredYears != null) {
    const roundYear = appointmentYearBe ?? firstEligibleYearBe;
    const roundPart = roundYear != null ? `ในรอบ พ.ศ. ${roundYear}` : "";
    return `ดำรงระดับ${currentLevel}ครบเกณฑ์ ${requiredYears} ปีแล้ว จึงมีคุณสมบัติด้านระยะเวลาสำหรับการพิจารณาเลื่อนเป็น${targetLevel}${roundPart}`;
  }

  if (
    (status === "Waiting" || status === "NotEligible") &&
    currentLevel &&
    requiredYears != null &&
    yearsHeld != null &&
    remainingYears != null &&
    remainingYears > 0
  ) {
    return `ดำรงระดับ${currentLevel}มาแล้ว ${yearsHeld} ปี จากเกณฑ์ ${requiredYears} ปี เหลืออีกประมาณ ${remainingYears} ปี จึงจะครบคุณสมบัติด้านระยะเวลา`;
  }

  // Prefer engine wording for training/docs/retirement — strip any legacy "วาระ".
  if (engineReason) return engineReason.replaceAll("วาระ", "ปี");
  return confidenceReason ?? "สรุปเพื่อการพิจารณาจากข้อมูลที่มี";
}

function buildRecommendedAction(input: {
  status: PromotionEligibilityStatus;
  available: boolean;
  missingEvidence: MissingEvidenceKey[];
  appointmentYearBe: number | null;
  firstEligibleYearBe: number | null;
  hasOpenRequirements: boolean;
}): string {
  const { status, available, missingEvidence, appointmentYearBe, firstEligibleYearBe, hasOpenRequirements } = input;
  const roundYear = appointmentYearBe ?? firstEligibleYearBe;
  const roundPhrase = roundYear != null ? `ในรอบ พ.ศ. ${roundYear}` : "";

  if (!available || status === "Unknown" || missingEvidence.includes("current_position_level_start_date")) {
    return "เพิ่มหรือยืนยันข้อมูลปีเริ่มดำรงระดับตำแหน่ง";
  }
  if (missingEvidence.includes("training_data") || status === "MissingTraining") {
    return "ตรวจสอบและเพิ่มข้อมูลการฝึกอบรมที่เกี่ยวข้อง";
  }
  if (missingEvidence.includes("document_data") || status === "MissingDocuments") {
    return "ตรวจสอบและเพิ่มเอกสารประกอบที่จำเป็น";
  }
  if (status === "RetirementRestricted") {
    return "ตรวจสอบเงื่อนไขระยะเวลาก่อนเกษียณอายุราชการก่อนเสนอพิจารณา";
  }
  if (status === "EligibleThisYear" || status === "AlreadyEligible") {
    if (hasOpenRequirements) {
      return `ตรวจสอบหลักสูตรและเอกสารประกอบให้ครบถ้วนก่อนเสนอพิจารณา${roundPhrase}`.trim();
    }
    return `ตรวจสอบความถูกต้องของข้อมูลและเตรียมเสนอพิจารณา${roundPhrase}`.trim();
  }
  if (status === "Waiting" || status === "NotEligible") {
    return "ติดตามระยะเวลาดำรงระดับและปรับปรุงประวัติราชการให้เป็นปัจจุบัน";
  }
  return "ตรวจสอบความถูกต้องของข้อมูลประกอบการพิจารณา";
}

function buildProgress(
  yearsInLevel: number | null,
  requiredYears: number | null,
  assessable: boolean
): Pick<
  PromotionIntelligencePresentation,
  "progressCurrent" | "progressRequired" | "progressPercent" | "progressLabelTh" | "kpiReadinessLabel" | "readinessMeaningTh"
> {
  if (!assessable || yearsInLevel == null || requiredYears == null || requiredYears <= 0) {
    return {
      progressCurrent: null,
      progressRequired: null,
      progressPercent: null,
      progressLabelTh: null,
      kpiReadinessLabel: ASSESS_UNAVAILABLE,
      readinessMeaningTh: null,
    };
  }
  const percent = Math.min(yearsInLevel / requiredYears, 1) * 100;
  const rounded = Math.round(percent);
  return {
    progressCurrent: yearsInLevel,
    progressRequired: requiredYears,
    progressPercent: rounded,
    progressLabelTh: `${yearsInLevel} จาก ${requiredYears} ปี`,
    kpiReadinessLabel: `${rounded}%`,
    readinessMeaningTh:
      rounded >= 100
        ? "ครบเกณฑ์ด้านระยะเวลา — ไม่ใช่การรับรองว่าจะได้รับการแต่งตั้ง"
        : "ความคืบหน้าด้านระยะเวลาดำรงระดับเท่านั้น ไม่ใช่โอกาสได้รับการแต่งตั้ง",
  };
}

/**
 * Build commander-facing promotion presentation from the composed view model.
 */
export function buildPromotionPresentation(viewModel: PresentationInput): PromotionIntelligencePresentation {
  const { identity, service, promotion, asOfDate } = viewModel;
  const currentLevel = identity.positionLevel;
  const targetLevel = promotion.targetPositionTh;
  const hasTarget = targetLevel != null && targetLevel.length > 0;
  const status = promotion.status;
  const available = promotion.available;
  const appointmentYearBe = buddhistYearFromAsOfDate(asOfDate);
  const yearsInLevel = promotion.yearsInCurrentLevel;
  const requiredYears = promotion.requiredTenureYears;
  const remainingYears = promotion.remainingTenureYears;
  const firstEligibleYearBe = promotion.firstEligibleYearBe;
  const eligibilityYearNumber =
    promotion.eligibilityYearNumber != null && promotion.eligibilityYearNumber > 0
      ? promotion.eligibilityYearNumber
      : null;
  const waitingYears = promotion.waitingYears;
  const isIncomplete = !available || status === "Unknown";
  const isEligible = status === "EligibleThisYear" || status === "AlreadyEligible";
  const assessableTenure = !isIncomplete && requiredYears != null && yearsInLevel != null;

  const statusLabelTh = profileStatusLabel(status, available, hasTarget);
  const statusTone = statusToneFor(status, available);

  const remainingTenureLabel =
    promotion.displayRemainingTenureTh ??
    (isIncomplete
      ? ASSESS_UNAVAILABLE
      : isEligible
        ? "ครบเกณฑ์แล้ว"
        : remainingYears != null && remainingYears > 0
          ? `ประมาณ ${remainingYears} ปี`
          : ASSESS_UNAVAILABLE);

  const progress = buildProgress(yearsInLevel, requiredYears, assessableTenure);

  const firstEligibleYearLabel =
    !isIncomplete && firstEligibleYearBe != null ? `พ.ศ. ${firstEligibleYearBe}` : ASSESS_UNAVAILABLE;

  const eligibilityYearOrdinalLabel =
    isEligible && eligibilityYearNumber != null ? `ปีที่ ${eligibilityYearNumber}` : null;
  const appointmentRoundLabel =
    isEligible && eligibilityYearNumber != null ? `รอบที่ ${eligibilityYearNumber}` : null;

  let waitingLabel: string | null = null;
  if (status === "EligibleThisYear") {
    waitingLabel = "ครบคุณสมบัติในปีนี้";
  } else if (status === "AlreadyEligible" && waitingYears != null) {
    waitingLabel = `รอการพิจารณามาแล้ว ${waitingYears} ปี`;
  }

  const yearOnly =
    service.currentPositionLevelStartYearBe != null &&
    (promotion.firstEligibleDate == null || isYearOnlyAnchor(promotion.firstEligibleDate));

  let confidenceLabelTh: string | null = null;
  if (promotion.confidence === "incomplete") {
    confidenceLabelTh = "ข้อมูลไม่ครบ";
  } else if (promotion.confidence === "unknown") {
    confidenceLabelTh = "ประเมินไม่ได้";
  } else if (promotion.confidence === "derived") {
    confidenceLabelTh = yearOnly ? "ประเมินจากข้อมูลรายปี" : "ประเมินจากข้อมูลที่มี";
  } else if (promotion.confidence === "confirmed" && yearOnly) {
    confidenceLabelTh = "ประเมินจากข้อมูลรายปี";
  }

  const reasonTh = buildReason({
    status,
    available,
    currentLevel,
    targetLevel,
    requiredYears,
    yearsHeld: yearsInLevel,
    remainingYears,
    firstEligibleYearBe,
    appointmentYearBe,
    eligibilityYearNumber,
    waitingYears,
    engineReason: promotion.displayReasonTh ?? promotion.waitingReasonTh,
    confidenceReason: promotion.confidenceReasonTh,
  });

  const { items: requirementItems, emptyMessage: requirementsEmptyMessageTh } = buildRequirementItems(promotion);
  const hasOpenRequirements = requirementItems.some((i) => i.state !== "complete");

  const recommendedActionTh = buildRecommendedAction({
    status,
    available,
    missingEvidence: promotion.missingEvidence,
    appointmentYearBe,
    firstEligibleYearBe,
    hasOpenRequirements,
  });

  const timelineItems = buildTimeline({
    currentLevel,
    startYearBe: service.currentPositionLevelStartYearBe,
    firstEligibleYearBe,
    appointmentYearBe,
    status,
    available,
    eligibilityYearNumber,
    waitingYears,
    yearsInLevel,
    requiredYears,
    remainingLabel: remainingTenureLabel,
  });

  let statusHeadlineTh: string;
  let statusSummaryTh: string;
  if (isIncomplete) {
    statusHeadlineTh = "ยังไม่สามารถประเมินคุณสมบัติด้านระยะเวลาได้";
    statusSummaryTh =
      "ยังไม่สามารถประเมินคุณสมบัติด้านระยะเวลาได้ เนื่องจากข้อมูลเริ่มดำรงระดับตำแหน่งยังไม่ครบถ้วน";
  } else if (!hasTarget) {
    statusHeadlineTh = NO_TARGET;
    statusSummaryTh = NO_TARGET;
  } else if (status === "EligibleThisYear") {
    statusHeadlineTh =
      appointmentYearBe != null
        ? `มีคุณสมบัติด้านระยะเวลาในรอบ พ.ศ. ${appointmentYearBe}`
        : "มีคุณสมบัติด้านระยะเวลา";
    statusSummaryTh =
      currentLevel && requiredYears != null && targetLevel
        ? `ดำรงระดับ${currentLevel}ครบเกณฑ์ ${requiredYears} ปีแล้ว สำหรับการพิจารณาเลื่อนเป็น${targetLevel}`
        : reasonTh;
  } else if (status === "AlreadyEligible") {
    statusHeadlineTh =
      firstEligibleYearBe != null && eligibilityYearNumber != null
        ? `ครบคุณสมบัติตั้งแต่ พ.ศ. ${firstEligibleYearBe} · ปีที่ ${eligibilityYearNumber}`
        : "ครบคุณสมบัติด้านระยะเวลามาแล้ว";
    statusSummaryTh =
      firstEligibleYearBe != null && eligibilityYearNumber != null
        ? `ครบคุณสมบัติตั้งแต่ พ.ศ. ${firstEligibleYearBe} ปัจจุบันอยู่ในปีที่ ${eligibilityYearNumber} ของการมีสิทธิ์`
        : reasonTh;
  } else if (status === "Waiting" || status === "NotEligible") {
    statusHeadlineTh = "อยู่ระหว่างสะสมระยะเวลาดำรงระดับ";
    statusSummaryTh =
      yearsInLevel != null && requiredYears != null && remainingYears != null
        ? `ดำรงระดับ${currentLevel ?? ""}มาแล้ว ${yearsInLevel} ปี จากเกณฑ์ ${requiredYears} ปี เหลืออีกประมาณ ${remainingYears} ปี`
        : reasonTh;
  } else {
    statusHeadlineTh = statusLabelTh;
    statusSummaryTh = reasonTh;
  }

  const headerQualificationTh = isIncomplete
    ? ASSESS_UNAVAILABLE
    : isEligible
      ? "ครบเกณฑ์ด้านระยะเวลา"
      : remainingYears != null && remainingYears > 0
        ? `เหลืออีกประมาณ ${remainingYears} ปี`
        : remainingTenureLabel;

  return {
    statusTone,
    statusLabelTh,
    statusHeadlineTh,
    statusSummaryTh,
    currentLevelLabel: currentLevel,
    targetLevelLabel: targetLevel,
    hasTarget,
    positionLevelStartLabel:
      service.currentPositionLevelStartYearBe != null
        ? `พ.ศ. ${service.currentPositionLevelStartYearBe}`
        : null,
    completedTenureLabel: yearsInLevel != null ? `${yearsInLevel} ปี` : null,
    requiredTenureLabel: requiredYears != null ? `${requiredYears} ปี` : null,
    remainingTenureLabel,
    ...progress,
    kpiStatusLabelTh: statusLabelTh,
    kpiFirstEligibleYearLabel: firstEligibleYearLabel,
    kpiRemainingTenureLabel: remainingTenureLabel,
    firstEligibleYearLabel,
    eligibilityYearOrdinalLabel,
    appointmentRoundLabel,
    waitingLabel,
    confidenceLabelTh,
    reasonTh,
    recommendedActionTh,
    requirementItems,
    requirementsEmptyMessageTh,
    timelineItems,
    headerTenureLabelTh: yearsInLevel != null ? `${yearsInLevel} ปี` : null,
    headerQualificationTh,
    headerStatusLabelTh: statusLabelTh,
    headerStatusTone: statusTone,
  };
}
