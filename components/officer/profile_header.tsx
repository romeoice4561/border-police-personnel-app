/**
 * ProfileHeader (Phase 21A — Editable Profile Foundation; Phase 23A —
 * Section 1: full header fields + phone copy/tel: action; Phase 23B —
 * trusted-portrait-only, bug #2 fix; Phase 26B Part 5 Part A — no-truncation
 * redesign; Phase 26B Part 6 Part A/B — compact info-grid redesign with the
 * full field list: Rank/Full Name/English Name/Current Position/Current
 * Organization/Phone/Email/LINE/Career Years/Current Age/Date of Birth/
 * Verification Badge).
 *
 * The officer detail hero. Phase 23B: the portrait comes ONLY from a
 * trusted ProfilePhoto match (resolved server-side via
 * resolveOfficerPortrait) — the legacy `Officer.driveFileId`/`thumbnailUrl`
 * is NEVER used, because production data showed those systematically point at
 * deployment maps / org charts / profile-card composites rather than
 * portraits. When no trusted portrait exists, OfficerPhoto shows a
 * placeholder.
 *
 * Phase 26B Part 6 Part A: the prior single-column stack (name, then one
 * field per line) wasted vertical AND horizontal space once Email/LINE/
 * Career Years/Age/DOB were added. Those now sit in a compact 2-column info
 * grid to the right of the portrait — still never truncating (each cell
 * wraps its own text), just denser. The verification badge stays large and
 * prominent, anchored top-right of the info column so it's the first thing
 * scanned after the name.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { officerFullName, currentTimelineRow } from "@/lib/ui/officer_summary";
import { isValidTimelineVerificationStatus, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import { calculateCareerYearsSimple } from "@/lib/officer_profile/career_calculator";
import { calculateCurrentAge } from "@/lib/officer_profile/retirement_calculator";
import { currentYearBE } from "@/lib/officer_profile/thai_date";
import { formatFullThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { QualityBadge } from "@/components/common/quality_badge";
import { PortraitManager } from "@/components/officer/portrait_manager";
import { PhoneAction } from "@/components/officer/phone_action";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Building2, Mail, MessageCircle, ShieldCheck, Cake, CalendarClock } from "lucide-react";

export interface ProfileHeaderProps {
  officer: OfficerWithRelations;
  /**
   * The trusted portrait for this officer, resolved from a matched
   * ProfilePhoto (or all-null when none exists). The legacy officer image is
   * never used — see resolveOfficerPortrait.
   */
  portrait: ResolvedOfficerPortrait;
  /** Phase 27: the shared OrganizationEngine, for resolving Current Organization in the header (Not Assigned fallback — same convention as CurrentOrganizationSection). */
  organizationEngine: OrganizationEngine;
  /** Forwarded to PortraitManager so the Photo Gallery can re-fetch after portrait mutations. */
  onPortraitChanged?: () => void;
}

/** One compact header field: icon + label + value, wraps rather than truncates. */
function HeaderField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
        <dd className="wrap-break-word text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

/** Verification badge (Part G): sourced from the officer's current (most recent) timeline row — VERIFIED=green, PENDING=orange, REJECTED=red, NEEDS_REVIEW=blue. A neutral "not yet verified" badge shows when no row has ever been reviewed, so verification status is ALWAYS visible in the header (Part A: "remains highly visible"). */
function VerificationBadge({ officer }: { officer: OfficerWithRelations }) {
  const row = currentTimelineRow(officer.timeline);
  const status = row?.verificationStatus;
  if (!status || !isValidTimelineVerificationStatus(status)) {
    return (
      <Badge tone="neutral">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        ยังไม่ตรวจสอบ / Not Verified
      </Badge>
    );
  }
  const meta = VERIFICATION_STATUS_META[status];
  return (
    <Badge tone={meta.color} className="px-3 py-1 text-sm">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.labelTh} / {meta.labelEn}
    </Badge>
  );
}

export function ProfileHeader({ officer, portrait, organizationEngine, onPortraitChanged }: ProfileHeaderProps) {
  const name = officerFullName(officer);
  const careerYears = calculateCareerYearsSimple(officer.timeline, currentYearBE());
  const currentAge = calculateCurrentAge(officer.dateOfBirth ?? null);
  const orgLabels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId ?? null,
    regionId: officer.regionId ?? null,
    battalionId: officer.battalionId ?? null,
    companyId: officer.companyId ?? null,
  });
  const currentOrganization = [orgLabels.company, orgLabels.battalion, orgLabels.borderPatrolDivision, orgLabels.headquarters]
    .filter(Boolean)
    .join(" / ");

  return (
    <header className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Phase 24B-1: the portrait is always shown (image or placeholder) and
            is now uploadable/replaceable/removable. The current portrait comes
            ONLY from a trusted/uploaded ProfilePhoto (resolveOfficerPortrait);
            the legacy officer image is never used. Size is unchanged by Part A. */}
        <div className="relative shrink-0">
          <PortraitManager
            officerId={officer.officerId}
            name={name}
            thumbnailUrl={portrait.thumbnailUrl}
            driveFileId={portrait.driveFileId}
            webViewUrl={portrait.webViewUrl}
            source={portrait.source}
            onChanged={onPortraitChanged}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Name row: rank + full name (never truncated, wraps if needed) on the left, verification badge pinned top-right so it's always the first thing scanned. */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted">{officer.rank || "—"}</p>
              <h1 title={name} className="wrap-break-word text-2xl leading-tight font-semibold text-foreground">
                {name}
              </h1>
              <p className="text-xs text-muted/70">English Name — coming soon</p>
            </div>
            <VerificationBadge officer={officer} />
          </div>

          {/* Phase 26B Part 6 Part A: compact 2-column info grid — every field
              from the spec's list, none truncated (each cell wraps). */}
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <HeaderField icon={Briefcase} label="Current Position" value={officer.currentPosition} />
            <HeaderField icon={Building2} label="Current Organization" value={currentOrganization || "ยังไม่ได้ระบุ / Not Assigned"} />
            <HeaderField icon={Mail} label="Email" value={officer.email} />
            <HeaderField icon={MessageCircle} label="LINE" value={officer.lineId} />
            <HeaderField icon={CalendarClock} label="Career Years" value={careerYears > 0 ? `${careerYears} ปี / years` : null} />
            <HeaderField icon={Cake} label="Current Age" value={currentAge !== null ? `${currentAge} ปี / years` : null} />
            <HeaderField icon={Cake} label="Date of Birth" value={officer.dateOfBirth ? formatFullThaiDateTh(officer.dateOfBirth) : null} />
          </dl>

          {officer.phone ? (
            <div className="mt-3">
              <PhoneAction phone={officer.phone} />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <QualityBadge score={officer.qualityScore} />
            {officer.region ? <Badge>{officer.region}</Badge> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
