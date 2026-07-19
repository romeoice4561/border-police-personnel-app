/**
 * EpfMissingPanel (Phase 46 — Foundation; Phase 46C — grouped into Required/
 * Professional/Optional collapsible sections per
 * lib/document/epf_missing_document_groups.ts's static, presentation-only
 * classification. Still shows only missing items — same real derivation
 * from the completeness engine as before (lib/document/epf_intelligence.ts's
 * missingChecklistItems), never fabricated).
 */
"use client";

import { useId, useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import type { CompletenessItem } from "@/lib/document/epf_intelligence";
import { MISSING_DOCUMENT_GROUP, MISSING_DOCUMENT_GROUP_ORDER, type MissingDocumentGroupKey } from "@/lib/document/epf_missing_document_groups";
import { TimelineCollapse } from "@/components/officer/timeline/timeline_collapse";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const GROUP_LABEL_KEY: Record<MissingDocumentGroupKey, TranslationKey> = {
  required: "epf.missingPanel.groupRequired",
  professional: "epf.missingPanel.groupProfessional",
  optional: "epf.missingPanel.groupOptional",
};

function MissingGroupSection({
  groupKey,
  items,
  onUpload,
}: {
  groupKey: MissingDocumentGroupKey;
  items: CompletenessItem[];
  onUpload: (typeCode: string) => void;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">{t(GROUP_LABEL_KEY[groupKey])}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted">{items.length}</span>
        <TimelineCollapse expanded={expanded} controls={panelId} onToggle={() => setExpanded((v) => !v)} />
      </div>
      {expanded ? (
        <ul id={panelId} className="space-y-1.5 border-t border-border p-2">
          {items.map((item) => {
            const isPortrait = item.code === "OFFICIAL_PORTRAIT";
            const label = t(`epf.completeness.checklist.${item.code}` as TranslationKey);
            return (
              <li key={item.code} className="flex items-center justify-between gap-2 rounded-md bg-warning-bg/40 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPortrait}
                  onClick={() => onUpload(item.code)}
                  aria-label={`${t("epf.missingPanel.upload")} ${label}`}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("epf.missingPanel.upload")}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function EpfMissingPanel({
  missingItems,
  onUpload,
}: {
  missingItems: CompletenessItem[];
  onUpload: (typeCode: string) => void;
}) {
  const { t } = useT();

  const grouped = MISSING_DOCUMENT_GROUP_ORDER.map((groupKey) => ({
    groupKey,
    items: missingItems.filter((item) => MISSING_DOCUMENT_GROUP[item.code] === groupKey),
  })).filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="epf-missing-panel-heading" className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <h3 id="epf-missing-panel-heading" className="text-sm font-semibold text-foreground">
        {t("epf.missingPanel.title")}
      </h3>

      {missingItems.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{t("epf.missingPanel.allComplete")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {grouped.map((g) => (
            <MissingGroupSection key={g.groupKey} groupKey={g.groupKey} items={g.items} onUpload={onUpload} />
          ))}
        </div>
      )}
    </section>
  );
}
