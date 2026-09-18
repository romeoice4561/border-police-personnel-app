/**
 * Vehicle entity detail (Phase DI-3 — Section 16; DI-9.5.4 presentation).
 * "พบเกี่ยวข้องกับ" — never "owner" (Section 17).
 */
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugVehicleDetail } from "@/lib/drug_intelligence/drug_intelligence_hooks";
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
import { DrugEntityMediaGallery } from "@/components/drug_intelligence/drug_entity_media_gallery";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import {
  caseCountByPersonId,
  presentVehiclePrimaryIdentity,
  resolveEntityDetailCaseContext,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import { drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { PERSON_CASE_CONTEXT_PARAM } from "@/lib/drug_intelligence/person_case_context";
import { entityDetailBackHref, getSafeReturnTo } from "@/lib/ui/return_context";
import { entityDetailBackLabelKey } from "@/lib/ui/return_to_back_label";

export default function DrugVehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const vehicleId = decodeURIComponent(params.id);
  const { user, can } = useAuth();
  const { t } = useT();

  const detail = useDrugVehicleDetail(user?.id ?? null, vehicleId);

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) {
    const isNotFound = detail.error instanceof ApiClientError && detail.error.status === 404;
    return <ErrorState title={isNotFound ? t("di.entity.notFound") : undefined} message={isNotFound ? undefined : (detail.error as Error).message} onRetry={isNotFound ? undefined : () => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");
  const registrationDisplay = data.vehicle.registrationNumber
    ? presentIdentifierValue(data.vehicle.registrationNumber, canViewFull)
    : null;
  const vinDisplay = data.vehicle.vin ? presentIdentifierValue(data.vehicle.vin, canViewFull) : null;
  const title = presentVehiclePrimaryIdentity({
    registrationDisplay,
    registrationProvince: data.vehicle.registrationProvince,
    brand: data.vehicle.brand,
    model: data.vehicle.model,
    fallback: t("di.entity.vehicleTitle"),
  });
  const personCounts = caseCountByPersonId(data.caseLinks);
  const currentCaseId = resolveEntityDetailCaseContext(
    searchParams.get(PERSON_CASE_CONTEXT_PARAM),
    data.sourceCases.map((item) => item.id)
  );
  const inboundReturnTo = getSafeReturnTo(searchParams);
  const findings: string[] = [];
  if (data.caseCount > 0) findings.push(t("di.entity.vehicleFindingsCases").replace("{count}", String(data.caseCount)));
  if (data.relatedPersonCount > 0) findings.push(t("di.entity.vehicleFindingsPersons").replace("{count}", String(data.relatedPersonCount)));

  return (
    <div className="space-y-5">
      <DrugEntityHero
        entityType="VEHICLE"
        title={title}
        subtitle={t("di.entity.vehicleTitle")}
        caseCount={data.caseCount}
        copyValue={registrationDisplay}
      />

      <DrugEntityMediaGallery entityType="VEHICLE" entityId={vehicleId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DrugEntityIdentityField emoji="🚗" label={t("di.entity.registrationNumber")} value={registrationDisplay ?? "—"} copyValue={registrationDisplay} />
        <DrugEntityIdentityField emoji="📍" label={t("di.entity.registrationProvince")} value={data.vehicle.registrationProvince ?? "—"} />
        <DrugEntityIdentityField emoji="🚙" label={t("di.vehicle.type")} value={data.vehicle.vehicleType ?? "—"} />
        <DrugEntityIdentityField emoji="🏷️" label={t("di.entity.brand")} value={data.vehicle.brand ?? "—"} />
        <DrugEntityIdentityField emoji="📦" label={t("di.entity.model")} value={data.vehicle.model ?? "—"} />
        <DrugEntityIdentityField emoji="🎨" label={t("di.entity.color")} value={data.vehicle.color ?? "—"} />
        <DrugEntityIdentityField emoji="🔢" label={t("di.entity.vin")} value={vinDisplay ?? "—"} copyValue={vinDisplay} />
      </div>

      <DrugEntityActionBar
        networkHref={drugNetworkFocusPath("VEHICLE", vehicleId)}
        timelineHref={`/drug-intelligence/timeline?vehicleId=${encodeURIComponent(vehicleId)}`}
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
        <p className="text-sm leading-relaxed text-foreground">{t("di.entity.vehicleRepeatedStory").replace("{count}", String(data.caseCount))}</p>
      ) : null}

      <DrugEntityAlertSummary entityType="VEHICLE" entityId={vehicleId} titleKey="di.alert.entityHistoryTitle" />

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
