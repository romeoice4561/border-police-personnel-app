/**
 * DI-7.5 — Duplicate / Repeat Person Comparison Intelligence workspace.
 *
 * Upgraded from the DI-2 Round B baseline. This is ONE investigation
 * workspace where an analyst can see all comparison data without opening
 * multiple pages manually.
 *
 * SAFETY RULES (Section 0):
 *   - NEVER auto-merge
 *   - NEVER conclude "เป็นบุคคลเดียวกันแน่นอน"
 *   - NEVER present percentage probability
 *   - Informational fields (sex/nationality/age) are context only — not proof
 *   - All decisions require explicit human confirmation
 *
 * Layout:
 *   Desktop: tabbed workspace with two-column comparison table
 *   Mobile:  stacked Person A → Person B sections (no horizontal squeeze)
 */
"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, X, HelpCircle, AlertTriangle, Info,
  Phone, Smartphone, Car, Network, FileText, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrugMatchConfidenceBadge } from "@/components/drug_intelligence/drug_match_confidence_badge";
import { DrugMatchSignalsList } from "@/components/drug_intelligence/drug_match_signals_list";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useDrugPersonProfile,
  useDrugPotentialDuplicates,
  useDecideDrugMatchReview,
} from "@/lib/drug_intelligence/drug_intelligence_hooks";
import {
  presentIdentifierValue,
  presentPhoneNumber,
} from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  ApiClientError,
  type DrugPersonProfileResponse,
  type DrugCaseLinkSummary,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  compareScalar,
  compareInformational,
  compareArrayOverlap,
  compareIdentifiers,
  findSharedPhones,
  findSharedImeis,
  findSharedVehicles,
  findSharedCases,
  findSharedNetworkGroups,
  findSharedIdentifierKeys,
  buildProfileUrl,
  buildTimelineUrl,
  buildNetworkUrl,
  type FieldComparison,
  type FieldComparisonStatus,
} from "@/lib/drug_intelligence/drug_person_comparison_helpers";
import {
  DRUG_NETWORK_ROLE_LABELS,
  isValidDrugNetworkRole,
  DRUG_PERSON_SEX_LABELS,
  isValidDrugPersonSex,
} from "@/lib/drug_intelligence/drug_person_options";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import type { TranslationKey } from "@/lib/i18n/dictionary";

// ── Status rendering ─────────────────────────────────────────────────────────

function statusIcon(status: FieldComparisonStatus) {
  if (status === "match") return <Check className="h-3.5 w-3.5 text-good" aria-hidden="true" />;
  if (status === "conflict") return <AlertTriangle className="h-3.5 w-3.5 text-critical" aria-hidden="true" />;
  if (status === "informational") return <Info className="h-3.5 w-3.5 text-accent" aria-hidden="true" />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted" aria-hidden="true" />;
}

function statusLabelKey(status: FieldComparisonStatus): TranslationKey {
  if (status === "match") return "di.matchReview.statusMatch";
  if (status === "conflict") return "di.matchReview.statusConflict";
  if (status === "informational") return "di.matchReview.statusInformational";
  return "di.matchReview.statusMissing";
}

// ── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { key: "identity", labelKey: "di.matchReview.tabIdentity" },
  { key: "cases", labelKey: "di.matchReview.tabCases" },
  { key: "phones", labelKey: "di.matchReview.tabPhonesSims" },
  { key: "devices", labelKey: "di.matchReview.tabDevicesVehicles" },
  { key: "network", labelKey: "di.matchReview.tabNetwork" },
] as const satisfies ReadonlyArray<{ key: string; labelKey: TranslationKey }>;

type TabKey = (typeof TABS)[number]["key"];

// ── Page entry ───────────────────────────────────────────────────────────────

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
  const { t } = useT();

  const profileA = useDrugPersonProfile(user?.id ?? null, personAId);
  const profileB = useDrugPersonProfile(user?.id ?? null, personBId);
  const candidates = useDrugPotentialDuplicates(user?.id ?? null, personAId);

  const decide = useDecideDrugMatchReview(user?.id ?? null, user?.displayName ?? "");
  const [confirmingAction, setConfirmingAction] = useState<"NOT_SAME" | "CONFIRMED_DUPLICATE" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  if (!personAId || !personBId) {
    return <ErrorState message={t("di.error.validation")} />;
  }

  if (profileA.isPending || profileB.isPending) return <LoadingState />;
  if (profileA.isError || profileB.isError) {
    const err = (profileA.error ?? profileB.error) as Error;
    return (
      <ErrorState
        message={err.message}
        onRetry={() => { profileA.refetch(); profileB.refetch(); }}
      />
    );
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
      notes: decisionNotes.trim() || null,
    });
    setConfirmingAction(null);
    setDecisionNotes("");
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

      {/* ── Header: Person A ↔ Person B ── */}
      <PersonPairHeader a={a} b={b} personAId={personAId} personBId={personBId} />

      {/* ── System explanation banner ── */}
      <Card className="border-accent/30 bg-accent/5">
        <CardBody className="flex items-start gap-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">{t("di.matchReview.duplicateCandidateMode")}</p>
            <p className="mt-0.5 text-muted">{t("di.matchReview.systemExplanation")}</p>
          </div>
        </CardBody>
      </Card>

      {/* ── Existing decision banners ── */}
      {existingDecision === "NOT_SAME" ? (
        <Card className="border-neutral/40 bg-neutral-bg/60">
          <CardBody className="text-sm text-foreground">{t("di.matchReview.alreadyNotSame")}</CardBody>
        </Card>
      ) : existingDecision === "CONFIRMED_DUPLICATE" ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="space-y-2 text-sm text-foreground">
            <p>{t("di.matchReview.alreadyConfirmed")}</p>
            {canMerge ? (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.confirmDuplicateNextStep")}</span>
                <Button asChild size="sm">
                  <Link href={`/drug-intelligence/review/duplicates/merge?survivor=${encodeURIComponent(personAId)}&merged=${encodeURIComponent(personBId)}`}>
                    {t("di.merge.startMerge")}
                  </Link>
                </Button>
              </div>
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

      {/* ── Match signals / confidence ── */}
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

      {/* ── Tabbed comparison workspace ── */}
      <div>
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-px" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-t px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeTab === "identity" && (
            <IdentityTab a={a} b={b} canViewFull={canViewFull} />
          )}
          {activeTab === "cases" && (
            <CasesTab a={a} b={b} personAId={personAId} personBId={personBId} />
          )}
          {activeTab === "phones" && (
            <PhonesSimsTab a={a} b={b} canViewFull={canViewFull} />
          )}
          {activeTab === "devices" && (
            <DevicesVehiclesTab a={a} b={b} canViewFull={canViewFull} />
          )}
          {activeTab === "network" && (
            <NetworkTab a={a} b={b} personAId={personAId} personBId={personBId} />
          )}
        </div>
      </div>

      {/* ── Shared Entity Intelligence ── */}
      <SharedEntitiesSection a={a} b={b} canViewFull={canViewFull} />

      {/* ── Decision actions ── */}
      {!canDecide ? (
        <Card className="border-neutral/40">
          <CardBody className="text-sm text-muted">{t("di.matchReview.readOnlyNotice")}</CardBody>
        </Card>
      ) : existingDecision === null ? (
        <Card>
          <CardBody className="space-y-3">
            <div>
              <label htmlFor="decision-notes" className="mb-1 block text-xs font-medium text-muted">
                {t("di.matchReview.notesLabel")}
              </label>
              <textarea
                id="decision-notes"
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder={t("di.matchReview.notesPlaceholder")}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingAction("NOT_SAME")}
                disabled={decide.isPending}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {t("di.matchReview.markNotSame")}
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmingAction("CONFIRMED_DUPLICATE")}
                disabled={decide.isPending}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {t("di.matchReview.confirmDuplicate")}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {decide.isError ? (
        <Card className="border-critical/40 bg-critical/5">
          <CardBody className="text-sm text-critical">
            {decide.error instanceof ApiClientError && decide.error.status === 409
              ? t("di.matchReview.alreadyResolved")
              : t("di.matchReview.actionFailed")}
          </CardBody>
        </Card>
      ) : null}

      {confirmingAction ? (
        <ConfirmDecisionModal
          action={confirmingAction}
          notes={decisionNotes}
          pending={decide.isPending}
          onCancel={() => setConfirmingAction(null)}
          onConfirm={() => handleDecision(confirmingAction)}
        />
      ) : null}
    </div>
  );
}

// ── Person pair header ───────────────────────────────────────────────────────

function PersonPairHeader({
  a,
  b,
  personAId,
  personBId,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  personAId: string;
  personBId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <PersonSummaryCard
        person={a}
        sideLabel="A"
        profileUrl={buildProfileUrl(personAId)}
        timelineUrl={buildTimelineUrl(personAId)}
        networkUrl={buildNetworkUrl(personAId)}
        profileLabelKey="di.matchReview.openProfileA"
      />
      <div className="flex items-center justify-center text-xl font-semibold text-muted">↔</div>
      <PersonSummaryCard
        person={b}
        sideLabel="B"
        profileUrl={buildProfileUrl(personBId)}
        timelineUrl={buildTimelineUrl(personBId)}
        networkUrl={buildNetworkUrl(personBId)}
        profileLabelKey="di.matchReview.openProfileB"
      />
    </div>
  );
}

function PersonSummaryCard({
  person,
  sideLabel,
  profileUrl,
  timelineUrl,
  networkUrl,
  profileLabelKey,
}: {
  person: DrugPersonProfileResponse;
  sideLabel: "A" | "B";
  profileUrl: string;
  timelineUrl: string;
  networkUrl: string;
  profileLabelKey: TranslationKey;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("di.matchReview.fieldName")} {sideLabel}
        </p>
        <p className="text-base font-semibold text-foreground">{person.person.primaryFullName}</p>
        {person.person.nickname ? (
          <p className="text-sm text-muted">&ldquo;{person.person.nickname}&rdquo;</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline">
            <Link href={profileUrl}>
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {t(profileLabelKey)}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={timelineUrl}>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.matchReview.openTimeline")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={networkUrl}>
              <Network className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.matchReview.openNetwork")}
            </Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Comparison table helpers ─────────────────────────────────────────────────

function ComparisonRow({
  label,
  comparison,
  displayA,
  displayB,
}: {
  label: string;
  comparison: FieldComparison;
  displayA: string;
  displayB: string;
}) {
  const { t } = useT();
  return (
    <>
      {/* Desktop row */}
      <tr className="hidden border-b border-border last:border-0 md:table-row">
        <td className="px-4 py-3 text-xs font-medium text-muted">{label}</td>
        <td className="px-4 py-3 break-words text-sm text-foreground">{displayA}</td>
        <td className="px-4 py-3 break-words text-sm text-foreground">{displayB}</td>
        <td className="px-4 py-3">
          <span className="flex items-center gap-1 text-xs text-muted">
            {statusIcon(comparison.status)}
            {t(statusLabelKey(comparison.status))}
          </span>
        </td>
      </tr>
      {/* Mobile: two stacked rows */}
      <tr className="border-b border-border md:hidden">
        <td colSpan={2} className="px-3 py-2">
          <p className="text-xs font-medium text-muted">{label}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
            <span className="text-foreground">{displayA}</span>
            <span className="text-foreground">{displayB}</span>
          </div>
          <span className="mt-1 flex items-center gap-1 text-xs text-muted">
            {statusIcon(comparison.status)}
            {t(statusLabelKey(comparison.status))}
          </span>
        </td>
      </tr>
    </>
  );
}

function ComparisonTable({ children, nameA, nameB }: { children: React.ReactNode; nameA: string; nameB: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[34%]" />
          <col className="w-[34%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium"></th>
            <th scope="col" className="px-4 py-3 font-medium">{nameA}</th>
            <th scope="col" className="px-4 py-3 font-medium">{nameB}</th>
            <th scope="col" className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <thead className="md:hidden">
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" colSpan={2} className="px-3 py-2 font-medium">A: {nameA} / B: {nameB}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
  );
}

// ── Identity tab ─────────────────────────────────────────────────────────────

function IdentityTab({
  a,
  b,
  canViewFull,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  canViewFull: boolean;
}) {
  const { t } = useT();

  const aliasesA = a.aliases.map((x) => x.fullName).join(", ") || "—";
  const aliasesB = b.aliases.map((x) => x.fullName).join(", ") || "—";
  const aliasComp = compareScalar(
    a.aliases.map((x) => x.fullName).sort().join(",") || null,
    b.aliases.map((x) => x.fullName).sort().join(",") || null
  );

  const nameComp = compareScalar(a.person.primaryFullName, b.person.primaryFullName);
  const nickComp = compareScalar(a.person.nickname ?? null, b.person.nickname ?? null);
  const dobComp = compareScalar(
    a.person.dateOfBirth ? String(a.person.dateOfBirth) : null,
    b.person.dateOfBirth ? String(b.person.dateOfBirth) : null
  );
  const sexComp = compareInformational(a.person.sex ?? null, b.person.sex ?? null);
  const nationalityComp = compareInformational(a.person.nationality ?? null, b.person.nationality ?? null);
  const ageComp = compareInformational(
    a.person.approximateAge != null ? String(a.person.approximateAge) : null,
    b.person.approximateAge != null ? String(b.person.approximateAge) : null
  );

  const identifiersA = a.identifiers.map((x) => ({ type: x.type, value: x.value }));
  const identifiersB = b.identifiers.map((x) => ({ type: x.type, value: x.value }));
  const identComp = compareIdentifiers(identifiersA, identifiersB);
  const identDisplayA = a.identifiers.map((x) => presentIdentifierValue(x.value, canViewFull)).join(", ") || "—";
  const identDisplayB = b.identifiers.map((x) => presentIdentifierValue(x.value, canViewFull)).join(", ") || "—";

  const dobDisplayA = a.person.dateOfBirth ? formatDiDate(String(a.person.dateOfBirth)) : "—";
  const dobDisplayB = b.person.dateOfBirth ? formatDiDate(String(b.person.dateOfBirth)) : "—";

  return (
    <div className="space-y-1">
      <SectionHeading label={t("di.matchReview.identityDataSection")} />
      <ComparisonTable nameA={a.person.primaryFullName} nameB={b.person.primaryFullName}>
        <ComparisonRow label={t("di.matchReview.fieldName")} comparison={nameComp} displayA={a.person.primaryFullName} displayB={b.person.primaryFullName} />
        <ComparisonRow label={t("di.matchReview.fieldNickname")} comparison={nickComp} displayA={a.person.nickname || "—"} displayB={b.person.nickname || "—"} />
        <ComparisonRow label={t("di.matchReview.fieldAliases")} comparison={aliasComp} displayA={aliasesA} displayB={aliasesB} />
        <ComparisonRow label={t("di.matchReview.fieldDob")} comparison={dobComp} displayA={dobDisplayA} displayB={dobDisplayB} />
        <ComparisonRow
          label={t("di.matchReview.fieldSex")}
          comparison={sexComp}
          displayA={a.person.sex && isValidDrugPersonSex(a.person.sex) ? DRUG_PERSON_SEX_LABELS[a.person.sex].labelTh : a.person.sex || "—"}
          displayB={b.person.sex && isValidDrugPersonSex(b.person.sex) ? DRUG_PERSON_SEX_LABELS[b.person.sex].labelTh : b.person.sex || "—"}
        />
        <ComparisonRow label={t("di.matchReview.fieldAge")} comparison={ageComp} displayA={a.person.approximateAge != null ? String(a.person.approximateAge) : "—"} displayB={b.person.approximateAge != null ? String(b.person.approximateAge) : "—"} />
        <ComparisonRow label={t("di.matchReview.fieldNationality")} comparison={nationalityComp} displayA={a.person.nationality || "—"} displayB={b.person.nationality || "—"} />
      </ComparisonTable>

      <SectionHeading label={t("di.matchReview.documentsSection")} />
      <ComparisonTable nameA={a.person.primaryFullName} nameB={b.person.primaryFullName}>
        <ComparisonRow label={t("di.matchReview.fieldIdentifiers")} comparison={identComp} displayA={identDisplayA} displayB={identDisplayB} />
      </ComparisonTable>
    </div>
  );
}

// ── Phones / SIMs tab ────────────────────────────────────────────────────────

function PhonesSimsTab({
  a,
  b,
  canViewFull,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  canViewFull: boolean;
}) {
  const { t } = useT();

  const phonesA = a.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const phonesB = b.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const phoneComp = compareArrayOverlap(phonesA, phonesB);
  const phoneDisplayA = phonesA.map((p) => presentPhoneNumber(p, canViewFull)).join(", ") || "—";
  const phoneDisplayB = phonesB.map((p) => presentPhoneNumber(p, canViewFull)).join(", ") || "—";

  const simsA = a.sims.map((s) => s.sim?.iccid).filter(Boolean) as string[];
  const simsB = b.sims.map((s) => s.sim?.iccid).filter(Boolean) as string[];
  const simComp = compareArrayOverlap(simsA, simsB);
  const simDisplayA = simsA.map((s) => presentIdentifierValue(s, canViewFull)).join(", ") || "—";
  const simDisplayB = simsB.map((s) => presentIdentifierValue(s, canViewFull)).join(", ") || "—";

  return (
    <ComparisonTable nameA={a.person.primaryFullName} nameB={b.person.primaryFullName}>
      <ComparisonRow label={t("di.matchReview.fieldPhones")} comparison={phoneComp} displayA={phoneDisplayA} displayB={phoneDisplayB} />
      <ComparisonRow label={t("di.matchReview.fieldSims")} comparison={simComp} displayA={simDisplayA} displayB={simDisplayB} />
    </ComparisonTable>
  );
}

// ── Devices / Vehicles tab ───────────────────────────────────────────────────

function DevicesVehiclesTab({
  a,
  b,
  canViewFull,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  canViewFull: boolean;
}) {
  const { t } = useT();

  const devicesA = a.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const devicesB = b.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const devComp = compareArrayOverlap(devicesA, devicesB);
  const devDisplayA = devicesA.map((d) => presentIdentifierValue(d, canViewFull)).join(", ") || "—";
  const devDisplayB = devicesB.map((d) => presentIdentifierValue(d, canViewFull)).join(", ") || "—";

  const vehiclesA = a.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const vehiclesB = b.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const vehicleComp = compareArrayOverlap(vehiclesA, vehiclesB);

  return (
    <ComparisonTable nameA={a.person.primaryFullName} nameB={b.person.primaryFullName}>
      <ComparisonRow label={t("di.matchReview.fieldDevices")} comparison={devComp} displayA={devDisplayA} displayB={devDisplayB} />
      <ComparisonRow label={t("di.matchReview.fieldVehicles")} comparison={vehicleComp} displayA={vehiclesA.join(", ") || "—"} displayB={vehiclesB.join(", ") || "—"} />
    </ComparisonTable>
  );
}

// ── Network tab ──────────────────────────────────────────────────────────────

function NetworkTab({
  a,
  b,
  personAId,
  personBId,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  personAId: string;
  personBId: string;
}) {
  const { t } = useT();

  const membershipsA = a.networkMemberships ?? [];
  const membershipsB = b.networkMemberships ?? [];
  const groupIdsA = membershipsA.map((m) => m.networkGroupId);
  const groupIdsB = membershipsB.map((m) => m.networkGroupId);
  const groupComp = compareArrayOverlap(
    membershipsA.map((m) => m.networkGroupName ?? m.networkGroupId),
    membershipsB.map((m) => m.networkGroupName ?? m.networkGroupId)
  );
  const groupDisplayA = membershipsA.map((m) => m.networkGroupName ?? m.networkGroupId).join(", ") || "—";
  const groupDisplayB = membershipsB.map((m) => m.networkGroupName ?? m.networkGroupId).join(", ") || "—";

  const rolesA = a.networkRoles ?? [];
  const rolesB = b.networkRoles ?? [];
  const roleLabelsA = rolesA.map((r) => isValidDrugNetworkRole(r.role) ? DRUG_NETWORK_ROLE_LABELS[r.role].labelTh : r.role);
  const roleLabelsB = rolesB.map((r) => isValidDrugNetworkRole(r.role) ? DRUG_NETWORK_ROLE_LABELS[r.role].labelTh : r.role);
  const roleComp = compareArrayOverlap(
    rolesA.map((r) => r.role),
    rolesB.map((r) => r.role)
  );

  const { sharedGroupIds } = findSharedNetworkGroups(groupIdsA, groupIdsB);

  return (
    <div className="space-y-4">
      <ComparisonTable nameA={a.person.primaryFullName} nameB={b.person.primaryFullName}>
        <ComparisonRow label={t("di.matchReview.fieldNetworkGroups")} comparison={groupComp} displayA={groupDisplayA} displayB={groupDisplayB} />
        <ComparisonRow label={t("di.matchReview.fieldNetworkRoles")} comparison={roleComp} displayA={roleLabelsA.join(", ") || "—"} displayB={roleLabelsB.join(", ") || "—"} />
      </ComparisonTable>

      {sharedGroupIds.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardBody className="text-sm">
            <p className="font-medium text-foreground">{t("di.matchReview.sharedNetworkLabel")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("di.matchReview.systemExplanation")}</p>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={buildNetworkUrl(personAId)}>
            <Network className="h-4 w-4" aria-hidden="true" />
            {t("di.matchReview.openProfileA")}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={buildNetworkUrl(personBId)}>
            <Network className="h-4 w-4" aria-hidden="true" />
            {t("di.matchReview.openProfileB")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Cases tab ────────────────────────────────────────────────────────────────

function CasesTab({
  a,
  b,
  personAId,
  personBId,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  personAId: string;
  personBId: string;
}) {
  const { t } = useT();

  const caseIdsA = a.cases.map((c) => c.caseId);
  const caseIdsB = b.cases.map((c) => c.caseId);
  const { sharedCaseIds } = findSharedCases(caseIdsA, caseIdsB);
  const sharedSet = new Set(sharedCaseIds);

  return (
    <div className="space-y-4">
      {sharedCaseIds.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardBody className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span className="font-medium text-foreground">{t("di.matchReview.sharedCasesLabel")}: {sharedCaseIds.length}</span>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CaseHistoryColumn
          label={`${t("di.matchReview.caseHistoryPersonA")} (${a.person.primaryFullName})`}
          cases={a.cases}
          sharedCaseIds={sharedSet}
          personId={personAId}
        />
        <CaseHistoryColumn
          label={`${t("di.matchReview.caseHistoryPersonB")} (${b.person.primaryFullName})`}
          cases={b.cases}
          sharedCaseIds={sharedSet}
          personId={personBId}
        />
      </div>
    </div>
  );
}

function CaseHistoryColumn({
  label,
  cases,
  sharedCaseIds,
  personId,
}: {
  label: string;
  cases: DrugCaseLinkSummary[];
  sharedCaseIds: Set<string>;
  personId: string;
}) {
  const { t } = useT();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {cases.length === 0 ? (
        <p className="text-sm text-muted">{t("di.matchReview.noCases")}</p>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.caseId}>
              <Card className={sharedCaseIds.has(c.caseId) ? "border-warning/40 bg-warning/5" : undefined}>
                <CardBody className="space-y-1">
                  {sharedCaseIds.has(c.caseId) ? (
                    <Badge tone="warning" className="text-xs">{t("di.matchReview.sharedCaseBadge")}</Badge>
                  ) : null}
                  <p className="font-medium text-foreground text-sm">{c.case?.caseNumber ?? c.caseId}</p>
                  {c.case?.province ? <p className="text-xs text-muted">{c.case.province}</p> : null}
                  {c.case?.arrestDate ? (
                    <p className="text-xs text-muted">{formatDiDate(c.case.arrestDate)}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`}>
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("di.matchReview.openCase")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={buildTimelineUrl(personId)}>
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("di.matchReview.openTimeline")}
                      </Link>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared entities section ──────────────────────────────────────────────────

function SharedEntitiesSection({
  a,
  b,
  canViewFull,
}: {
  a: DrugPersonProfileResponse;
  b: DrugPersonProfileResponse;
  canViewFull: boolean;
}) {
  const { t } = useT();

  const phonesA = a.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const phonesB = b.phones.map((p) => p.phoneNumber?.normalizedNumber).filter(Boolean) as string[];
  const devicesA = a.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const devicesB = b.devices.map((d) => d.device?.imei1).filter(Boolean) as string[];
  const vehiclesA = a.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const vehiclesB = b.vehicles.map((v) => v.vehicle?.registrationNumber).filter(Boolean) as string[];
  const caseIdsA = a.cases.map((c) => c.caseId);
  const caseIdsB = b.cases.map((c) => c.caseId);
  const groupIdsA = (a.networkMemberships ?? []).map((m) => m.networkGroupId);
  const groupIdsB = (b.networkMemberships ?? []).map((m) => m.networkGroupId);
  const identifiersA = a.identifiers.map((x) => ({ type: x.type, value: x.value }));
  const identifiersB = b.identifiers.map((x) => ({ type: x.type, value: x.value }));

  const { sharedNumbers } = findSharedPhones(phonesA, phonesB);
  const { sharedImeis } = findSharedImeis(devicesA, devicesB);
  const { sharedRegistrations } = findSharedVehicles(vehiclesA, vehiclesB);
  const { sharedCaseIds } = findSharedCases(caseIdsA, caseIdsB);
  const { sharedGroupIds } = findSharedNetworkGroups(groupIdsA, groupIdsB);
  const sharedIdentifierKeys = findSharedIdentifierKeys(identifiersA, identifiersB);

  const hasAnyShared =
    sharedNumbers.length > 0 ||
    sharedImeis.length > 0 ||
    sharedRegistrations.length > 0 ||
    sharedCaseIds.length > 0 ||
    sharedGroupIds.length > 0 ||
    sharedIdentifierKeys.length > 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.matchReview.sharedEntitiesTitle")}</p>
        {!hasAnyShared ? (
          <p className="text-sm text-muted">{t("di.matchReview.noSharedEntities")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sharedNumbers.length > 0 ? (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedPhonesLabel")}:</span>
                <span className="font-medium text-foreground">
                  {sharedNumbers.map((n) => presentPhoneNumber(n, canViewFull)).join(", ")}
                </span>
              </li>
            ) : null}
            {sharedImeis.length > 0 ? (
              <li className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedImeisLabel")}:</span>
                <span className="font-mono font-medium text-foreground">
                  {sharedImeis.map((i) => presentIdentifierValue(i, canViewFull)).join(", ")}
                </span>
              </li>
            ) : null}
            {sharedRegistrations.length > 0 ? (
              <li className="flex items-center gap-2">
                <Car className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedVehiclesLabel")}:</span>
                <span className="font-medium text-foreground">{sharedRegistrations.join(", ")}</span>
              </li>
            ) : null}
            {sharedIdentifierKeys.length > 0 ? (
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedIdentifiersLabel")}:</span>
                <span className="font-medium text-foreground">{sharedIdentifierKeys.length}</span>
              </li>
            ) : null}
            {sharedCaseIds.length > 0 ? (
              <li className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedCasesLabel")}:</span>
                <span className="font-medium text-foreground">{sharedCaseIds.length}</span>
              </li>
            ) : null}
            {sharedGroupIds.length > 0 ? (
              <li className="flex items-center gap-2">
                <Network className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-muted">{t("di.matchReview.sharedNetworkLabel")}:</span>
                <span className="font-medium text-foreground">{sharedGroupIds.length}</span>
              </li>
            ) : null}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Confirm decision modal ───────────────────────────────────────────────────

function ConfirmDecisionModal({
  action,
  notes,
  pending,
  onCancel,
  onConfirm,
}: {
  action: "NOT_SAME" | "CONFIRMED_DUPLICATE";
  notes: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  const titleKey = action === "NOT_SAME"
    ? "di.matchReview.markNotSameConfirmTitle"
    : "di.matchReview.confirmDuplicateConfirmTitle";
  const bodyKey = action === "NOT_SAME"
    ? "di.matchReview.markNotSameConfirmBody"
    : "di.matchReview.confirmDuplicateConfirmBody";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p className="text-base font-semibold text-foreground">{t(titleKey)}</p>
          <p className="text-sm text-muted">{t(bodyKey)}</p>
          {notes.trim() ? (
            <div className="rounded-lg border border-border bg-neutral-bg/60 px-3 py-2 text-sm text-muted">
              <span className="font-medium">{t("di.matchReview.notesLabel")}:</span> {notes}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {t("di.profile.cancel")}
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending
                ? t("di.profile.saving")
                : action === "NOT_SAME"
                  ? t("di.matchReview.markNotSame")
                  : t("di.matchReview.confirmDuplicate")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
