/**
 * ProfileHeader (Phase 21A — Editable Profile Foundation).
 *
 * Enhances the officer detail hero for a future-editable profile:
 *   - Portrait display priority: Official Portrait -> extracted (Drive) photo
 *     -> placeholder. `officialPortraitUrl` has no backing data source yet
 *     (Part 4 is architecture-only), so it is always undefined today and the
 *     extracted photo/placeholder path (unchanged from Phase 17B/18A) is what
 *     actually renders — this component is simply ready for the day a real
 *     Official Portrait URL exists.
 *   - A "Change Photo" action, disabled with an explanatory tooltip (no
 *     upload in this phase).
 *
 * Supersedes OfficerSummaryHeader on the detail page; OfficerSummaryHeader
 * itself is left unmodified (still used/tested elsewhere) — this is a new,
 * additive component.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Camera } from "lucide-react";

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

export function ProfileHeader({ officer, officialPortraitUrl }: ProfileHeaderProps) {
  const name = officerFullName(officer);

  // Display priority: Official Portrait -> extracted (Drive) photo -> placeholder.
  // OfficerPhoto already renders the placeholder when its thumbnailUrl is null,
  // so passing the prioritized URL through covers all three tiers.
  const portraitUrl = officialPortraitUrl ?? officer.thumbnailUrl;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
        <p className="mt-0.5 truncate text-sm text-muted">{officer.currentPosition || "—"}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QualityBadge score={officer.qualityScore} />
        {officer.region ? <Badge>{officer.region}</Badge> : null}
        <Tooltip label="Available in a future update">
          <Button type="button" variant="outline" size="sm" disabled aria-label="Change photo (available in a future update)">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            Change Photo
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
