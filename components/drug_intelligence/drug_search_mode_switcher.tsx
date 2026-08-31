/**
 * Intelligence Search Center mode switcher (Phase 1B).
 * Modes live on the existing Search page — no new sidebar item.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";

export type DrugSearchCenterMode = "general" | "relationship" | "ai";

export function DrugSearchModeSwitcher({
  mode,
  onChange,
}: {
  mode: DrugSearchCenterMode;
  onChange: (mode: DrugSearchCenterMode) => void;
}) {
  const { t } = useT();

  const modes: Array<{ id: DrugSearchCenterMode; label: string; disabled?: boolean; badge?: string }> = [
    { id: "general", label: `🔎 ${t("di.search.modeGeneral")}` },
    { id: "relationship", label: `🔗 ${t("di.search.modeRelationship")}` },
    { id: "ai", label: `🤖 ${t("di.search.modeAi")}`, disabled: true, badge: t("di.search.modeAiSoon") },
  ];

  return (
    <div role="tablist" aria-label={t("di.search.modeSwitcherLabel")} className="flex flex-wrap gap-2">
      {modes.map((item) => {
        const selected = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={[
              "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              item.disabled
                ? "cursor-not-allowed border-border/60 bg-neutral-bg text-muted opacity-70"
                : selected
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-muted hover:border-accent/50 hover:text-foreground",
            ].join(" ")}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="ml-2 text-xs text-muted">({item.badge})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
