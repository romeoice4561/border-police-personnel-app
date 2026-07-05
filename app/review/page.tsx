/**
 * Review (Phase 14): surfaces records needing human attention — Poor/Fair
 * quality, low confidence, incomplete identity, missing phone/rank/timeline.
 * Fetches officers lowest-quality-first and flags issues client-side via the
 * pure review helper (no Quality Layer re-run; reads persisted scores/fields).
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useOfficers } from "@/lib/ui/hooks";
import { reviewFlags, needsReview, REVIEW_FLAG_LABELS, type ReviewFlag } from "@/lib/ui/review";
import { bandForScore } from "@/lib/ui/quality";
import { PageHeader } from "@/components/common/page_header";
import { Pagination } from "@/components/common/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";

const PAGE_SIZE = 20;

/** Tone for a review flag badge (reserved status colors). */
function flagTone(flag: ReviewFlag): "critical" | "warning" | "serious" {
  if (flag === "poor" || flag === "identity_incomplete" || flag === "missing_rank") return "critical";
  if (flag === "low_confidence" || flag === "missing_timeline") return "serious";
  return "warning";
}

export default function ReviewPage() {
  const [page, setPage] = useState(1);
  // Lowest quality first — the records most likely to need review surface first.
  const query = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, sortBy: "qualityScore", sortOrder: "asc" as const }),
    [page]
  );
  const officers = useOfficers(query);

  const flagged = (officers.data?.data ?? []).filter(needsReview);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review Queue"
        description="Records flagged for human review, lowest quality first."
      />

      {officers.isPending ? (
        <LoadingState />
      ) : officers.isError ? (
        <ErrorState message={(officers.error as Error).message} onRetry={() => officers.refetch()} />
      ) : flagged.length === 0 ? (
        <EmptyState
          title="Nothing to review on this page"
          message="No flagged records here. Try the next page, or the data is in good shape."
          icon={<ClipboardCheck className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {flagged.map((officer) => {
            const name = [officer.firstName, officer.lastName].filter(Boolean).join(" ") || officer.officerId;
            const flags = reviewFlags(officer);
            return (
              <Card key={officer.officerId}>
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <OfficerPhoto
                      thumbnailUrl={officer.thumbnailUrl}
                      driveFileId={officer.driveFileId}
                      webViewUrl={officer.webViewUrl}
                      name={name}
                      size={40}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/officers/${encodeURIComponent(officer.officerId)}`}
                          className="truncate font-medium text-accent hover:underline"
                        >
                          {name}
                        </Link>
                        <QualityBadge score={officer.qualityScore} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {officer.rank || "—"} · {officer.currentUnit || "—"} · {bandForScore(officer.qualityScore).band}
                      </p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {flags.map((flag) => (
                      <li key={flag}>
                        <Badge tone={flagTone(flag)}>{REVIEW_FLAG_LABELS[flag]}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {officers.data && officers.data.meta.total > 0 ? (
        <Pagination
          page={officers.data.meta.page}
          totalPages={officers.data.meta.totalPages}
          total={officers.data.meta.total}
          pageSize={officers.data.meta.pageSize}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
