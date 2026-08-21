/**
 * Duplicate Review Queue (Phase DI-2 Round B — Section 10-13).
 *
 * Lists every unresolved active-person pair the Round A matching engine
 * flagged (a signal exists, no persisted decision yet — Section 19). No
 * merge button in the dense list itself (Section 10: "No merge button
 * directly in a dense list unless UX is unquestionably safe") — every pair
 * routes through a dedicated compare/review screen first.
 */
"use client";

import Link from "next/link";
import { GitCompareArrows, ShieldQuestion } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrugMatchConfidenceBadge } from "@/components/drug_intelligence/drug_match_confidence_badge";
import { DrugMatchSignalsList } from "@/components/drug_intelligence/drug_match_signals_list";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugMatchReviewQueue } from "@/lib/drug_intelligence/drug_intelligence_hooks";

export default function DrugDuplicateReviewQueuePage() {
  const { user } = useAuth();
  const { t } = useT();
  const queue = useDrugMatchReviewQueue(user?.id ?? null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.matchReview.title")}
        description={queue.data ? t("di.matchReview.unresolvedCount").replace("{count}", String(queue.data.length)) : t("di.matchReview.description")}
      />

      <Card className="border-accent/30 bg-accent/5">
        <CardBody className="flex items-start gap-2 text-sm text-muted">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span>{t("di.matchReview.description")}</span>
        </CardBody>
      </Card>

      {queue.isPending ? (
        <LoadingState />
      ) : queue.isError ? (
        <ErrorState message={(queue.error as Error).message} onRetry={() => queue.refetch()} />
      ) : queue.data.length === 0 ? (
        <EmptyState title={t("di.matchReview.emptyTitle")} icon={<GitCompareArrows className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {queue.data.map((pair) => (
            <Card key={`${pair.pairPersonId}-${pair.personId}`}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {pair.pairPersonName} <span className="text-muted">↔</span> {pair.primaryFullName}
                  </p>
                  <DrugMatchConfidenceBadge confidence={pair.confidence} />
                </div>
                <DrugMatchSignalsList signals={pair.signals} confidence={pair.confidence} />
                <Button asChild size="sm" variant="outline">
                  <Link href={`/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(pair.pairPersonId)}&b=${encodeURIComponent(pair.personId)}`}>
                    {t("di.matchReview.reviewAction")}
                  </Link>
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
