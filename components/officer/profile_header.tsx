/**
 * ProfileHeader (Phase 21A — Editable Profile Foundation; Phase 23A —
 * Section 1: full header fields + phone copy/tel: action; Phase 23B —
 * trusted-portrait-only, bug #2 fix).
 *
 * The officer detail hero. Phase 23B: the portrait comes ONLY from a
 * trusted ProfilePhoto match (resolved server-side via
 * resolveOfficerPortrait) — the legacy `Officer.driveFileId`/`thumbnailUrl`
 * is NEVER used, because production data showed those systematically point at
 * deployment maps / org charts / profile-card composites rather than
 * portraits. When no trusted portrait exists, OfficerPhoto shows a
 * placeholder. Shows: portrait, name, rank, position, unit, region, career
 * years, quality score, and the phone action.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { officerFullName } from "@/lib/ui/officer_summary";
import { QualityBadge } from "@/components/common/quality_badge";
import { PortraitManager } from "@/components/officer/portrait_manager";
import { PhoneAction } from "@/components/officer/phone_action";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";

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

export function ProfileHeader({ officer, portrait }: ProfileHeaderProps) {
  const name = officerFullName(officer);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Phase 24B-1: the portrait is always shown (image or placeholder) and
            is now uploadable/replaceable/removable. The current portrait comes
            ONLY from a trusted/uploaded ProfilePhoto (resolveOfficerPortrait);
            the legacy officer image is never used. */}
        <div className="relative shrink-0">
          <PortraitManager
            officerId={officer.officerId}
            name={name}
            thumbnailUrl={portrait.thumbnailUrl}
            driveFileId={portrait.driveFileId}
            webViewUrl={portrait.webViewUrl}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{officer.rank || "—"}</p>
          <h1 className="truncate text-2xl font-semibold text-foreground">{name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {officer.currentPosition || "—"}
            {officer.currentUnit ? ` · ${officer.currentUnit}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QualityBadge score={officer.qualityScore} />
          {officer.region ? <Badge>{officer.region}</Badge> : null}
          {officer.phone ? <PhoneAction phone={officer.phone} /> : null}
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
