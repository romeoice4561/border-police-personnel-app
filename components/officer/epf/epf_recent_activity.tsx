/**
 * EpfRecentActivity (Phase 46 — Foundation; Phase 46B — grouped by
 * Today/Last 7 Days/Earlier using lib/document/epf_insights.ts's
 * groupRecentActivity, a pure bucketing of the same real
 * uploadedAt/updatedAt timestamps computeRecentActivity already produced —
 * no new timestamp source, no synthetic audit log; Phase 46C — compacted to
 * single-line rows and tighter group spacing so the card doesn't dominate
 * vertical space next to Storage Distribution).
 */
"use client";

import { Upload, RefreshCw } from "lucide-react";
import type { ActivityGroup } from "@/lib/document/epf_insights";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import { useLanguage, useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const GROUP_LABEL_KEY: Record<ActivityGroup["key"], TranslationKey> = {
  today: "epf.activity.groupToday",
  last7Days: "epf.activity.groupLast7Days",
  earlier: "epf.activity.groupEarlier",
};

export function EpfRecentActivity({ groups }: { groups: ActivityGroup[] }) {
  const { t } = useT();
  const { language } = useLanguage();

  return (
    <section aria-labelledby="epf-activity-heading" className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <h3 id="epf-activity-heading" className="text-sm font-semibold text-foreground">
        {t("epf.activity.title")}
      </h3>

      {groups.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{t("epf.activity.empty")}</p>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-1 text-[10px] font-medium tracking-wide text-muted uppercase">{t(GROUP_LABEL_KEY[group.key])}</p>
              <ol className="space-y-1">
                {group.entries.map((entry, i) => {
                  const label = getDocumentTypeLabel(entry.documentType, language);
                  const Icon = entry.kind === "uploaded" ? Upload : RefreshCw;
                  const kindLabel = entry.kind === "uploaded" ? t("epf.activity.uploaded") : t("epf.activity.updated");
                  return (
                    <li key={`${entry.document.id}-${i}`} className="flex items-center gap-2 text-xs">
                      <Icon className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        <span className="font-medium">{kindLabel}</span> {label}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">{formatShortThaiDateTh(entry.at)}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
