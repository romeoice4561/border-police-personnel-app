/**
 * ProfileHeader (Phase 21A — Editable Profile Foundation; Phase 23A —
 * Section 1: full header fields + phone copy/tel: action).
 *
 * The officer detail hero. Portrait display priority: Official Portrait ->
 * extracted (Drive) photo -> placeholder (`officialPortraitUrl` remains
 * architecture-only — Part 4 — always undefined until a future phase adds a
 * real source). Shows: photo, name, rank, position, company (กองร้อย),
 * battalion (กองกำกับ), region (ภาค), career years, quality score, and the
 * phone action (desktop: click-to-copy; mobile: tel: link — see PhoneAction).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { PhoneAction } from "@/components/officer/phone_action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Camera, Briefcase } from "lucide-react";

export interface ProfileHeaderProps {
  officer: OfficerWithRelations;
  /**
   * Future Official Portrait URL (Part 4 — architecture only, no upload/
   * storage/API in this phase). Always undefined until a later phase adds a
   * real source; when present, it takes display priority over the extracted
   * Drive photo.
   */
  officialPortraitUrl?: string | null;
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

export function ProfileHeader({ officer, officialPortraitUrl }: ProfileHeaderProps) {
  const name = officerFullName(officer);

  // Display priority: Official Portrait -> extracted (Drive) photo -> placeholder.
  const portraitUrl = officialPortraitUrl ?? officer.thumbnailUrl;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <OfficerPhoto
            thumbnailUrl={portraitUrl}
            driveFileId={officer.driveFileId}
            webViewUrl={officer.webViewUrl}
            name={name}
            size={80}
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
          <Tooltip label="Available in a future update">
            <Button type="button" variant="outline" size="sm" disabled aria-label="Change photo (available in a future update)">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Change Photo
            </Button>
          </Tooltip>
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
