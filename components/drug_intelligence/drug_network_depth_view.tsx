"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { NetworkDepthViewMode } from "@/lib/drug_intelligence/drug_network_depth_view";

const OPTIONS: Array<{
  value: NetworkDepthViewMode;
  labelKey: "di.network.depthViewByDepth" | "di.network.depthViewFull" | "di.network.depthViewPath";
}> = [
  { value: "BY_DEPTH", labelKey: "di.network.depthViewByDepth" },
  { value: "FULL_NETWORK", labelKey: "di.network.depthViewFull" },
  { value: "SELECTED_PATH", labelKey: "di.network.depthViewPath" },
];

export function DrugNetworkDepthViewControl({
  mode,
  onChange,
  compact = false,
  menuOpen,
  onMenuOpenChange,
}: {
  mode: NetworkDepthViewMode;
  onChange: (mode: NetworkDepthViewMode) => void;
  compact?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const { t } = useT();
  const current = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[0]!;

  if (compact) {
    return (
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMenuOpenChange?.(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="drug-network-depth-view-menu"
          aria-label={`${t("di.network.depthViewLabel")}: ${t(current.labelKey)}`}
        >
          {t("di.network.depthViewLabel")}: {t(current.labelKey)}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        {menuOpen ? (
          <div
            id="drug-network-depth-view-menu"
            role="listbox"
            aria-label={t("di.network.depthViewLabel")}
            className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={mode === option.value}
                onClick={() => {
                  onChange(option.value);
                  onMenuOpenChange?.(false);
                }}
                className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-neutral-bg/60 ${
                  mode === option.value ? "font-semibold text-accent" : "text-foreground"
                }`}
              >
                {mode === option.value ? "✓ " : ""}
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("di.network.depthViewLabel")} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted">{t("di.network.depthViewLabel")}</span>
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={mode === option.value ? "accent" : "outline"}
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </Button>
      ))}
    </div>
  );
}
