/**
 * Inline "พบข้อมูลเดิม" intelligence card (Phase DI-6, Section 4) — shown
 * under a phone/IMEI/vehicle field in the Create Case wizard while the
 * entity being typed matches something already recorded. Informational
 * only, never blocks submission (Section 4/5: entity reuse is a signal,
 * not a duplicate-data error).
 */
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { DrugAlertQuickCheckResult } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugAlertInlineCard({ signal }: { signal: DrugAlertQuickCheckResult }) {
  const { t } = useT();
  if (!signal.found || !signal.entityId) return null;

  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-warning/40 bg-warning-bg/60 p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("di.alert.inlineTitle")}
      </p>
      <p className="text-foreground">
        {t("di.alert.inlineFoundInCases")} {signal.caseCount.toLocaleString("th-TH")} {t("di.alert.inlineCasesSuffix")}
      </p>
      {signal.relatedPersonCount > 0 ? (
        <p className="text-foreground">
          {t("di.alert.inlineRelatedPersons")} {signal.relatedPersonCount.toLocaleString("th-TH")} {t("di.alert.inlinePersonsSuffix")}
        </p>
      ) : null}
      {signal.lastSeenAt ? (
        <p className="text-muted">
          {t("di.alert.inlineLastSeen")} {new Date(signal.lastSeenAt).toLocaleDateString("th-TH")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={entityDetailHref(signal)} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
          {t("di.alert.viewHistory")}
        </Link>
        <Link href={`/drug-intelligence/network?focusType=${signal.entityType}&focusId=${encodeURIComponent(signal.entityId)}`} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
          {t("di.alert.openNetwork")}
        </Link>
      </div>
    </div>
  );
}

function entityDetailHref(signal: DrugAlertQuickCheckResult): string {
  const id = encodeURIComponent(signal.entityId ?? "");
  switch (signal.entityType) {
    case "PHONE":
      return `/drug-intelligence/phones/${id}`;
    case "SIM":
      return `/drug-intelligence/sims/${id}`;
    case "DEVICE":
      return `/drug-intelligence/devices/${id}`;
    case "VEHICLE":
      return `/drug-intelligence/vehicles/${id}`;
    case "PERSON":
      return `/drug-intelligence/persons/${id}`;
  }
}
