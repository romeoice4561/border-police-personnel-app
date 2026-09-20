/**
 * Case Workspace identity header — mirrors Person Visual Intelligence hierarchy.
 * Display-only; caseNumber is the human primary label (never UUID).
 */
"use client";

import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { DrugCaseStatusBadge } from "@/components/drug_intelligence/drug_case_status_badge";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugEntityMedia } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { formatThaiOperationalDateWithClock } from "@/lib/drug_intelligence/di_date_helpers";
import { compactEntityId } from "@/components/drug_intelligence/drug_person_workspace_cards";

export function DrugCaseIdentityHeader({
  caseId,
  caseNumber,
  title,
  status,
  arrestDate,
  arrestTime,
  province,
  reportingUnitText,
  actions,
}: {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: string | null;
  arrestTime?: string | null;
  province: string | null;
  reportingUnitText: string | null;
  actions?: ReactNode;
}) {
  const { user } = useAuth();
  const { t } = useT();
  const media = useDrugEntityMedia(user?.id ?? null, "CASE", caseId);
  const items = media.data?.items ?? [];
  const primary = items.find((item) => item.isPrimary) ?? items[0] ?? null;
  const arrest = arrestDate
    ? formatThaiOperationalDateWithClock(arrestDate, arrestTime)
    : "—";

  return (
    <header
      className="w-full rounded-xl border border-border bg-surface p-3 sm:p-4"
      data-testid="case-visual-identity"
    >
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex min-w-0 w-full flex-1 basis-0 flex-col gap-3 sm:flex-row sm:items-start">
          <a href="#media" className="mx-auto shrink-0 sm:mx-0" aria-label={t("di.media.openGallery")}>
            <DrugEntityVisualThumb
              entityType="CASE"
              label={caseNumber}
              thumbnailUrl={primary?.thumbnailUrl ?? primary?.url}
              size="portrait"
            />
          </a>
          <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <FolderOpen className="hidden h-5 w-5 text-accent sm:inline" aria-hidden="true" />
              <h1 className="text-2xl font-semibold leading-tight break-words text-foreground">{caseNumber}</h1>
              <DrugCaseStatusBadge status={status} />
            </div>
            <p className="text-sm text-foreground break-words">{title || "—"}</p>
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted sm:justify-start">
              <span>
                {t("di.field.arrestDate")}: <span className="text-foreground">{arrest}</span>
              </span>
              <span>
                {t("di.field.province")}: <span className="text-foreground">{province || "—"}</span>
              </span>
            </p>
            {reportingUnitText ? (
              <p className="text-sm text-muted break-words">
                {t("di.field.reportingUnit")}: <span className="text-foreground">{reportingUnitText}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <a
                href="#media"
                className="inline-flex min-h-8 items-center rounded-lg border border-border bg-neutral-bg px-2.5 text-xs font-medium text-foreground hover:bg-surface"
              >
                {t("di.media.viewAllCount").replace("{count}", String(items.length))}
              </a>
              <details className="text-left">
                <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                  {t("di.workspace.technicalDetails")}
                </summary>
                <p className="mt-1 font-mono text-[10px] text-muted" title={caseId}>
                  ID: {compactEntityId(caseId)}
                </p>
              </details>
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-start justify-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}
