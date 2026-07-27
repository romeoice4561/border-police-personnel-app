/**
 * Commander Promotion Intelligence — single aggregation pass (Phase 50).
 *
 * Consumes CommanderQueryDataset only. No PromotionSummary recompute, no
 * retirement engine call, no React.
 */
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import { currentPromotionCycle } from "@/lib/promotion_cycle";
import { buildOfficerProfileUrl } from "@/lib/integration/navigation/drilldown_contract";
import {
  computeTenureReadinessPercent,
  readinessBandFromPercent,
  READINESS_BAND_LABEL_TH,
  READINESS_BAND_ORDER,
} from "@/lib/commander_promotion/readiness";
import { assignExecutivePriority, prioritySortOrder } from "@/lib/commander_promotion/priority";
import { computeFilteredQuickStats } from "@/lib/commander_promotion/quick_stats";
import {
  BLOCKER_LABEL_TH,
  PRIORITY_LABEL_TH,
  type ActionItemView,
  type BlockerKey,
  type CommanderPromotionViewModel,
  type CountDrilldown,
  type ExecutiveBucket,
  type ForecastBucketView,
  type InsightCardView,
  type OrgComparisonRow,
  type PreparedPromotionRow,
  type QueueItemView,
  type RetirementWindow,
  type TimelineYearView,
  type WatchlistCategoryView,
} from "@/lib/commander_promotion/types";
import {
  CPI_STATUS_LABEL_TH,
  EXECUTIVE_BUCKET_LABEL_TH,
} from "@/lib/commander_promotion/presentation_labels";

const TOP_N = 5;
const QUEUE_LIMIT = 40;

function compareThai(a: string, b: string): number {
  return a.localeCompare(b, "th");
}

function bucketOf(
  officer: CommanderQueryOfficer,
  appointmentYearBe: number
): ExecutiveBucket {
  const promo = officer.promotionIntelligence;
  const target = promo.targetPosition ?? promo.targetLevel;
  if (target == null || target === "") return "noTarget";

  const missingStart = promo.missingEvidence.includes("current_position_level_start_date");
  if (promo.promotionStatus === "Unknown" || missingStart) return "incomplete";

  if (promo.promotionStatus === "EligibleThisYear") return "eligibleThisYear";
  if (promo.promotionStatus === "AlreadyEligible") return "alreadyEligible";

  const tenureTrack =
    promo.promotionStatus === "Waiting" ||
    promo.promotionStatus === "NotEligible" ||
    promo.promotionStatus === "MissingTraining" ||
    promo.promotionStatus === "MissingDocuments" ||
    promo.promotionStatus === "RetirementRestricted";

  if (tenureTrack) {
    const remaining = promo.remainingTenureYears;
    const first = promo.firstEligibleYearBe;
    if (remaining === 1 || (first != null && first === appointmentYearBe + 1)) return "nextYear";
    return "notYetEligible";
  }

  return "notYetEligible";
}

function retirementWindowOf(officer: CommanderQueryOfficer, appointmentYearBe: number): {
  window: RetirementWindow;
  remainingYears: number | null;
  unknown: boolean;
} {
  if (officer.retirementStatus === "unknown" || officer.retirementYearBe == null) {
    return { window: "unknown", remainingYears: null, unknown: true };
  }
  if (officer.retirementStatus === "retired") {
    return { window: "within1", remainingYears: 0, unknown: false };
  }
  const remainingYears = officer.retirementYearBe - appointmentYearBe;
  if (officer.retirementStatus === "retiring_within_1_year" || remainingYears <= 1) {
    return { window: "within1", remainingYears: Math.max(0, remainingYears), unknown: false };
  }
  if (officer.retirementStatus === "retiring_within_2_years" || remainingYears <= 3) {
    return { window: remainingYears <= 3 ? "within3" : "beyond", remainingYears, unknown: false };
  }
  if (remainingYears <= 3) return { window: "within3", remainingYears, unknown: false };
  if (remainingYears <= 5) return { window: "within5", remainingYears, unknown: false };
  return { window: "beyond", remainingYears, unknown: false };
}

function recommendedActionTh(bucket: ExecutiveBucket, status: PromotionEligibilityStatus, blockers: BlockerKey[]): string {
  if (bucket === "alreadyEligible") return "ทบทวนการเสนอพิจารณาเลื่อนระดับ";
  if (bucket === "eligibleThisYear") return "เตรียมเสนอพิจารณาในรอบปีนี้";
  if (blockers.includes("MissingTraining") || status === "MissingTraining") return "ตรวจสอบและเพิ่มข้อมูลหลักสูตร";
  if (blockers.includes("MissingDocuments") || status === "MissingDocuments") return "ตรวจสอบและเพิ่มเอกสารประกอบ";
  if (bucket === "incomplete" || blockers.includes("missingLevelStart")) return "ยืนยันปีเริ่มดำรงระดับตำแหน่ง";
  if (bucket === "nextYear") return "ติดตามระยะเวลาและเตรียมข้อมูลล่วงหน้า";
  if (bucket === "noTarget") return "ตรวจสอบระดับตำแหน่งเป้าหมาย";
  return "ติดตามข้อมูลประวัติราชการให้เป็นปัจจุบัน";
}

function resolveOrgLabels(dataset: CommanderQueryDataset, officer: CommanderQueryOfficer) {
  const region = dataset.options.regions.find((r) => r.id === officer.regionId);
  const division = dataset.options.battalions.find((b) => b.id === officer.battalionId);
  const company = dataset.options.companies.find((c) => c.id === officer.companyId);
  return {
    regionKey: officer.regionId != null ? String(officer.regionId) : null,
    regionLabel: region?.label ?? "ไม่ระบุภาค",
    divisionKey: officer.battalionId != null ? String(officer.battalionId) : null,
    divisionLabel: division?.label ?? "ไม่ระบุกองกำกับการ",
    companyKey: officer.companyId != null ? String(officer.companyId) : null,
    companyLabel: company?.label ?? officer.companyLabel ?? officer.currentUnit ?? "ไม่ระบุกองร้อย",
  };
}

function prepareRow(officer: CommanderQueryOfficer, dataset: CommanderQueryDataset, appointmentYearBe: number): PreparedPromotionRow {
  const promo = officer.promotionIntelligence;
  const org = resolveOrgLabels(dataset, officer);
  const bucket = bucketOf(officer, appointmentYearBe);
  const completed = officer.positionLevelYearCount;
  const required = promo.requiredTenureYears;
  const readinessPercent = computeTenureReadinessPercent(completed, required);
  const readinessBand = readinessBandFromPercent(readinessPercent);
  const retirement = retirementWindowOf(officer, appointmentYearBe);

  const hasUnknownPositionHistory =
    promo.missingEvidence.includes("current_position_level_start_date") || officer.positionLevelStartYearBe == null;
  const hasMissingTraining =
    promo.promotionStatus === "MissingTraining" || promo.missingEvidence.includes("training_data");
  const hasMissingDocuments =
    promo.promotionStatus === "MissingDocuments" ||
    promo.missingEvidence.includes("document_data") ||
    officer.documentIntelligence.missingRequiredCount > 0;

  const blockerKeys: BlockerKey[] = [];
  if (bucket === "noTarget") blockerKeys.push("noTarget");
  if (promo.promotionStatus === "Unknown") blockerKeys.push("Unknown");
  if (hasUnknownPositionHistory) blockerKeys.push("missingLevelStart");
  if (hasMissingTraining) blockerKeys.push("MissingTraining");
  if (hasMissingDocuments) blockerKeys.push("MissingDocuments");
  if (promo.promotionStatus === "RetirementRestricted") blockerKeys.push("RetirementRestricted");

  const isPromotionReady = bucket === "eligibleThisYear" || bucket === "alreadyEligible";
  const ordinal =
    promo.eligibleYearOrdinal != null && promo.eligibleYearOrdinal > 0 ? promo.eligibleYearOrdinal : null;

  const draft: Omit<PreparedPromotionRow, "priorityBand" | "priorityOrder"> = {
    officerId: officer.officerId,
    profileHref: buildOfficerProfileUrl(officer.officerId),
    portraitUrl: officer.officialPortraitUrl,
    rankLabel: officer.rank || "—",
    fullName: officer.displayName,
    searchText: `${officer.displayName} ${officer.rank} ${officer.currentPosition ?? ""} ${org.companyLabel}`.toLowerCase(),
    ...org,
    currentPositionLabel: officer.currentPosition ?? "—",
    currentPositionLevel: officer.positionLevel,
    targetPositionLabel: promo.targetPosition,
    targetPositionLevel: promo.targetLevel,
    positionLevelStartYearBe: officer.positionLevelStartYearBe,
    completedTenureYears: completed,
    requiredTenureYears: required,
    remainingTenureYears: promo.remainingTenureYears,
    remainingTenureLabel: promo.displayRemainingTenureTh ?? "—",
    readinessPercent: readinessPercent != null ? Math.round(readinessPercent) : null,
    readinessBand,
    promotionStatus: promo.promotionStatus,
    executiveBucket: bucket,
    firstEligibleYearBe: promo.firstEligibleYearBe,
    appointmentYearBe,
    cycleLabel: ordinal != null ? `รอบที่ ${ordinal}` : null,
    ordinalLabel: ordinal != null ? `ปีที่ ${ordinal}` : null,
    overdueYears: promo.overdueYears,
    recommendedActionTh: recommendedActionTh(bucket, promo.promotionStatus, blockerKeys),
    // Presentation overlay — does not change PromotionSummary.displayStatusTh from the engine.
    statusLabelTh: CPI_STATUS_LABEL_TH[promo.promotionStatus] ?? EXECUTIVE_BUCKET_LABEL_TH[bucket],
    retirementYearBe: officer.retirementYearBe,
    retirementRemainingYears: retirement.remainingYears,
    retirementWindow: retirement.window,
    hasUnknownRetirement: retirement.unknown,
    blockerKeys,
    missingEvidence: promo.missingEvidence,
    hasMissingDocuments,
    hasMissingTraining,
    hasUnknownPositionHistory,
    isPromotionReady,
    isBlocked:
      promo.promotionStatus === "MissingTraining" ||
      promo.promotionStatus === "MissingDocuments" ||
      promo.promotionStatus === "RetirementRestricted",
  };

  const priorityBand = assignExecutivePriority(draft);
  return {
    ...draft,
    priorityBand,
    priorityOrder: prioritySortOrder(priorityBand),
  };
}

function topNames(rows: readonly PreparedPromotionRow[], n = TOP_N): string[] {
  return [...rows]
    .sort((a, b) => a.priorityOrder - b.priorityOrder || compareThai(a.fullName, b.fullName))
    .slice(0, n)
    .map((r) => `${r.rankLabel} ${r.fullName}`);
}

function countDrill(
  key: string,
  labelTh: string,
  rows: readonly PreparedPromotionRow[],
  filter: CountDrilldown["filter"]
): CountDrilldown {
  return { key, labelTh, count: rows.length, filter, topNames: topNames(rows) };
}

function buildOrgComparison(rows: readonly PreparedPromotionRow[]): OrgComparisonRow[] {
  type Acc = {
    level: OrgComparisonRow["level"];
    key: string;
    labelTh: string;
    parentKey: string | null;
    rows: PreparedPromotionRow[];
  };
  const map = new Map<string, Acc>();

  function touch(level: OrgComparisonRow["level"], key: string, labelTh: string, parentKey: string | null, row: PreparedPromotionRow) {
    const id = `${level}:${key}`;
    const acc = map.get(id) ?? { level, key, labelTh, parentKey, rows: [] };
    acc.rows.push(row);
    map.set(id, acc);
  }

  for (const row of rows) {
    if (row.regionKey) touch("region", row.regionKey, row.regionLabel, null, row);
    if (row.divisionKey) touch("division", row.divisionKey, row.divisionLabel, row.regionKey, row);
    if (row.companyKey) touch("company", row.companyKey, row.companyLabel, row.divisionKey, row);
  }

  return [...map.values()]
    .map((acc) => {
      const known = acc.rows.filter((r) => r.readinessPercent != null);
      const averageReadiness =
        known.length > 0 ? known.reduce((s, r) => s + (r.readinessPercent ?? 0), 0) / known.length : null;
      return {
        level: acc.level,
        key: acc.key,
        labelTh: acc.labelTh,
        parentKey: acc.parentKey,
        total: acc.rows.length,
        eligibleThisYear: acc.rows.filter((r) => r.executiveBucket === "eligibleThisYear").length,
        alreadyEligible: acc.rows.filter((r) => r.executiveBucket === "alreadyEligible").length,
        nextYear: acc.rows.filter((r) => r.executiveBucket === "nextYear").length,
        incomplete: acc.rows.filter((r) => r.executiveBucket === "incomplete").length,
        blocked: acc.rows.filter((r) => r.isBlocked).length,
        promotionReady: acc.rows.filter((r) => r.isPromotionReady).length,
        averageReadiness: averageReadiness != null ? Math.round(averageReadiness) : null,
        knownReadinessCount: known.length,
        criticalCount: acc.rows.filter((r) => r.priorityBand === "Critical").length,
        highCount: acc.rows.filter((r) => r.priorityBand === "High").length,
        retirementCollisionCount: acc.rows.filter(
          (r) => r.isPromotionReady && (r.retirementWindow === "within1" || r.retirementWindow === "within3")
        ).length,
        topPriorityNames: topNames(acc.rows, 3),
        filter:
          acc.level === "region"
            ? { regionKey: acc.key }
            : acc.level === "division"
              ? { divisionKey: acc.key }
              : { companyKey: acc.key },
      } satisfies OrgComparisonRow;
    })
    .sort((a, b) => b.promotionReady - a.promotionReady || compareThai(a.labelTh, b.labelTh));
}

function buildQueue(rows: readonly PreparedPromotionRow[]): QueueItemView[] {
  const statusTier = (r: PreparedPromotionRow): number => {
    if (r.executiveBucket === "eligibleThisYear") return 0;
    if (r.executiveBucket === "alreadyEligible") return 1;
    if (r.executiveBucket === "nextYear") return 2;
    if (r.executiveBucket === "incomplete") return 3;
    return 4;
  };

  return [...rows]
    .sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
      const ta = statusTier(a);
      const tb = statusTier(b);
      if (ta !== tb) return ta - tb;
      const fa = a.firstEligibleYearBe ?? Number.POSITIVE_INFINITY;
      const fb = b.firstEligibleYearBe ?? Number.POSITIVE_INFINITY;
      if (fa !== fb) return fa - fb;
      const ra = a.readinessPercent ?? -1;
      const rb = b.readinessPercent ?? -1;
      if (ra !== rb) return rb - ra;
      const rema = a.remainingTenureYears ?? Number.POSITIVE_INFINITY;
      const remb = b.remainingTenureYears ?? Number.POSITIVE_INFINITY;
      if (rema !== remb) return rema - remb;
      return compareThai(a.fullName, b.fullName);
    })
    .slice(0, QUEUE_LIMIT)
    .map((r) => ({
      officerId: r.officerId,
      profileHref: r.profileHref,
      portraitUrl: r.portraitUrl,
      priorityBand: r.priorityBand,
      rankLabel: r.rankLabel,
      fullName: r.fullName,
      currentPositionLabel: r.currentPositionLabel,
      targetPositionLabel: r.targetPositionLabel,
      statusLabelTh: r.statusLabelTh,
      recommendedActionTh: r.recommendedActionTh,
    }));
}

function buildActions(rows: readonly PreparedPromotionRow[]): ActionItemView[] {
  const already = rows.filter((r) => r.executiveBucket === "alreadyEligible");
  const readyNearRetire = rows.filter((r) => r.isPromotionReady && (r.retirementWindow === "within1" || r.retirementWindow === "within3"));
  const training = rows.filter((r) => r.hasMissingTraining);
  const incomplete = rows.filter((r) => r.executiveBucket === "incomplete");
  const documents = rows.filter((r) => r.hasMissingDocuments);
  const nextYear = rows.filter((r) => r.executiveBucket === "nextYear");
  const history = rows.filter((r) => r.hasUnknownPositionHistory);
  const unknownRetire = rows.filter((r) => r.hasUnknownRetirement);

  const items: ActionItemView[] = [
    {
      id: "review-already",
      urgency: "Critical",
      labelTh: "ทบทวนผู้ที่ครบคุณสมบัติก่อนปีนี้",
      descriptionTh: "ตรวจสอบรายชื่อที่รอการพิจารณามาแล้วเพื่อเสนอในรอบปัจจุบัน",
      count: already.length,
      filter: { bucket: "alreadyEligible" },
    },
    {
      id: "ready-retire",
      urgency: "Critical",
      labelTh: "ทบทวนผู้พร้อมเลื่อนใกล้เกษียณ",
      descriptionTh: "ผู้มีคุณสมบัติครบทั้งหมดและใกล้เกษียณภายใน 3 ปี",
      count: readyNearRetire.length,
      filter: { retirementWindow: "within3", bucket: "qualifiedNow" },
    },
    {
      id: "training",
      urgency: "High",
      labelTh: "ตรวจสอบข้อมูลหลักสูตร",
      descriptionTh: "เติมข้อมูลการฝึกอบรมที่เกี่ยวข้องกับการเลื่อนระดับ",
      count: training.length,
      filter: { blocker: "MissingTraining" },
    },
    {
      id: "evidence",
      urgency: "High",
      labelTh: "เติมหลักฐานที่จำเป็น",
      descriptionTh: "ข้อมูลเริ่มดำรงระดับหรือสถานะที่ไม่สามารถประเมินได้",
      count: incomplete.length,
      filter: { bucket: "incomplete" },
    },
    {
      id: "documents",
      urgency: "Normal",
      labelTh: "ตรวจสอบเอกสารประกอบ",
      descriptionTh: "เอกสารที่ระบบตรวจพบว่ายังขาด",
      count: documents.length,
      filter: { blocker: "MissingDocuments" },
    },
    {
      id: "next-year",
      urgency: "Normal",
      labelTh: "เตรียมการสำหรับผู้จะครบในปีหน้า",
      descriptionTh: "ติดตามและเตรียมข้อมูลล่วงหน้า",
      count: nextYear.length,
      filter: { bucket: "nextYear" },
    },
    {
      id: "history",
      urgency: "Informational",
      labelTh: "ยืนยันประวัติเริ่มดำรงระดับ",
      descriptionTh: "ตรวจสอบปีเริ่มดำรงระดับตำแหน่งให้ครบถ้วน",
      count: history.length,
      filter: { dataQuality: "missingLevelStart" },
    },
    {
      id: "retire-unknown",
      urgency: "Informational",
      labelTh: "ตรวจสอบข้อมูลเกษียณที่ไม่ทราบ",
      descriptionTh: "รายการที่ยังไม่มีปีเกษียณที่ประเมินได้",
      count: unknownRetire.length,
      filter: { dataQuality: "unknownRetirement" },
    },
  ];
  return items.filter((i) => i.count > 0);
}

function buildInsights(rows: readonly PreparedPromotionRow[], orgs: OrgComparisonRow[]): InsightCardView[] {
  const insights: InsightCardView[] = [];
  const companies = orgs.filter((o) => o.level === "company");

  const bestReady = [...companies].sort((a, b) => (b.averageReadiness ?? -1) - (a.averageReadiness ?? -1))[0];
  if (bestReady && bestReady.averageReadiness != null && bestReady.knownReadinessCount >= 3) {
    insights.push({
      id: "highest-readiness-org",
      titleTh: "หน่วยงานที่มีความพร้อมด้านระยะเวลาสูงสุด",
      detailTh: `${bestReady.labelTh} · เฉลี่ย ${bestReady.averageReadiness}% (จาก ${bestReady.knownReadinessCount} รายการที่ประเมินได้)`,
      filter: bestReady.filter,
    });
  }

  const mostEligible = [...companies].sort((a, b) => b.promotionReady - a.promotionReady)[0];
  if (mostEligible && mostEligible.promotionReady > 0) {
    insights.push({
      id: "most-eligible-org",
      titleTh: "หน่วยงานที่มีผู้พร้อมเลื่อนมากที่สุด",
      detailTh: `${mostEligible.labelTh} · ${mostEligible.promotionReady} นาย`,
      filter: mostEligible.filter,
    });
  }

  const mostIncomplete = [...companies].sort((a, b) => b.incomplete - a.incomplete)[0];
  if (mostIncomplete && mostIncomplete.incomplete > 0) {
    insights.push({
      id: "most-incomplete-org",
      titleTh: "หน่วยงานที่มีข้อมูลไม่สมบูรณ์มากที่สุด",
      detailTh: `${mostIncomplete.labelTh} · ${mostIncomplete.incomplete} รายการ`,
      filter: mostIncomplete.filter,
    });
  }

  const mostCollision = [...companies].sort((a, b) => b.retirementCollisionCount - a.retirementCollisionCount)[0];
  if (mostCollision && mostCollision.retirementCollisionCount > 0) {
    insights.push({
      id: "collision-org",
      titleTh: "หน่วยงานที่มีการชนกับกรอบเกษียณสูงสุด",
      detailTh: `${mostCollision.labelTh} · ${mostCollision.retirementCollisionCount} นาย`,
      filter: mostCollision.filter,
    });
  }

  const blockerCounts = new Map<BlockerKey, number>();
  for (const row of rows) {
    for (const key of row.blockerKeys) blockerCounts.set(key, (blockerCounts.get(key) ?? 0) + 1);
  }
  let topBlocker: BlockerKey | null = null;
  let topCount = 0;
  for (const [key, count] of blockerCounts) {
    if (count > topCount) {
      topBlocker = key;
      topCount = count;
    }
  }
  if (topBlocker && topCount > 0) {
    insights.push({
      id: "common-blocker",
      titleTh: "ข้อจำกัดที่พบบ่อยที่สุด",
      detailTh: `${BLOCKER_LABEL_TH[topBlocker]} · ${topCount} รายการ`,
      filter: { blocker: topBlocker },
    });
  }

  const nextYear = rows.filter((r) => r.executiveBucket === "nextYear").length;
  if (nextYear > 0) {
    insights.push({
      id: "next-year-workload",
      titleTh: "ภาระงานที่จะครบคุณสมบัติในปีหน้า",
      detailTh: `มี ${nextYear} นายที่จะครบคุณสมบัติด้านระยะเวลาในปีหน้า`,
      filter: { bucket: "nextYear" },
    });
  }

  return insights;
}

function urgentSummary(
  eligibleThisYear: number,
  alreadyEligible: number,
  incomplete: number
): string {
  if (alreadyEligible > 0)
    return `มี ${alreadyEligible} นายที่ครบคุณสมบัติก่อนปีนี้และควรได้รับการทบทวน`;
  if (eligibleThisYear > 0) return `มี ${eligibleThisYear} นายที่พร้อมเลื่อนปีนี้`;
  if (incomplete > 0) return `มีข้อมูลกำลังพล ${incomplete} รายการที่ควรตรวจสอบให้สมบูรณ์`;
  return "ยังไม่พบประเด็นเร่งด่วนด้านการเลื่อนตำแหน่ง";
}

export function buildCommanderPromotionDashboard(
  dataset: CommanderQueryDataset,
  options: { asOf?: Date } = {}
): CommanderPromotionViewModel {
  const asOf = options.asOf ?? new Date();
  const appointmentYearBe = currentPromotionCycle(asOf);
  const rows = dataset.officers.map((o) => prepareRow(o, dataset, appointmentYearBe));

  const byBucket = (b: ExecutiveBucket) => rows.filter((r) => r.executiveBucket === b);
  const eligibleThisYear = byBucket("eligibleThisYear");
  const alreadyEligible = byBucket("alreadyEligible");
  const nextYear = byBucket("nextYear");
  const incomplete = byBucket("incomplete");
  const noTarget = byBucket("noTarget");

  const kpis = (["eligibleThisYear", "alreadyEligible", "nextYear", "notYetEligible", "incomplete", "noTarget"] as ExecutiveBucket[]).map(
    (bucket) => ({
      bucket,
      labelTh: EXECUTIVE_BUCKET_LABEL_TH[bucket],
      count: byBucket(bucket).length,
    })
  );

  const readinessDistribution = READINESS_BAND_ORDER.map((band) => ({
    key: band,
    labelTh: READINESS_BAND_LABEL_TH[band],
    count: rows.filter((r) => r.readinessBand === band).length,
  }));

  const blockerKeys: BlockerKey[] = [
    "MissingTraining",
    "MissingDocuments",
    "RetirementRestricted",
    "missingLevelStart",
    "noTarget",
    "Unknown",
  ];
  const blockingFactors = blockerKeys
    .map((key) =>
      countDrill(
        key,
        BLOCKER_LABEL_TH[key],
        rows.filter((r) => r.blockerKeys.includes(key)),
        { blocker: key }
      )
    )
    .filter((b) => b.count > 0);

  const priorityDistribution = (["Critical", "High", "Medium", "Low"] as const).map((band) => ({
    key: band,
    labelTh: PRIORITY_LABEL_TH[band],
    count: rows.filter((r) => r.priorityBand === band).length,
  }));

  const organizationComparison = buildOrgComparison(rows);

  const ready = rows.filter((r) => r.isPromotionReady);
  const within1 = ready.filter((r) => r.retirementWindow === "within1");
  const within3 = ready.filter((r) => r.retirementWindow === "within1" || r.retirementWindow === "within3");
  const within5 = ready.filter((r) => ["within1", "within3", "within5"].includes(r.retirementWindow));

  const retirementCollisions = {
    within1: countDrill("retire-1", "พร้อมเลื่อน และเกษียณภายใน 1 ปี", within1, {
      promotionReadyOnly: true,
      retirementWindow: "within1",
    }),
    within3: countDrill("retire-3", "พร้อมเลื่อน และเกษียณภายใน 3 ปี", within3, {
      promotionReadyOnly: true,
      retirementWindow: "within3",
    }),
    within5: countDrill("retire-5", "พร้อมเลื่อน และเกษียณภายใน 5 ปี", within5, {
      promotionReadyOnly: true,
      retirementWindow: "within5",
    }),
  };

  // Cumulative windows — within3 includes within1, within5 includes within3.
  const upcomingHorizons = ([1, 2, 3] as const).map((horizonYears) => {
    const matched = rows.filter(
      (r) =>
        r.firstEligibleYearBe != null &&
        r.firstEligibleYearBe >= appointmentYearBe &&
        r.firstEligibleYearBe <= appointmentYearBe + horizonYears
    );
    return {
      ...countDrill(
        `horizon-${horizonYears}`,
        horizonYears === 1 ? "ภายใน 1 ปีการแต่งตั้ง" : horizonYears === 2 ? "ภายใน 2 ปีการแต่งตั้ง" : "ภายใน 3 ปีการแต่งตั้ง",
        matched,
        {
          eligibleYearMin: appointmentYearBe,
          eligibleYearMax: appointmentYearBe + horizonYears,
        }
      ),
      horizonYears,
    };
  });

  const workloadForecast: ForecastBucketView[] = [0, 1, 2, 3].map((offset) => {
    const yearBe = appointmentYearBe + offset;
    return {
      yearBe,
      labelTh: offset === 0 ? `ปีปัจจุบัน พ.ศ. ${yearBe}` : `พ.ศ. ${yearBe}`,
      count: rows.filter((r) => r.firstEligibleYearBe === yearBe).length,
    };
  });

  const yearSet = new Set<number>();
  for (const row of rows) {
    if (row.firstEligibleYearBe != null) yearSet.add(row.firstEligibleYearBe);
  }
  const timelineYears = [...yearSet].sort((a, b) => a - b).filter((y) => y >= appointmentYearBe - 1 && y <= appointmentYearBe + 4);
  const timelineByYear: TimelineYearView[] = timelineYears.map((yearBe) => {
    const inYear = rows.filter((r) => r.firstEligibleYearBe === yearBe);
    return {
      yearBe,
      count: inYear.length,
      eligibleThisYear: inYear.filter((r) => r.executiveBucket === "eligibleThisYear").length,
      alreadyEligible: inYear.filter((r) => r.executiveBucket === "alreadyEligible").length,
      nextYear: inYear.filter((r) => r.executiveBucket === "nextYear").length,
      incomplete: inYear.filter((r) => r.executiveBucket === "incomplete").length,
    };
  });

  const executiveWatchlist: WatchlistCategoryView[] = [
    {
      key: "ready",
      labelTh: "พร้อมเลื่อนระดับ",
      count: ready.length,
      topNames: topNames(ready),
      filter: { promotionReadyOnly: true },
    },
    {
      key: "nextYear",
      labelTh: "จะครบในปีหน้า",
      count: nextYear.length,
      topNames: topNames(nextYear),
      filter: { bucket: "nextYear" },
    },
    {
      key: "collision",
      labelTh: "ชนกับกรอบเกษียณ",
      count: within3.length,
      topNames: topNames(within3),
      filter: { promotionReadyOnly: true, retirementWindow: "within3" },
    },
    {
      key: "incomplete",
      labelTh: "ข้อมูลไม่สมบูรณ์",
      count: incomplete.length,
      topNames: topNames(incomplete),
      filter: { bucket: "incomplete" },
    },
    {
      key: "training",
      labelTh: "ขาดหลักสูตร",
      count: rows.filter((r) => r.hasMissingTraining).length,
      topNames: topNames(rows.filter((r) => r.hasMissingTraining)),
      filter: { blocker: "MissingTraining" },
    },
    {
      key: "history",
      labelTh: "ไม่ทราบประวัติระดับตำแหน่ง",
      count: rows.filter((r) => r.hasUnknownPositionHistory).length,
      topNames: topNames(rows.filter((r) => r.hasUnknownPositionHistory)),
      filter: { dataQuality: "missingLevelStart" },
    },
  ];

  const dataQuality: CommanderPromotionViewModel["dataQuality"] = [
    {
      key: "missingLevelStart",
      labelTh: "ไม่มีปีเริ่มดำรงระดับ",
      explanationTh: "ยังไม่มีข้อมูลปีเริ่มดำรงระดับตำแหน่งที่เพียงพอ",
      count: rows.filter((r) => r.hasUnknownPositionHistory).length,
      severity: "serious",
      filter: { dataQuality: "missingLevelStart" },
    },
    {
      key: "missingTarget",
      labelTh: "ไม่มีระดับเป้าหมาย",
      explanationTh: "ไม่พบระดับตำแหน่งเป้าหมายถัดไปในข้อมูลปัจจุบัน",
      count: noTarget.length,
      severity: "warning",
      filter: { bucket: "noTarget" },
    },
    {
      key: "unknownStatus",
      labelTh: "สถานะเลื่อนระดับไม่ทราบ",
      explanationTh: "ระบบยังประเมินสถานะการเลื่อนระดับไม่ได้",
      count: rows.filter((r) => r.promotionStatus === "Unknown").length,
      severity: "warning",
      filter: { dataQuality: "unknownStatus" },
    },
    {
      key: "missingDocuments",
      labelTh: "ขาดเอกสาร",
      explanationTh: "ตรวจพบเอกสารประกอบที่ยังขาด",
      count: rows.filter((r) => r.hasMissingDocuments).length,
      severity: "warning",
      filter: { dataQuality: "missingDocuments" },
    },
    {
      key: "missingTraining",
      labelTh: "ขาดหลักสูตร",
      explanationTh: "ตรวจพบหลักสูตรที่เกี่ยวข้องที่ยังขาดข้อมูล",
      count: rows.filter((r) => r.hasMissingTraining).length,
      severity: "warning",
      filter: { dataQuality: "missingTraining" },
    },
    {
      key: "unknownRetirement",
      labelTh: "ไม่ทราบข้อมูลเกษียณ",
      explanationTh: "ยังไม่มีปีเกษียณที่ประเมินได้",
      count: rows.filter((r) => r.hasUnknownRetirement).length,
      severity: "neutral",
      filter: { dataQuality: "unknownRetirement" },
    },
  ];

  const ranks = [...new Set(rows.map((r) => r.rankLabel))].sort(compareThai);
  const currentPositions = [...new Set(rows.map((r) => r.currentPositionLabel))].sort(compareThai);
  const targetPositions = [...new Set(rows.map((r) => r.targetPositionLabel).filter((v): v is string => v != null))].sort(compareThai);
  const eligibleYears = [...new Set(rows.map((r) => r.firstEligibleYearBe).filter((v): v is number => v != null))].sort((a, b) => a - b);

  return {
    generatedAtIso: asOf.toISOString(),
    appointmentYearBe,
    totalOfficers: rows.length,
    rows,
    executiveSummary: {
      appointmentYearBe,
      eligibleThisYearCount: eligibleThisYear.length,
      alreadyEligibleCount: alreadyEligible.length,
      nextYearCount: nextYear.length,
      incompleteCount: incomplete.length,
      urgentSummaryTh: urgentSummary(eligibleThisYear.length, alreadyEligible.length, incomplete.length),
    },
    kpis,
    readinessDistribution,
    blockingFactors,
    priorityDistribution,
    organizationComparison,
    retirementCollisions,
    upcomingHorizons,
    workloadForecast,
    timelineByYear,
    promotionQueue: buildQueue(rows),
    actionCenter: buildActions(rows),
    commanderInsights: buildInsights(rows, organizationComparison),
    dataQuality,
    executiveWatchlist,
    dashboardQuickStats: computeFilteredQuickStats(rows),
    filterOptions: {
      regions: dataset.options.regions.map((r) => ({ key: String(r.id), label: r.label })),
      divisions: dataset.options.battalions.map((b) => ({
        key: String(b.id),
        label: b.label,
        regionKey: b.regionId != null ? String(b.regionId) : null,
      })),
      companies: dataset.options.companies.map((c) => ({
        key: String(c.id),
        label: c.label,
        divisionKey: c.battalionId != null ? String(c.battalionId) : null,
      })),
      ranks,
      currentPositions,
      targetPositions,
      eligibleYears,
    },
  };
}

/** Exported for tests — exclusive bucket assignment. */
export function assignExecutiveBucketForTest(officer: CommanderQueryOfficer, appointmentYearBe: number): ExecutiveBucket {
  return bucketOf(officer, appointmentYearBe);
}