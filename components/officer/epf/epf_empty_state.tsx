/**
 * EpfEmptyState (Phase 46 — Foundation; Phase 46B — adds secondary help text
 * per spec §9: "short explanation, primary action, secondary help text").
 *
 * Shown when an officer has zero documents across every category. A simple
 * government-style illustration (line-art folder icon, no external assets)
 * plus the required explanatory copy and a primary "Upload Document" action
 * that opens the first category's upload flow.
 */
"use client";

import { FolderOpen } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";

export function EpfEmptyState({ onUpload }: { onUpload: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-neutral-bg px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface ring-1 ring-border">
        <FolderOpen className="h-8 w-8 text-muted" aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm text-foreground">{t("epf.emptyStateTitle")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onUpload}>
        {t("epf.emptyStateAction")}
      </Button>
      <p className="max-w-xs text-xs text-muted">{t("epf.emptyStateHelp")}</p>
    </div>
  );
}
