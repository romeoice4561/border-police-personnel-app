"use client";

/**
 * CareerTimelineSection (Phase 21A — Editable Profile Foundation, Part 6;
 * Phase 23A — real rank/source/verified data; Phase 26B Part 5 Part F/H —
 * full organization hierarchy + verification-status badge per row; Phase
 * 26B Part 6 Part F/G/V — stacked readable rows, richer verification detail,
 * full-width proportional layout).
 *
 * Read-only timeline view. Phase 26B Part 6 Part F: rather than one dense
 * "Company / Battalion / Division / Headquarters" line, Position and each
 * organization level now stack vertically (spec's own example: "รอง ผกก." /
 * "ร้อย ตชด.415" / "กก.ตชด.41" / "บก.ตชด.ภาค4" / "บช.ตชด." — most senior line
 * first) so a reader scans top-to-bottom instead of parsing a slash-joined
 * string. Part G: Verified By / Verified Date / Verification Remark now
 * render alongside the status badge, not just the badge. Part V: the
 * Position + Organization columns get proportionally more width, Source and
 * Verified are narrower, and long values wrap instead of truncating or
 * forcing horizontal scroll on typical viewport widths.
 *
 * Each row is a permanent historical snapshot (Part J/M, Phase 26B Part 5) —
 * its org hierarchy and verification fields are whatever was persisted for
 * THAT row, resolved against the current org tree only for display labels
 * (never re-derived or changed by editing the officer's current profile).
 * The editable counterpart is CareerTimelineEditor, shown instead when the
 * workspace is in edit mode.
 */
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Timeline } from "@/lib/database/query_types";
import { sortTimelineByYear } from "@/lib/ui/officer_summary";
import { formatThaiDate } from "@/lib/officer_profile/thai_date";
import { formatThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import { displayOrgLabel } from "@/lib/officer_profile/timeline_org_persistence";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { isValidTimelineVerificationStatus, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import { normalizePositionLevel, UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { useT, useBilingualText } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** The display row shape — now backed entirely by real Timeline columns (Phase 23A) plus the resolved org hierarchy (Phase 26B Part 5 Part F). */
export interface CareerTimelineRow {
  id: number;
  date: string;
  rank: string | null;
  position: string;
  /** Phase 41 Part 1: structured Position Level (canonical string; "Unknown" when unclassified). */
  positionLevel: string;
  unit: string | null;
  source: string | null;
  /** Phase 49A.3: official order reference — preferred display for "ที่มา". */
  appointmentOrder: string | null;
  workLine: string | null;
  verified: string;
  headquarters: string | null;
  borderPatrolDivision: string | null;
  battalion: string | null;
  company: string | null;
  verificationStatus: string | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  verificationRemark: string | null;
  isPresent: boolean;
  appointmentCycle: number | null;
}

/** Display precedence for the "ที่มา" column: appointmentOrder → source → ไม่ระบุ. */
export function timelineSourceDisplay(
  appointmentOrder: string | null | undefined,
  source: string | null | undefined,
  unspecifiedLabel: string
): string {
  const order = (appointmentOrder ?? "").trim();
  if (order) return order;
  const src = (source ?? "").trim();
  if (src) return src;
  return unspecifiedLabel;
}

/**
 * Maps a persisted Timeline row onto the display shape. Phase 26B Part 3: a
 * row migrated to the structured date model (yearBE set) renders via
 * formatThaiDate for a consistent "1 มกราคม 2560" / "ปัจจุบัน" display; a row
 * not yet migrated falls back to its legacy free-text `year` verbatim,
 * unchanged from before this phase.
 */
function toCareerTimelineRow(entry: Timeline, organizationEngine: OrganizationEngine): CareerTimelineRow {
  const labels = organizationEngine.resolveLabels({
    headquartersId: entry.headquartersId ?? null,
    regionId: entry.regionId ?? null,
    battalionId: entry.battalionId ?? null,
    companyId: entry.companyId ?? null,
  });
  return {
    id: entry.id,
    date: entry.yearBE != null || entry.isPresent ? formatThaiDate(entry) : entry.year,
    rank: entry.rank,
    position: entry.position,
    positionLevel: normalizePositionLevel(entry.positionLevel),
    unit: entry.unit,
    source: entry.source,
    appointmentOrder: entry.appointmentOrder ?? null,
    workLine: entry.workLine ?? null,
    verified: entry.verified,
    headquarters: displayOrgLabel(entry.headquartersText, labels.headquarters),
    borderPatrolDivision: displayOrgLabel(entry.regionText, labels.borderPatrolDivision),
    battalion: displayOrgLabel(entry.battalionText, labels.battalion),
    company: displayOrgLabel(entry.companyText, labels.company),
    verificationStatus: entry.verificationStatus ?? null,
    verifiedBy: entry.verifiedBy ?? null,
    verifiedDate: entry.verifiedDate ? formatThaiPersonnelDate(entry.verifiedDate) : null,
    verificationRemark: entry.verificationRemark ?? null,
    isPresent: entry.isPresent,
    appointmentCycle: entry.appointmentCycle ?? null,
  };
}

const VERIFIED_STATUS = "ยืนยันแล้ว";

/** Phase 26B Part 6 Part F: Position, then Company/Battalion/Division/Headquarters, stacked most-senior-line-first — the spec's own worked example laid out as rows, not a slash-joined string. */
function OrganizationStack({ row }: { row: CareerTimelineRow }) {
  const orgLines = [row.company, row.battalion, row.borderPatrolDivision, row.headquarters].filter(Boolean);
  // Display-only fallback: when structured labels are absent, show legacy unit
  // — never mutates stored fields.
  const lines = [row.position, ...(orgLines.length > 0 ? orgLines : row.unit ? [row.unit] : [])].filter(Boolean);
  const showLevel = row.positionLevel !== UNKNOWN_POSITION_LEVEL;
  if (lines.length === 0 && !showLevel) return <span className="text-muted">—</span>;
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? "wrap-break-word text-sm font-medium text-foreground" : "wrap-break-word text-xs text-muted"}>
          {line}
        </p>
      ))}
      {/* Phase 41 Part 1: the structured Position Level, shown as a subtle
          badge distinct from the free-text position line above it. */}
      {showLevel ? (
        <p className="pt-0.5">
          <Badge tone="accent">{row.positionLevel}</Badge>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Phase 26B Part 6 Part G: status badge PLUS Verified By / Verified Date /
 * Remark — not just the badge. Phase 45.2B: the status badge renders only
 * the active language (was a hardcoded "labelTh / labelEn" concatenation
 * that made this badge wide enough to force horizontal overflow at tablet/
 * mobile widths, since Badge's whitespace-nowrap had no room for both).
 */
function VerificationDetail({ row }: { row: CareerTimelineRow }) {
  const render = useBilingualText();
  const status = row.verificationStatus;
  const meta = status && isValidTimelineVerificationStatus(status) ? VERIFICATION_STATUS_META[status] : null;
  return (
    <div className="space-y-1">
      {row.verified === VERIFIED_STATUS ? (
        <span className="inline-flex items-center gap-1 text-good">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {row.verified}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted">
          <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
          {row.verified}
        </span>
      )}
      {meta ? <Badge tone={meta.color}>{render({ th: meta.labelTh, en: meta.labelEn })}</Badge> : null}
      {row.verifiedBy ? <p className="text-xs text-muted">โดย {row.verifiedBy}</p> : null}
      {row.verifiedDate ? <p className="text-xs tabular-nums text-muted">{row.verifiedDate}</p> : null}
      {row.verificationRemark ? <p className="wrap-break-word text-xs text-muted italic">&quot;{row.verificationRemark}&quot;</p> : null}
    </div>
  );
}

/**
 * Phase 23B Bug #5: the mobile counterpart to the desktop table below — one
 * stacked card per row (Date / Rank / Position+Organization / Source /
 * Verification / Current badge), mirroring the OfficerTable ->
 * OfficerCard sm:hidden/sm:block split already used on the officer list page.
 * No horizontal scrolling, 16px+ body text, generous touch spacing.
 */
function TimelineCard({ row }: { row: CareerTimelineRow }) {
  const { t } = useT();
  const sourceText = timelineSourceDisplay(row.appointmentOrder, row.source, t("officer.timelineUnspecified"));
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-medium tabular-nums text-foreground">{row.date || "—"}</span>
        {row.isPresent ? <Badge tone="good">{t("officer.current")}</Badge> : null}
      </div>
      {row.rank ? <p className="text-sm text-muted">{row.rank}</p> : null}
      {row.appointmentCycle ? <p className="text-xs text-muted">รอบแต่งตั้ง {row.appointmentCycle}</p> : null}
      <OrganizationStack row={row} />
      {row.workLine ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{t("officer.timelineWorkLine")}: </span>
          {row.workLine}
        </p>
      ) : null}
      <p className="wrap-break-word text-sm text-muted">
        <span className="font-medium text-foreground">{t("officer.timelineSource")}: </span>
        {sourceText}
      </p>
      <div className="border-t border-border pt-2">
        <VerificationDetail row={row} />
      </div>
    </div>
  );
}

export function CareerTimelineSection({ timeline, organizationEngine }: { timeline: Timeline[]; organizationEngine: OrganizationEngine }) {
  const { t } = useT();
  const rows = sortTimelineByYear(timeline).map((entry) => toCareerTimelineRow(entry, organizationEngine));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.careerTimeline")}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{t("officer.timelineEmpty")}</p>
        ) : (
          <>
            {/* Mobile: stacked cards, no horizontal scrolling. */}
            <div className="grid gap-3 p-4 sm:hidden">
              {rows.map((row) => (
                <TimelineCard key={row.id} row={row} />
              ))}
            </div>

            {/* Desktop/tablet: auto table with min-widths so date/rank never
                overlap (Phase 49A.3). Horizontal scroll when the viewport is
                narrower than the sum of mins — text wraps, never shrinks. */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="min-w-[9rem] px-4 py-3 font-medium">{t("officer.timelineDate")}</th>
                    <th scope="col" className="min-w-[6.5rem] px-4 py-3 font-medium">{t("officer.timelineRank")}</th>
                    <th scope="col" className="min-w-[18rem] px-4 py-3 font-medium">{t("officer.timelinePositionOrg")}</th>
                    <th scope="col" className="min-w-[12rem] px-4 py-3 font-medium">{t("officer.timelineSource")}</th>
                    <th scope="col" className="min-w-[10rem] px-4 py-3 font-medium">{t("officer.timelineVerification")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 align-top">
                      <td className="min-w-[9rem] px-4 py-3 tabular-nums">
                        <div className="flex flex-col gap-1">
                          <span className="wrap-break-word leading-snug">{row.date || "—"}</span>
                          {row.isPresent ? <Badge tone="good" className="w-fit">{t("officer.current")}</Badge> : null}
                          {row.appointmentCycle ? <span className="text-xs text-muted">รอบ {row.appointmentCycle}</span> : null}
                        </div>
                      </td>
                      <td className="min-w-[6.5rem] wrap-break-word px-4 py-3 leading-snug text-muted">{row.rank || "—"}</td>
                      <td className="min-w-[18rem] px-4 py-3">
                        <OrganizationStack row={row} />
                        {row.workLine ? (
                          <p className="mt-1 wrap-break-word text-xs text-muted">
                            {t("officer.timelineWorkLine")}: {row.workLine}
                          </p>
                        ) : null}
                      </td>
                      <td className="min-w-[12rem] wrap-break-word px-4 py-3 leading-snug text-muted">
                        {timelineSourceDisplay(row.appointmentOrder, row.source, t("officer.timelineUnspecified"))}
                      </td>
                      <td className="min-w-[10rem] px-4 py-3">
                        <VerificationDetail row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
