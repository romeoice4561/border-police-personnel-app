/**
 * Intelligence Search Center mode cards (Phase 1B.2 + DI-8.3).
 * Semantic tabs with field-officer-friendly cards — no new sidebar item.
 *
 * Modes: General Search · Relationship Search · Network Graph (existing workspace).
 */
"use client";

import { useRouter } from "next/navigation";
import { Link2, Network, Search } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";

export type DrugSearchCenterMode = "general" | "relationship" | "graph";

export function DrugSearchModeSwitcher({
  mode,
  onChange,
}: {
  mode: DrugSearchCenterMode;
  onChange: (mode: DrugSearchCenterMode) => void;
}) {
  const { t } = useT();
  const router = useRouter();

  const modes: Array<{
    id: DrugSearchCenterMode;
    title: string;
    description: string;
    icon: typeof Search;
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
      id: "graph",
      title: t("di.search.modeGraph"),
      description: t("di.search.modeGraphDesc"),
      icon: Network,
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
            data-testid={`search-mode-${item.id}`}
            data-active={selected ? "true" : "false"}
            onClick={() => {
              if (item.id === "graph") {
                router.push("/drug-intelligence/network");
                return;
              }
              onChange(item.id);
            }}
            className={[
              "min-h-[4.75rem] rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              selected
                ? "border-accent bg-accent/10 text-foreground shadow-sm"
                : "border-border bg-surface text-foreground hover:border-accent/50 hover:bg-neutral-bg/60",
            ].join(" ")}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={[
                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-accent/15 text-accent" : "bg-neutral-bg text-muted",
                ].join(" ")}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold sm:text-[0.95rem]">{item.title}</span>
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
