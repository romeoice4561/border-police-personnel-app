/**
 * EpfExpiryAlertPanel (Phase 47 — "Attention Required").
 *
 * Shows only actionable expiry items: expired documents and documents
 * expiring soon (from lib/document/document_expiry.ts's sortByUrgency
 * output, filtered to those two statuses — "valid"/"unknown" never appear
 * here, they're not actionable). Each row shows status, days remaining, and
 * a primary action (Renew for expired/expiring-soon documents that have a
 * file; Review otherwise).
 */
"use client";

import { AlertTriangle, XCircle } from "lucide-react";
import type { DocumentExpiryInfo } from "@/lib/document/document_expiry";
import { findDocumentType } from "@/lib/document/document_types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";

const ICON_TONE_CLASS = { serious: "text-serious", warning: "text-warning" } as const;

export function EpfExpiryAlertPanel({
  items,
  onAction,
}: {
  /** Pre-filtered to expired + expiring_soon, pre-sorted by urgency (caller's responsibility — this component only renders). */
  items: DocumentExpiryInfo[];
  onAction: (typeCode: string) => void;
}) {
  const { t } = useT();

  return (
    <section aria-labelledby="epf-expiry-alert-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 id="epf-expiry-alert-heading" className="text-sm font-semibold text-foreground">
        {t("epf.expiry.alertTitle")}
      </h3>

      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{t("epf.expiry.alertEmpty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const label = findDocumentType(item.document.documentType)?.labelEn ?? item.document.documentType;
            const Icon = item.status === "expired" ? XCircle : AlertTriangle;
            const tone: "serious" | "warning" = item.status === "expired" ? "serious" : "warning";
            const daysText =
              item.status === "expired"
                ? `${t("epf.expiry.alertExpiredSince")} (${Math.abs(item.daysRemaining ?? 0)} ${t("epf.expiry.daysUnit")})`
                : `${t("epf.expiry.alertExpiresIn")} ${item.daysRemaining} ${t("epf.expiry.daysUnit")}`;
            return (
              <li key={item.document.id} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-bg px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${ICON_TONE_CLASS[tone]}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted">{daysText}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={tone}>{item.status === "expired" ? t("epf.expiry.statusExpired") : t("epf.expiry.statusExpiringSoon")}</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => onAction(item.document.documentType)}>
                    {item.status === "expired" ? t("epf.expiry.alertRenew") : t("epf.expiry.alertReview")}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
