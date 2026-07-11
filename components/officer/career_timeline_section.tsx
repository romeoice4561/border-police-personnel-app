/**
 * CareerTimelineSection (Phase 21A — Editable Profile Foundation, Part 6;
 * Phase 23A — real rank/source/verified data; Phase 26B Part 5 Part F/H —
 * full organization hierarchy + verification-status badge per row).
 *
 * Read-only timeline view: Date, Rank, Position, and the FULL organization
 * hierarchy (Company/Battalion/Division/Headquarters — Part F, replacing the
 * old Unit-only column) shown for every historical row without opening the
 * editor, plus Source and a colored Verification badge (Part H). Each row is
 * a permanent historical snapshot (Part J/M) — its org hierarchy and
 * verification fields are whatever was persisted for THAT row, resolved
 * against the current org tree only for display labels (never re-derived or
 * changed by editing the officer's current profile). The editable
 * counterpart is CareerTimelineEditor, shown instead when the workspace is
 * in edit mode.
 */
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Timeline } from "@/lib/database/query_types";
import { sortTimelineByYear } from "@/lib/ui/officer_summary";
import { formatThaiDate } from "@/lib/officer_profile/thai_date";
import { resolveOrgLabels, type OrgTree } from "@/lib/organization/org_tree";
import { isValidTimelineVerificationStatus, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** The display row shape — now backed entirely by real Timeline columns (Phase 23A) plus the resolved org hierarchy (Phase 26B Part 5 Part F). */
export interface CareerTimelineRow {
  id: number;
  date: string;
  rank: string | null;
  position: string;
  unit: string | null;
  source: string | null;
  verified: string;
  headquarters: string | null;
  borderPatrolDivision: string | null;
  battalion: string | null;
  company: string | null;
  verificationStatus: string | null;
}

/**
 * Maps a persisted Timeline row onto the display shape. Phase 26B Part 3: a
 * row migrated to the structured date model (yearBE set) renders via
 * formatThaiDate for a consistent "1 มกราคม 2560" / "ปัจจุบัน" display; a row
 * not yet migrated falls back to its legacy free-text `year` verbatim,
 * unchanged from before this phase.
 */
function toCareerTimelineRow(entry: Timeline, orgTree: OrgTree): CareerTimelineRow {
  const labels = resolveOrgLabels(orgTree, {
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
    unit: entry.unit,
    source: entry.source,
    verified: entry.verified,
    headquarters: labels.headquarters,
    borderPatrolDivision: labels.borderPatrolDivision,
    battalion: labels.battalion,
    company: labels.company,
    verificationStatus: entry.verificationStatus ?? null,
  };
}

const VERIFIED_STATUS = "ยืนยันแล้ว";

/** "รอง ผกก. / ร้อย ตชด.434 / กก.ตชด.43 / บก.ตชด.ภาค4 / บช.ตชด." — spec's own Part F example: Company/Battalion/Division/Headquarters joined most-specific-first, skipping unresolved levels. */
function orgHierarchyDisplay(row: CareerTimelineRow): string {
  return [row.company, row.battalion, row.borderPatrolDivision, row.headquarters].filter(Boolean).join(" / ") || "—";
}

function VerificationStatusBadge({ status }: { status: string | null }) {
  if (!status || !isValidTimelineVerificationStatus(status)) return null;
  const meta = VERIFICATION_STATUS_META[status];
  return (
    <Badge tone={meta.color}>
      {meta.labelTh} / {meta.labelEn}
    </Badge>
  );
}

export function CareerTimelineSection({ timeline, orgTree }: { timeline: Timeline[]; orgTree: OrgTree }) {
  const rows = sortTimelineByYear(timeline).map((entry) => toCareerTimelineRow(entry, orgTree));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career Timeline</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No career-history entries on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Date</th>
                  <th scope="col" className="px-5 py-3 font-medium">Rank</th>
                  <th scope="col" className="px-5 py-3 font-medium">Position</th>
                  <th scope="col" className="px-5 py-3 font-medium">Company / Battalion / Division / Headquarters</th>
                  <th scope="col" className="px-5 py-3 font-medium">Source</th>
                  <th scope="col" className="px-5 py-3 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">{row.date || "—"}</td>
                    <td className="px-5 py-3 text-muted">{row.rank || "—"}</td>
                    <td className="px-5 py-3">{row.position || "—"}</td>
                    <td className="px-5 py-3 text-muted">{orgHierarchyDisplay(row)}</td>
                    <td className="px-5 py-3 text-muted">{row.source || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
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
                        <VerificationStatusBadge status={row.verificationStatus} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
