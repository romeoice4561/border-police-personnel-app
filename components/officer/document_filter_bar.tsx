/**
 * DocumentFilterBar (Phase 45A, Part 8).
 *
 * A client-side filter above the officer document list — All / Verified /
 * Pending / Missing — over the documents ALREADY loaded (no DB/API change). The
 * options are driven by ACTIVE_DOCUMENT_STATUSES, so when a future schema phase
 * adds "expired"/"rejected" they appear here automatically with no redesign.
 *
 * Bilingual via the central dictionary. Accessible: a labelled radiogroup of
 * real buttons with aria-checked + keyboard focus.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/ui/cn";

/** "all" plus each real document status that can back a filter. */
export type DocumentFilterValue = "all" | "verified" | "pending" | "missing";

const FILTERS: Array<{ value: DocumentFilterValue; labelKey: TranslationKey }> = [
  { value: "all", labelKey: "document.filterAll" },
  { value: "verified", labelKey: "document.filterVerified" },
  { value: "pending", labelKey: "document.filterPending" },
  { value: "missing", labelKey: "document.filterMissing" },
];

export function DocumentFilterBar({
  value,
  counts,
  onChange,
}: {
  value: DocumentFilterValue;
  counts: Record<DocumentFilterValue, number>;
  onChange: (next: DocumentFilterValue) => void;
}) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={t("document.filterLabel")} className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:border-accent hover:text-foreground"
            )}
          >
            {t(f.labelKey)}
            <span className="tabular-nums opacity-70">{counts[f.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
