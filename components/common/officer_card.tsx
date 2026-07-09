/**
 * OfficerCard (Phase 14 UI): compact officer summary card (used in the mobile
 * officer list and anywhere a card view is wanted). Links to the detail page.
 */
"use client";

import Link from "next/link";
import { Phone, Building2, CalendarClock } from "lucide-react";
import type { OfficerSummary } from "@/lib/ui/api_client";
import { Card, CardBody } from "@/components/ui/card";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";

export function OfficerCard({ officer }: { officer: OfficerSummary }) {
  const name = [officer.firstName, officer.lastName].filter(Boolean).join(" ") || officer.officerId;

  return (
    <Link href={`/officers/${encodeURIComponent(officer.officerId)}`} className="block">
      <Card className="transition-colors hover:border-accent">
        <CardBody className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Phase 24B-3: portrait resolved server-side via the single
                  sanctioned batch resolver (never the legacy, unreliable
                  Officer.driveFileId/thumbnailUrl — Phase 23B). */}
              <OfficerPhoto
                name={name}
                thumbnailUrl={officer.thumbnailUrl}
                driveFileId={officer.driveFileId}
                webViewUrl={officer.webViewUrl}
                size={40}
              />
              <div>
                <p className="text-xs text-muted">{officer.rank || "—"}</p>
                <p className="font-semibold text-foreground">{name}</p>
              </div>
            </div>
            <QualityBadge score={officer.qualityScore} />
          </div>
          <p className="text-sm text-muted">{officer.currentPosition || "—"}</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              <dd>{officer.currentUnit || "—"}</dd>
            </div>
            <div className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <dd className="tabular-nums">{officer.phone || "—"}</dd>
            </div>
            <div className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <dd className="tabular-nums">{officer.careerYears} yrs</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </Link>
  );
}
