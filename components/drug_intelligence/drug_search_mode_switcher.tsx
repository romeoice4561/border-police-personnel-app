/**
 * Intelligence Search Center mode cards (Phase 1B.2).
 * Semantic tabs with field-officer-friendly cards — no new sidebar item.
 */
"use client";

import { Bot, Link2, Search } from "lucide-react";
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

  const modes: Array<{
    id: DrugSearchCenterMode;
    title: string;
    description: string;
    icon: typeof Search;
    disabled?: boolean;
    badge?: string;
  }> = [
    {
      id: "general",
      title: t("di.search.modeGeneral"),
      description: t("di.search.modeGeneralDesc"),
      icon: Search,
    },
    {
      id: "relationship",
      title: t("di.search.modeRelationship"),
      description: t("di.search.modeRelationshipDesc"),
      icon: Link2,
    },
    {
      id: "ai",
      title: t("di.search.modeAi"),
      description: t("di.search.modeAiDesc"),
      icon: Bot,
      disabled: true,
      badge: t("di.search.modeAiSoon"),
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t("di.search.modeSwitcherLabel")}
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      data-testid="search-mode-cards"
    >
      {modes.map((item) => {
        const selected = mode === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            data-testid={`search-mode-${item.id}`}
            data-active={selected ? "true" : "false"}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={[
              "min-h-[4.75rem] rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              item.disabled
                ? "cursor-not-allowed border-border/70 bg-neutral-bg/70 text-muted opacity-75"
                : selected
                  ? "border-accent bg-accent/10 text-foreground shadow-sm"
                  : "border-border bg-surface text-foreground hover:border-accent/50 hover:bg-neutral-bg/60",
            ].join(" ")}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={[
                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  selected && !item.disabled ? "bg-accent/15 text-accent" : "bg-neutral-bg text-muted",
                ].join(" ")}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold sm:text-[0.95rem]">{item.title}</span>
                  {item.badge ? (
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs leading-snug text-muted">{item.description}</span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
