/**
 * Response formatting by disclosure level (Phase 51).
 * Level 3 is the only level that emits Web UI deep links.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type {
  PersonnelSearchEnrichment,
  PersonnelSearchPersonItem,
  SearchAction,
} from "@/lib/personnel_search/contracts";
import {
  canRevealOfficerId,
  filterContactEnrichment,
  maskOfficerId,
  type FieldAccess,
  type SearchPermissionContext,
} from "@/lib/personnel_search/permission";
import type { RankedPersonMatch } from "@/lib/personnel_search/ranking";
import type { DisclosureLevel, MatchKind } from "@/lib/personnel_search/types";

function dataQualityNotes(officer: CommanderQueryOfficer): string[] {
  const notes: string[] = [];
  const promo = officer.promotionIntelligence;
  if (promo.confidence === "incomplete" || promo.confidence === "unknown") {
    notes.push(promo.confidenceReasonTh ?? "ข้อมูลเลื่อนระดับไม่สมบูรณ์");
  }
  if (promo.missingEvidence.includes("current_position_level_start_date")) {
    notes.push("ไม่มีปีเริ่มดำรงระดับ");
  }
  if (!promo.targetLevel) notes.push("ไม่มีระดับเป้าหมาย");
  if (promo.promotionStatus === "Unknown") notes.push("สถานะเลื่อนระดับไม่ทราบ");
  if (officer.flagCodes.includes("DOCUMENTS_MISSING")) notes.push("ขาดเอกสาร");
  if (officer.flagCodes.includes("NEEDS_TRAINING")) notes.push("ขาดหลักสูตร");
  if (officer.flagCodes.includes("PROFILE_INCOMPLETE")) notes.push("ข้อมูลโปรไฟล์ไม่ครบ");
  return notes;
}

export function formatPersonItem(
  match: RankedPersonMatch,
  level: DisclosureLevel,
  access: FieldAccess,
  ctx: SearchPermissionContext,
  organizationPublic: {
    regionCode: string | null;
    divisionCode: string | null;
    companyCode: string | null;
  } = { regionCode: null, divisionCode: null, companyCode: null }
): PersonnelSearchPersonItem {
  const { officer } = match;
  const enrichment = filterContactEnrichment(match.enrichment, access, ctx, officer.officerId);
  const revealId = canRevealOfficerId(access, ctx, officer.officerId);
  const item: PersonnelSearchPersonItem = {
    kind: "person",
    officerId: revealId ? officer.officerId : officer.officerId, // id kept for actions; display is masked
    officerIdDisplay: maskOfficerId(officer.officerId, revealId),
    rank: officer.rank,
    fullName: `${officer.firstName} ${officer.lastName}`.trim(),
    nickname: enrichment.nickname ?? null,
    currentPosition: officer.currentPosition,
    unitLabel: officer.companyLabel || officer.currentUnit || "—",
    organizationPublic,
    academyClass: officer.academyClass,
    matchKind: match.matchKind,
    matchScore: match.matchScore,
  };

  if (level >= 2) {
    const promo = officer.promotionIntelligence;
    item.intelligence = {
      promotionStatusTh: promo.displayStatusTh,
      promotionStatus: promo.promotionStatus,
      retirementYearBe: officer.retirementYearBe,
      retirementStatus: officer.retirementStatus,
      trainingStatusTh: officer.trainingIntelligence?.displayStatusTh ?? null,
      documentReadinessTh: officer.documentIntelligence?.readinessLabelTh ?? null,
      dataQualityNotesTh: dataQualityNotes(officer),
    };
  }

  if (level >= 3 && access.canViewFullProfile) {
    item.links = {
      profileHref: `/officers/${encodeURIComponent(officer.officerId)}`,
      promotionHref: `/officers/${encodeURIComponent(officer.officerId)}#promotion`,
    };
  }

  return item;
}

export function formatDisambiguationLine(item: PersonnelSearchPersonItem, index: number): string {
  const parts = [
    `${index}.`,
    item.rank,
    item.fullName,
    item.currentPosition ?? "—",
    item.unitLabel,
  ];
  if (item.nickname) parts.push(`ชื่อเล่น ${item.nickname}`);
  if (item.academyClass != null) parts.push(`นรต.${item.academyClass}`);
  parts.push(item.officerIdDisplay);
  return parts.join(" ");
}

export function buildPersonActions(
  officerId: string,
  access: FieldAccess,
  level: DisclosureLevel
): SearchAction[] {
  const actions: SearchAction[] = [];
  if (level >= 3 && access.canViewFullProfile) {
    actions.push({
      type: "open_profile",
      labelTh: "เปิดโปรไฟล์",
      labelEn: "Open Profile",
      payload: { officerId, href: `/officers/${encodeURIComponent(officerId)}` },
    });
    actions.push({
      type: "view_promotion",
      labelTh: "ดูข้อมูลเลื่อนระดับ",
      labelEn: "View Promotion",
      payload: { officerId, href: `/officers/${encodeURIComponent(officerId)}#promotion` },
    });
    actions.push({
      type: "view_timeline",
      labelTh: "ดูเส้นทางอาชีพ",
      labelEn: "View Timeline",
      payload: { officerId, href: `/officers/${encodeURIComponent(officerId)}#timeline` },
    });
    actions.push({
      type: "view_training",
      labelTh: "ดูหลักสูตร",
      labelEn: "View Training",
      payload: { officerId, href: `/officers/${encodeURIComponent(officerId)}#training` },
    });
    actions.push({
      type: "view_documents",
      labelTh: "ดูเอกสาร",
      labelEn: "View Documents",
      payload: { officerId, href: `/officers/${encodeURIComponent(officerId)}#documents` },
    });
  }
  if (access.canOpenDashboard) {
    actions.push({
      type: "open_dashboard",
      labelTh: "เปิดแดชบอร์ด",
      labelEn: "Open Dashboard",
      payload: { href: "/commander-promotion" },
    });
  }
  if (access.canExport) {
    actions.push({
      type: "export",
      labelTh: "ส่งออก",
      labelEn: "Export",
      payload: { officerId },
    });
  }
  return actions;
}

export function listEntryFromOfficer(
  officer: CommanderQueryOfficer,
  summaryTh: string,
  access: FieldAccess,
  ctx: SearchPermissionContext,
  matchScore = 0
) {
  const reveal = canRevealOfficerId(access, ctx, officer.officerId);
  return {
    kind: "list_entry" as const,
    officerId: officer.officerId,
    officerIdDisplay: maskOfficerId(officer.officerId, reveal),
    rank: officer.rank,
    fullName: `${officer.firstName} ${officer.lastName}`.trim(),
    unitLabel: officer.companyLabel || officer.currentUnit || "—",
    summaryTh,
    matchScore,
  };
}

export type { MatchKind };
