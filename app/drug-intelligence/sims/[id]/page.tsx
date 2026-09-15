/**
 * SIM entity detail (Phase DI-3 — Section 14; DI-9.5.2 presentation).
 * ICCID/IMSI, related persons, source cases. Never "owner".
 */
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugSimDetail } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { DrugEntityAlertSummary } from "@/components/drug_intelligence/drug_entity_alert_summary";
import {
  DrugEntityActionBar,
  DrugEntityFindings,
  DrugEntityHero,
  DrugEntityIdentityField,
  DrugEntityInfoNotice,
  DrugEntityKpiCard,
  DrugEntityRelatedCaseList,
  DrugEntityRelatedPersonList,
} from "@/components/drug_intelligence/drug_entity_detail_layout";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import {
  caseCountByPersonId,
  resolveEntityDetailCaseContext,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import { drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { PERSON_CASE_CONTEXT_PARAM } from "@/lib/drug_intelligence/person_case_context";
import { entityDetailBackHref, getSafeReturnTo } from "@/lib/ui/return_context";
import { entityDetailBackLabelKey } from "@/lib/ui/return_to_back_label";

export default function DrugSimDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const simId = decodeURIComponent(params.id);
  const { user, can } = useAuth();
  const { t } = useT();

  const detail = useDrugSimDetail(user?.id ?? null, simId);

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) {
    const isNotFound = detail.error instanceof ApiClientError && detail.error.status === 404;
    return <ErrorState title={isNotFound ? t("di.entity.notFound") : undefined} message={isNotFound ? undefined : (detail.error as Error).message} onRetry={isNotFound ? undefined : () => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");
  const iccidDisplay = data.sim.iccid ? presentIdentifierValue(data.sim.iccid, canViewFull) : t("di.entity.simTitle");
  const imsiDisplay = data.sim.imsi ? presentIdentifierValue(data.sim.imsi, canViewFull) : "—";
  const carrierDisplay = data.sim.carrier ?? "—";
  const personCounts = caseCountByPersonId(data.caseLinks);
  const currentCaseId = resolveEntityDetailCaseContext(
    searchParams.get(PERSON_CASE_CONTEXT_PARAM),
    data.sourceCases.map((item) => item.id)
  );
  const inboundReturnTo = getSafeReturnTo(searchParams);
  const findings: string[] = [];
  if (data.caseCount > 0) findings.push(t("di.entity.simFindingsCases").replace("{count}", String(data.caseCount)));
  if (data.relatedPersonCount > 0) findings.push(t("di.entity.simFindingsPersons").replace("{count}", String(data.relatedPersonCount)));

  return (
    <div className="space-y-5">
      <DrugEntityHero
        entityType="SIM"
        title={iccidDisplay}
        subtitle={t("di.entity.simTitleIccid")}
        caseCount={data.caseCount}
        copyValue={data.sim.iccid ? iccidDisplay : null}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DrugEntityIdentityField
          emoji="💳"
          label={t("di.entity.iccid")}
          value={data.sim.iccid ? iccidDisplay : "—"}
          copyValue={data.sim.iccid ? iccidDisplay : null}
        />
        <DrugEntityIdentityField
          emoji="📡"
          label={t("di.entity.imsi")}
          value={imsiDisplay}
          copyValue={data.sim.imsi ? imsiDisplay : null}
        />
        <DrugEntityIdentityField emoji="📶" label={t("di.entity.carrier")} value={carrierDisplay} />
      </div>

      <DrugEntityActionBar
        networkHref={drugNetworkFocusPath("SIM", simId)}
        timelineHref={`/drug-intelligence/timeline?simId=${encodeURIComponent(simId)}`}
        backHref={entityDetailBackHref(searchParams)}
        backLabelKey={entityDetailBackLabelKey(inboundReturnTo)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DrugEntityKpiCard emoji="📅" label={t("di.entity.firstSeen")} value={formatDiDate(data.firstSeenAt)} />
        <DrugEntityKpiCard emoji="🗓️" label={t("di.entity.lastSeen")} value={formatDiDate(data.lastSeenAt)} />
        <DrugEntityKpiCard emoji="📚" label={t("di.entity.caseCountKpi")} value={t("di.entity.kpiCaseCountValue").replace("{count}", String(data.caseCount))} />
        <DrugEntityKpiCard emoji="👥" label={t("di.entity.relatedPersonCountKpi")} value={t("di.entity.kpiPersonCountValue").replace("{count}", String(data.relatedPersonCount))} />
      </div>

      <DrugEntityFindings items={findings} />
      {shouldShowRecurrenceBadge(data.caseCount) ? (
        <p className="text-sm leading-relaxed text-foreground">{t("di.entity.simRepeatedStory").replace("{count}", String(data.caseCount))}</p>
      ) : null}

      <DrugEntityAlertSummary entityType="SIM" entityId={simId} titleKey="di.alert.entityHistoryTitle" />

      <DrugEntityRelatedPersonList
        persons={data.relatedPersons.map((person) => ({
          id: person.id,
          name: person.primaryFullName,
          linkedCaseCount: personCounts.get(person.id),
        }))}
      />

      <DrugEntityRelatedCaseList
        currentCaseId={currentCaseId}
        cases={data.sourceCases.map((drugCase) => ({
          id: drugCase.id,
          caseNumber: drugCase.caseNumber,
          title: drugCase.title,
          arrestDate: drugCase.arrestDate,
        }))}
      />

      <DrugEntityInfoNotice>{t("di.entity.phoneSimSafetyNotice")}</DrugEntityInfoNotice>
    </div>
  );
}
