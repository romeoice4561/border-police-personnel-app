/**
 * Duplicate Review Detail — side-by-side comparison (Phase DI-2 Round B —
 * Sections 11-19). Addressed by query params (?a=personId&b=personId) since
 * unresolved pairs have no persisted id until a decision is recorded.
 *
 * Match/Conflict/Missing status is communicated with icon + text, never
 * color alone (Section 11: "อย่าใช้สีอย่างเดียวในการสื่อความหมาย"). Actions are
 * strictly permission-gated: view (drug.read), NOT_SAME/confirm
 * (drug.edit), merge (drug.admin) — mirroring Section 13's exact mapping.
 */
"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, HelpCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrugMatchConfidenceBadge } from "@/components/drug_intelligence/drug_match_confidence_badge";
import { DrugMatchSignalsList } from "@/components/drug_intelligence/drug_match_signals_list";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugPersonProfile, useDrugPotentialDuplicates, useDecideDrugMatchReview } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { ApiClientError, type DrugPersonProfileResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const COMPARISON_FIELD_KEYS = [
  "di.matchReview.fieldName",
  "di.matchReview.fieldAliases",
  "di.matchReview.fieldIdentifiers",
  "di.matchReview.fieldDob",
  "di.matchReview.fieldPhones",
  "di.matchReview.fieldDevices",
  "di.matchReview.fieldVehicles",
  "di.matchReview.fieldCases",
  "di.matchReview.fieldFirstSeen",
  "di.matchReview.fieldLastSeen",
] as const satisfies readonly TranslationKey[];

type FieldStatus = "match" | "conflict" | "missing";

function statusIcon(status: FieldStatus) {
  if (status === "match") return <Check className="h-3.5 w-3.5 text-good" aria-hidden="true" />;
  if (status === "conflict") return <AlertTriangle className="h-3.5 w-3.5 text-critical" aria-hidden="true" />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted" aria-hidden="true" />;
}

function statusLabelKey(status: FieldStatus): "di.matchReview.statusMatch" | "di.matchReview.statusConflict" | "di.matchReview.statusMissing" {
  if (status === "match") return "di.matchReview.statusMatch";
  if (status === "conflict") return "di.matchReview.statusConflict";
  return "di.matchReview.statusMissing";
}

function compareValues(a: string | null, b: string | null): FieldStatus {
  if (!a && !b) return "missing";
  if (!a || !b) return "missing";
  return a === b ? "match" : "conflict";
}

export default function DrugDuplicateComparePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugDuplicateCompareContent />
    </Suspense>
  );
}

function DrugDuplicateCompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const personAId = searchParams.get("a") ?? "";
  const personBId = searchParams.get("b") ?? "";
  const { user, can } = useAuth();
  const { t, language } = useT();

  const profileA = useDrugPersonProfile(user?.id ?? null, personAId);
  const profileB = useDrugPersonProfile(user?.id ?? null, personBId);
  const candidates = useDrugPotentialDuplicates(user?.id ?? null, personAId);

  const decide = useDecideDrugMatchReview(user?.id ?? null, user?.displayName ?? "");
  const [confirmingAction, setConfirmingAction] = useState<"NOT_SAME" | "CONFIRMED_DUPLICATE" | null>(null);

  if (!personAId || !personBId) {
    return <ErrorState message={t("di.error.validation")} />;
  }

  if (profileA.isPending || profileB.isPending) {
    return <LoadingState />;
  }
  if (profileA.isError || profileB.isError) {
    const err = (profileA.error ?? profileB.error) as Error;
    return <ErrorState message={err.message} onRetry={() => { profileA.refetch(); profileB.refetch(); }} />;
  }

  const a = profileA.data;
  const b = profileB.data;
  const canViewFull = can("drug.edit");
  const canDecide = can("drug.edit");
  const canMerge = can("drug.admin");

  const pairCandidate = candidates.data?.candidates.find((c) => c.personId === personBId);
  const existingDecision = pairCandidate?.existingDecision ?? null;

  async function handleDecision(decision: "NOT_SAME" | "CONFIRMED_DUPLICATE") {
    await decide.mutateAsync({
      personAId,
      personBId,
      decision,
      signals: pairCandidate?.signals ?? [],
    });
    setConfirmingAction(null);
    // NOT_SAME resolves the pair entirely — back to the queue (Section 14).
    // CONFIRMED_DUPLICATE stays on this page so the reviewer immediately
    // sees the "เริ่มรวมข้อมูล" merge entry point (drug.admin) or the
    // "รอผู้มีสิทธิ์..." waiting notice (Section 15) — never silently
    // navigated away from the outcome of their own decision.
    if (decision === "NOT_SAME") {
      router.push("/drug-intelligence/review/duplicates");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.matchReview.detailTitle")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/drug-intelligence/review/duplicates">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("di.matchReview.backToQueue")}
            </Link>
          </Button>
        }
      />

      {existingDecision === "NOT_SAME" ? (
        <Card className="border-neutral/40 bg-neutral-bg/60">
          <CardBody className="text-sm text-foreground">{t("di.matchReview.alreadyNotSame")}</CardBody>
        </Card>
      ) : existingDecision === "CONFIRMED_DUPLICATE" ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="space-y-2 text-sm text-foreground">
            <p>{t("di.matchReview.alreadyConfirmed")}</p>
            {canMerge ? (
              <Button asChild size="sm">
                <Link href={`/drug-intelligence/review/duplicates/merge?survivor=${encodeURIComponent(personAId)}&merged=${encodeURIComponent(personBId)}`}>
                  {t("di.merge.startMerge")}
                </Link>
              </Button>
            ) : (
              <p className="text-muted">{t("di.matchReview.waitingForAdmin")}</p>
            )}
          </CardBody>
        </Card>
      ) : existingDecision === "MERGED" ? (
        <Card className="border-good/40 bg-good/5">
          <CardBody className="text-sm text-foreground">{t("di.matchReview.alreadyMerged")}</CardBody>
        </Card>
      ) : null}

      {pairCandidate ? (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.matchReview.signalsTitle")}</p>
              <DrugMatchConfidenceBadge confidence={pairCandidate.confidence} />
            </div>
            <DrugMatchSignalsList signals={pairCandidate.signals} confidence={pairCandidate.confidence} />
          </CardBody>
        </Card>
      ) : null}

      <ComparisonTable a={a} b={b} language={language} canViewFull={canViewFull} />

      {!canDecide ? (
        <Card className="border-neutral/40">
          <CardBody className="text-sm text-muted">{t("di.matchReview.readOnlyNotice")}</CardBody>
        </Card>
      ) : existingDecision === null ? (
        <Card>
          <CardBody className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmingAction("NOT_SAME")} disabled={decide.isPending}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("di.matchReview.markNotSame")}
            </Button>
            <Button type="button" onClick={() => setConfirmingAction("CONFIRMED_DUPLICATE")} disabled={decide.isPending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {t("di.matchReview.confirmDuplicate")}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {decide.isError ? (
        <Card className="border-critical/40 bg-critical/5">
          <CardBody className="text-sm text-critical">
            {decide.error instanceof ApiClientError && decide.error.status === 409 ? t("di.matchReview.alreadyResolved") : t("di.matchReview.actionFailed")}
          </CardBody>
        </Card>
      ) : null}

      {confirmingAction ? (
        <ConfirmDecisionModal
          action={confirmingAction}
          pending={decide.isPending}
          onCancel={() => setConfirmingAction(null)}
          onConfirm={() => handleDecision(confirmingAction)}
        />
      ) : null}
    </div>
  );
}

function ConfirmDecisionModal({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: "NOT_SAME" | "CONFIRMED_DUPLICATE";
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  const titleKey = action === "NOT_SAME" ? "di.matchReview.markNotSameConfirmTitle" : "di.matchReview.confirmDuplicateConfirmTitle";
  const bodyKey = action === "NOT_SAME" ? "di.matchReview.markNotSameConfirmBody" : "di.matchReview.confirmDuplicateConfirmBody";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p className="text-base font-semibold text-foreground">{t(titleKey)}</p>
          <p className="text-sm text-muted">{t(bodyKey)}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {t("di.profile.cancel")}
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? t("di.profile.saving") : action === "NOT_SAME" ? t("di.matchReview.markNotSame") : t("di.matchReview.confirmDuplicate")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ComparisonTable({
  a,
  b,
  language,
  canViewFull,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  language: "th" | "en";
  canViewFull: boolean;
}) {
  const { t } = useT();

  const aliasesA = a.aliases.map((x) => x.fullName).join(", ") || null;
  const aliasesB = b.aliases.map((x) => x.fullName).join(", ") || null;
  const identifiersA = a.identifiers.map((x) => `${x.type}:${x.value}`).join(", ") || null;
  const identifiersB = b.identifiers.map((x) => `${x.type}:${x.value}`).join(", ") || null;
  const identifiersDisplayA = a.identifiers.map((x) => presentIdentifierValue(x.value, canViewFull)).join(", ") || "—";
  const identifiersDisplayB = b.identifiers.map((x) => presentIdentifierValue(x.value, canViewFull)).join(", ") || "—";
  const dobA = a.person.dateOfBirth;
  const dobB = b.person.dateOfBirth;
  const phonesA = a.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const phonesB = b.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const devicesA = a.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const devicesB = b.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const vehiclesA = a.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const vehiclesB = b.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const casesA = new Set(a.cases.map((c) => c.caseId));
  const casesB = new Set(b.cases.map((c) => c.caseId));
  const sharedCases = [...casesA].filter((id) => casesB.has(id));

  function arrayOverlapStatus(x: string[], y: string[]): FieldStatus {
    if (x.length === 0 && y.length === 0) return "missing";
    if (x.length === 0 || y.length === 0) return "missing";
    return x.some((v) => y.includes(v)) ? "match" : "conflict";
  }

  const rows: Array<{ labelKey: (typeof COMPARISON_FIELD_KEYS)[number]; a: string; b: string; status: FieldStatus }> = [
    { labelKey: COMPARISON_FIELD_KEYS[0], a: a.person.primaryFullName, b: b.person.primaryFullName, status: compareValues(a.person.primaryFullName, b.person.primaryFullName) },
    { labelKey: COMPARISON_FIELD_KEYS[1], a: aliasesA ?? "—", b: aliasesB ?? "—", status: compareValues(aliasesA, aliasesB) },
    { labelKey: COMPARISON_FIELD_KEYS[2], a: identifiersDisplayA, b: identifiersDisplayB, status: compareValues(identifiersA, identifiersB) },
    { labelKey: COMPARISON_FIELD_KEYS[3], a: dobA ? new Date(dobA).toLocaleDateString(language === "th" ? "th-TH" : "en-US") : "—", b: dobB ? new Date(dobB).toLocaleDateString(language === "th" ? "th-TH" : "en-US") : "—", status: compareValues(dobA, dobB) },
    { labelKey: COMPARISON_FIELD_KEYS[4], a: phonesA.map((p) => presentPhoneNumber(p, canViewFull)).join(", ") || "—", b: phonesB.map((p) => presentPhoneNumber(p, canViewFull)).join(", ") || "—", status: arrayOverlapStatus(phonesA, phonesB) },
    { labelKey: COMPARISON_FIELD_KEYS[5], a: devicesA.map((d) => presentIdentifierValue(d, canViewFull)).join(", ") || "—", b: devicesB.map((d) => presentIdentifierValue(d, canViewFull)).join(", ") || "—", status: arrayOverlapStatus(devicesA, devicesB) },
    { labelKey: COMPARISON_FIELD_KEYS[6], a: vehiclesA.join(", ") || "—", b: vehiclesB.join(", ") || "—", status: arrayOverlapStatus(vehiclesA, vehiclesB) },
    { labelKey: COMPARISON_FIELD_KEYS[7], a: String(casesA.size), b: String(casesB.size), status: sharedCases.length > 0 ? "match" : "missing" },
    { labelKey: COMPARISON_FIELD_KEYS[8], a: new Date(a.firstSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US"), b: new Date(b.firstSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US"), status: "missing" },
    { labelKey: COMPARISON_FIELD_KEYS[9], a: new Date(a.lastSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US"), b: new Date(b.lastSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US"), status: "missing" },
  ];

  return (
    <>
      {/* Desktop: side-by-side table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[35%]" />
            <col className="w-[35%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium"></th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.merge.survivorLabel")}: {a.person.primaryFullName}</th>
              <th scope="col" className="px-4 py-3 font-medium">{b.person.primaryFullName}</th>
              <th scope="col" className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.labelKey} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-xs font-medium text-muted">{t(row.labelKey)}</td>
                <td className="px-4 py-3 wrap-break-word text-foreground">{row.a}</td>
                <td className="px-4 py-3 wrap-break-word text-foreground">{row.b}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {statusIcon(row.status)}
                    {t(statusLabelKey(row.status))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked "บุคคล A" then "บุคคล B" sections, preserving field-comparison meaning via the status badge on each field */}
      <div className="grid gap-3 md:hidden">
        {[{ person: a, sideLabel: "A" }, { person: b, sideLabel: "B" }].map(({ person, sideLabel }) => (
          <Card key={sideLabel}>
            <CardBody className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("di.matchReview.fieldName")} {sideLabel}: <span className="text-foreground">{person.person.primaryFullName}</span>
              </p>
              <dl className="space-y-2">
                {rows.map((row) => (
                  <div key={row.labelKey} className="flex items-start justify-between gap-2 text-sm">
                    <dt className="text-muted">{t(row.labelKey)}</dt>
                    <dd className="flex items-center gap-1 text-right text-foreground">
                      <span>{sideLabel === "A" ? row.a : row.b}</span>
                      {statusIcon(row.status)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
