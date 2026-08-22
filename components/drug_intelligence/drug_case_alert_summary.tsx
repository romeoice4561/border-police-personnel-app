/**
 * Case Workspace's compact intelligence-alert summary (Phase DI-6, Section
 * 13). Reuses the SAME useDrugAlertsForCase read model the Alert Center
 * itself uses — never a second alert-matching computation. Deliberately
 * compact (a card, not a whole tab) with drill-down into the Alert Center
 * pre-filtered to this case.
 */
"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugAlertsForCase } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import type { DrugAlertSeverity, DrugAlertStatus } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SEVERITY_TONE: Record<DrugAlertSeverity, "default" | "warning" | "critical"> = { INFO: "default", NOTICE: "warning", HIGH: "critical" };
const STATUS_LABEL_KEY: Record<DrugAlertStatus, TranslationKey> = { NEW: "di.alert.statusNew", REVIEWED: "di.alert.statusReviewed", DISMISSED: "di.alert.statusDismissed" };

export function DrugCaseAlertSummary({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const { t } = useT();
  const alerts = useDrugAlertsForCase(user?.id ?? null, caseId);

  if (alerts.isPending || alerts.isError || !alerts.data || alerts.data.alerts.length === 0) {
    return (
      <Card>
        <CardBody className="flex items-center gap-2">
          <BellRing className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">{t("di.alert.caseWorkspaceTitle")}</p>
          {!alerts.isPending && !alerts.isError ? <p className="ml-auto text-xs text-muted">{t("di.alert.caseWorkspaceEmpty")}</p> : null}
        </CardBody>
      </Card>
    );
  }

  const unreviewedCount = alerts.data.alerts.filter((a) => a.status === "NEW").length;

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BellRing className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {t("di.alert.caseWorkspaceTitle")}
          </p>
          <Link href={`/drug-intelligence/alerts?currentCaseId=${encodeURIComponent(caseId)}`} className="text-xs text-accent hover:underline">
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
        {unreviewedCount > 0 ? <p className="text-xs text-warning">{unreviewedCount} — {t("di.alert.statusNew")}</p> : null}
      </CardBody>
    </Card>
  );
}
