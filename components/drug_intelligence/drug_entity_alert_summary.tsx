/**
 * Compact intelligence-alert summary for a single entity — reused by Person
 * Profile (Section 14) and the Phone/SIM/Device/Vehicle detail pages
 * (Section 15). Reuses the SAME useDrugAlertsForEntity read model the Alert
 * Center itself uses — never a second alert-matching computation.
 */
"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugAlertsForEntity } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import type { DrugAlertEntityType, DrugAlertSeverity, DrugAlertStatus } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SEVERITY_TONE: Record<DrugAlertSeverity, "default" | "warning" | "critical"> = { INFO: "default", NOTICE: "warning", HIGH: "critical" };
const STATUS_LABEL_KEY: Record<DrugAlertStatus, TranslationKey> = { NEW: "di.alert.statusNew", REVIEWED: "di.alert.statusReviewed", DISMISSED: "di.alert.statusDismissed" };

export function DrugEntityAlertSummary({ entityType, entityId, titleKey }: { entityType: DrugAlertEntityType; entityId: string; titleKey?: TranslationKey }) {
  const { user } = useAuth();
  const { t } = useT();
  const alerts = useDrugAlertsForEntity(user?.id ?? null, entityType, entityId);

  if (alerts.isPending || alerts.isError || !alerts.data || alerts.data.alerts.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BellRing className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {t(titleKey ?? "di.alert.personProfileTitle")}
          </p>
          <Link href={`/drug-intelligence/alerts?entityType=${entityType}`} className="text-xs text-accent hover:underline">
            {t("di.alert.viewDetail")}
          </Link>
        </div>
        <ul className="space-y-1.5">
          {alerts.data.alerts.slice(0, 4).map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{alert.title}</span>
              <span className="flex shrink-0 gap-1.5">
                <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
                <Badge tone={alert.status === "NEW" ? "accent" : alert.status === "REVIEWED" ? "good" : "neutral"}>{t(STATUS_LABEL_KEY[alert.status])}</Badge>
              </span>
            </li>
          ))}
        </ul>
        {alerts.data.alerts.length > 4 ? <p className="text-xs text-muted">+{alerts.data.alerts.length - 4}</p> : null}
      </CardBody>
    </Card>
  );
}
