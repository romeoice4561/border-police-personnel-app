/**
 * ProfileHeader (Phase 21A — Editable Profile Foundation; Phase 23A —
 * Section 1: full header fields + phone copy/tel: action; Phase 23B —
 * trusted-portrait-only, bug #2 fix; Phase 26B Part 5 Part A — no-truncation
 * redesign).
 *
 * The officer detail hero. Phase 23B: the portrait comes ONLY from a
 * trusted ProfilePhoto match (resolved server-side via
 * resolveOfficerPortrait) — the legacy `Officer.driveFileId`/`thumbnailUrl`
 * is NEVER used, because production data showed those systematically point at
 * deployment maps / org charts / profile-card composites rather than
 * portraits. When no trusted portrait exists, OfficerPhoto shows a
 * placeholder.
 *
 * Phase 26B Part 5 Part A: names were being clipped by `truncate` (e.g. a
 * long Thai surname like "อุทุมเทียรดี ขุน..."). The fix is layout, not font
 * size — everything now sits in a single column to the RIGHT of the
 * portrait, the name is allowed to wrap onto 2 lines instead of being
 * clipped, and `title={name}` surfaces the full name on hover even when
 * wrapped. Portrait size is unchanged (still driven by PortraitManager).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { officerFullName, currentTimelineRow } from "@/lib/ui/officer_summary";
import { isValidTimelineVerificationStatus, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import { QualityBadge } from "@/components/common/quality_badge";
import { PortraitManager } from "@/components/officer/portrait_manager";
import { PhoneAction } from "@/components/officer/phone_action";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Building2, ShieldCheck } from "lucide-react";

export interface ProfileHeaderProps {
  officer: OfficerWithRelations;
  /**
   * The trusted portrait for this officer, resolved from a matched
   * ProfilePhoto (or all-null when none exists). The legacy officer image is
   * never used — see resolveOfficerPortrait.
   */
  portrait: ResolvedOfficerPortrait;
}

function HeaderStat({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") return null;
  return (
    <div className="text-center sm:text-left">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Verification badge (Phase 26B Part 5 Part A/H): sourced from the officer's current (most recent) timeline row — VERIFIED=green, PENDING=orange, REJECTED=red, NEEDS_REVIEW=blue. Hidden until a row has been verified at least once. */
function VerificationBadge({ officer }: { officer: OfficerWithRelations }) {
  const row = currentTimelineRow(officer.timeline);
  const status = row?.verificationStatus;
  if (!status || !isValidTimelineVerificationStatus(status)) return null;
  const meta = VERIFICATION_STATUS_META[status];
  return (
    <Badge tone={meta.color}>
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {meta.labelTh} / {meta.labelEn}
    </Badge>
  );
}

export function ProfileHeader({ officer, portrait }: ProfileHeaderProps) {
  const name = officerFullName(officer);

  return (
    <header className="flex flex-col gap-4">
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
          />
        </div>

        {/* Phase 26B Part 5 Part A: everything lives in one column right of the
            portrait — rank, full name (2-line wrap, never truncated, full text
            on hover), an English-name placeholder for future bilingual data,
            current position/organization, phone, and the verification badge. */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm text-muted">{officer.rank || "—"}</p>
          <h1 title={name} className="wrap-break-word text-2xl leading-tight font-semibold text-foreground xl:max-w-2xl">
            {name}
          </h1>
          <p className="text-xs text-muted/70">English Name — coming soon</p>

          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="wrap-break-word">{officer.currentPosition || "—"}</span>
          </p>
          {officer.currentUnit ? (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="wrap-break-word">{officer.currentUnit}</span>
            </p>
          ) : null}
          {officer.phone ? <PhoneAction phone={officer.phone} /> : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <QualityBadge score={officer.qualityScore} />
            {officer.region ? <Badge>{officer.region}</Badge> : null}
            <VerificationBadge officer={officer} />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-neutral-bg/40 p-3 sm:grid-cols-4">
        <HeaderStat label="หน่วย" value={officer.currentUnit} />
        <HeaderStat label="ภาค" value={officer.region} />
        <HeaderStat label="อายุราชการ" value={officer.careerYears > 0 ? `${officer.careerYears} ปี` : null} />
        <HeaderStat label="คะแนนคุณภาพ" value={officer.qualityScore !== null ? `${officer.qualityScore}/100` : null} />
      </dl>
    </header>
  );
}
