"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { NetworkConnectionDepth } from "@/lib/drug_intelligence/drug_network_connection_depth";

const OPTIONS: Array<{
  value: NetworkConnectionDepth;
  labelKey: "di.network.connectionDepthOne" | "di.network.connectionDepthTwo";
  hintKey: "di.network.connectionDepthOneHint" | "di.network.connectionDepthTwoHint";
}> = [
  { value: 1, labelKey: "di.network.connectionDepthOne", hintKey: "di.network.connectionDepthOneHint" },
  { value: 2, labelKey: "di.network.connectionDepthTwo", hintKey: "di.network.connectionDepthTwoHint" },
];

export function DrugNetworkConnectionDepthControl({
  depth,
  onChange,
  compact = false,
  menuOpen,
  onMenuOpenChange,
}: {
  depth: NetworkConnectionDepth;
  onChange: (depth: NetworkConnectionDepth) => void;
  compact?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const { t } = useT();
  const current = OPTIONS.find((option) => option.value === depth) ?? OPTIONS[0]!;

  if (compact) {
    return (
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMenuOpenChange?.(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="drug-network-connection-depth-menu"
          aria-label={`${t("di.network.connectionDepthLabel")}: ${t(current.labelKey)}`}
        >
          {t("di.network.connectionDepthLabel")}: {t(current.labelKey)}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        {menuOpen ? (
          <div
            id="drug-network-connection-depth-menu"
            role="listbox"
            aria-label={t("di.network.connectionDepthLabel")}
            className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={depth === option.value}
                title={t(option.hintKey)}
                onClick={() => {
                  onChange(option.value);
                  onMenuOpenChange?.(false);
                }}
                className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-neutral-bg/60 ${
                  depth === option.value ? "font-semibold text-accent" : "text-foreground"
                }`}
              >
                {depth === option.value ? "✓ " : ""}
                {t(option.labelKey)}
                <span className="mt-0.5 block text-xs font-normal text-muted">{t(option.hintKey)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("di.network.connectionDepthLabel")}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="mr-1 text-xs font-medium text-muted">{t("di.network.connectionDepthLabel")}</span>
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={depth === option.value ? "accent" : "outline"}
          aria-pressed={depth === option.value}
          title={t(option.hintKey)}
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </Button>
      ))}
    </div>
  );
}
