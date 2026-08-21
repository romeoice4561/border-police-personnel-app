/**
 * Merge Preview + Confirm (Phase DI-2 Round B — Sections 15-18).
 *
 * Safety-critical: choose survivor -> preview (read-only, calls Round A's
 * preview() API) -> confirmation modal -> confirm merge. Buttons disabled
 * during submit (no double-submit); an already-resolved/concurrent merge
 * response is surfaced as a clear message, never a raw error. drug.admin
 * only — this route is reached only from the compare page's
 * drug.admin-gated "เริ่มรวมข้อมูล" button, and the mutation itself is
 * server-side permission-checked regardless.
 */
"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugMergePreview, useMergeDrugPersons } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";

export default function DrugPersonMergePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugPersonMergeContent />
    </Suspense>
  );
}

function DrugPersonMergeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, can } = useAuth();
  const { t } = useT();

  const initialSurvivor = searchParams.get("survivor") ?? "";
  const initialMerged = searchParams.get("merged") ?? "";
  const [survivorId, setSurvivorId] = useState(initialSurvivor);
  const [mergedId, setMergedId] = useState(initialMerged);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const preview = useDrugMergePreview(user?.id ?? null, survivorId, mergedId);
  const merge = useMergeDrugPersons(user?.id ?? null, user?.displayName ?? "");

  if (!can("drug.admin")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted">{t("di.merge.permissionRequired")}</p>
      </div>
    );
  }

  if (!survivorId || !mergedId) {
    return <ErrorState message={t("di.error.validation")} />;
  }

  function swapSurvivor() {
    setSurvivorId(mergedId);
    setMergedId(survivorId);
  }

  async function confirmMerge() {
    try {
      const result = await merge.mutateAsync({ survivorPersonId: survivorId, mergedPersonId: mergedId, reason: reason.trim() || null });
      router.push(`/drug-intelligence/persons/${encodeURIComponent(survivorId)}?merged=${encodeURIComponent(result.mergeId)}`);
    } catch {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.merge.previewTitle")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/drug-intelligence/review/duplicates">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("di.matchReview.backToQueue")}
            </Link>
          </Button>
        }
      />

      {preview.isPending ? (
        <LoadingState />
      ) : preview.isError ? (
        <ErrorState
          message={preview.error instanceof ApiClientError && preview.error.status === 409 ? t("di.merge.alreadyMergedError") : (preview.error as Error).message}
          onRetry={() => preview.refetch()}
        />
      ) : (
        <>
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.merge.chooseSurvivor")}</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-lg border border-good/40 bg-good/5 p-3">
                  <p className="text-xs text-muted">{t("di.merge.survivorLabel")}</p>
                  <p className="font-medium text-foreground">{preview.data.survivorName}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={swapSurvivor} className="justify-self-center" disabled={merge.isPending}>
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  {t("di.merge.swapButton")}
                </Button>
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <p className="text-xs text-muted">{t("di.merge.mergedLabel")}</p>
                  <p className="font-medium text-foreground">{preview.data.mergedName}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.merge.dataMovementTitle")}</p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MovedCountItem labelKey="di.merge.movedCases" value={preview.data.movedCounts.cases} />
                <MovedCountItem labelKey="di.merge.movedAliases" value={preview.data.movedCounts.aliases} />
                <MovedCountItem labelKey="di.merge.movedIdentifiers" value={preview.data.movedCounts.identifiers} />
                <MovedCountItem labelKey="di.merge.movedPhones" value={preview.data.movedCounts.phones} />
                <MovedCountItem labelKey="di.merge.movedSims" value={preview.data.movedCounts.sims} />
                <MovedCountItem labelKey="di.merge.movedDevices" value={preview.data.movedCounts.devices} />
                <MovedCountItem labelKey="di.merge.movedVehicles" value={preview.data.movedCounts.vehicles} />
              </dl>
              {preview.data.skippedDuplicateCaseLinks > 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  {t("di.merge.skippedDuplicateLinks")}: {preview.data.skippedDuplicateCaseLinks}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardBody className="text-sm text-foreground">{t("di.merge.resultExplanation")}</CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <label className="block text-xs font-medium text-muted" htmlFor="merge-reason">
                {t("di.merge.reasonLabel")}
              </label>
              <textarea
                id="merge-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {merge.isError ? (
                <p className="text-sm text-critical">
                  {merge.error instanceof ApiClientError && merge.error.status === 409 ? t("di.merge.alreadyMergedError") : t("di.merge.mergeFailed")}
                </p>
              ) : null}
              <Button type="button" onClick={() => setConfirming(true)} disabled={merge.isPending}>
                {t("di.merge.confirmButton")}
              </Button>
            </CardBody>
          </Card>

          {confirming ? (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="w-full max-w-md">
                <CardBody className="space-y-4">
                  <p className="text-base font-semibold text-foreground">{t("di.merge.confirmModalTitle")}</p>
                  <p className="text-sm text-muted">{t("di.merge.confirmModalBody")}</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={merge.isPending}>
                      {t("di.profile.cancel")}
                    </Button>
                    <Button type="button" onClick={confirmMerge} disabled={merge.isPending}>
                      {merge.isPending ? t("di.merge.merging") : t("di.merge.confirmButton")}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function MovedCountItem({ labelKey, value }: { labelKey: "di.merge.movedCases" | "di.merge.movedAliases" | "di.merge.movedIdentifiers" | "di.merge.movedPhones" | "di.merge.movedSims" | "di.merge.movedDevices" | "di.merge.movedVehicles"; value: number }) {
  const { t } = useT();
  return (
    <div>
      <dt className="text-xs text-muted">{t(labelKey)}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
