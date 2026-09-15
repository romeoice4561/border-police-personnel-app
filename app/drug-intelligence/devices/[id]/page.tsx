/**
 * Device entity detail (Phase DI-3 — Section 15; DI-9.5.4 presentation).
 * "พบเกี่ยวข้องกับ" / "พบใช้งาน" — never "owner" (Section 17).
 */
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugDeviceDetail } from "@/lib/drug_intelligence/drug_intelligence_hooks";
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
  presentDevicePrimaryIdentity,
  resolveEntityDetailCaseContext,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import { drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { PERSON_CASE_CONTEXT_PARAM } from "@/lib/drug_intelligence/person_case_context";
import { entityDetailBackHref, getSafeReturnTo } from "@/lib/ui/return_context";
import { entityDetailBackLabelKey } from "@/lib/ui/return_to_back_label";

export default function DrugDeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const deviceId = decodeURIComponent(params.id);
  const { user, can } = useAuth();
  const { t } = useT();

  const detail = useDrugDeviceDetail(user?.id ?? null, deviceId);

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) {
    const isNotFound = detail.error instanceof ApiClientError && detail.error.status === 404;
    return <ErrorState title={isNotFound ? t("di.entity.notFound") : undefined} message={isNotFound ? undefined : (detail.error as Error).message} onRetry={isNotFound ? undefined : () => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");
  const imei1Display = data.device.imei1 ? presentIdentifierValue(data.device.imei1, canViewFull) : null;
  const imei2Display = data.device.imei2 ? presentIdentifierValue(data.device.imei2, canViewFull) : null;
  const serialDisplay = data.device.serialNumber ? presentIdentifierValue(data.device.serialNumber, canViewFull) : null;
  const title = presentDevicePrimaryIdentity({
    brand: data.device.brand,
    model: data.device.model,
    imei1Display,
    serialDisplay,
    fallback: t("di.entity.deviceTitle"),
  });
  const personCounts = caseCountByPersonId(data.caseLinks);
  const currentCaseId = resolveEntityDetailCaseContext(
    searchParams.get(PERSON_CASE_CONTEXT_PARAM),
    data.sourceCases.map((item) => item.id)
  );
  const inboundReturnTo = getSafeReturnTo(searchParams);
  const findings: string[] = [];
  if (data.caseCount > 0) findings.push(t("di.entity.deviceFindingsCases").replace("{count}", String(data.caseCount)));
  if (data.relatedPersonCount > 0) findings.push(t("di.entity.deviceFindingsPersons").replace("{count}", String(data.relatedPersonCount)));

  return (
    <div className="space-y-5">
      <DrugEntityHero
        entityType="DEVICE"
        title={title}
        subtitle={t("di.entity.deviceTitle")}
        caseCount={data.caseCount}
        copyValue={title === t("di.entity.deviceTitle") ? null : title}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DrugEntityIdentityField emoji="📱" label={t("di.entity.imei1")} value={imei1Display ?? "—"} copyValue={imei1Display} />
        <DrugEntityIdentityField emoji="📱" label={t("di.entity.imei2")} value={imei2Display ?? "—"} copyValue={imei2Display} />
        <DrugEntityIdentityField emoji="🔢" label={t("di.entity.serialNumber")} value={serialDisplay ?? "—"} copyValue={serialDisplay} />
        <DrugEntityIdentityField emoji="🏷️" label={t("di.entity.brand")} value={data.device.brand ?? "—"} />
        <DrugEntityIdentityField emoji="📦" label={t("di.entity.model")} value={data.device.model ?? "—"} />
      </div>

      <DrugEntityActionBar
        networkHref={drugNetworkFocusPath("DEVICE", deviceId)}
        timelineHref={`/drug-intelligence/timeline?deviceId=${encodeURIComponent(deviceId)}`}
        backHref={entityDetailBackHref(searchParams)}
        backLabelKey={entityDetailBackLabelKey(inboundReturnTo)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DrugEntityKpiCard emoji="📅" label={t("di.entity.firstSeen")} value={formatDiDate(data.firstSeenAt)} />
        <DrugEntityKpiCard emoji="🗓️" label={t("di.entity.lastSeen")} value={formatDiDate(data.lastSeenAt)} />
        <DrugEntityKpiCard emoji="📚" label={t("di.entity.caseCountKpi")} value={t("di.entity.kpiCaseCountValue").replace("{count}", String(data.caseCount))} />
        <DrugEntityKpiCard emoji="👤" label={t("di.entity.relatedPersonCountKpi")} value={t("di.entity.kpiPersonCountValue").replace("{count}", String(data.relatedPersonCount))} />
      </div>

      <DrugEntityFindings items={findings} />
      {shouldShowRecurrenceBadge(data.caseCount) ? (
        <p className="text-sm leading-relaxed text-foreground">{t("di.entity.deviceRepeatedStory").replace("{count}", String(data.caseCount))}</p>
      ) : null}

      <DrugEntityAlertSummary entityType="DEVICE" entityId={deviceId} titleKey="di.alert.entityHistoryTitle" />

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

      <DrugEntityInfoNotice>{t("di.entity.deviceVehicleSafetyNotice")}</DrugEntityInfoNotice>
    </div>
  );
}
