/**
 * Compact expand-navigation context. Not graph evidence.
 */
"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { NetworkTrailStep } from "@/lib/drug_intelligence/drug_network_investigation_trail";

export function DrugNetworkInvestigationTrail({
  previous,
  currentLabel,
  onReturnToOrigin,
}: {
  previous: NetworkTrailStep[];
  currentLabel: string;
  onReturnToOrigin: () => void;
}) {
  const { t } = useT();
  const origin = previous[0];
  if (!origin) return null;
  const current = currentLabel.trim() || t("di.network.trailCurrentFallback");

  return (
    <div
      role="navigation"
      aria-label={t("di.network.trailHeading")}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
      data-testid="network-investigation-trail"
    >
      <p className="text-[11px] font-medium text-muted">{t("di.network.trailHeading")}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-foreground">
        {previous.map((step, index) => (
          <span key={`${step.type}:${step.id}`} className="inline-flex max-w-full flex-wrap items-center gap-1.5">
            {index > 0 ? <span className="text-muted" aria-hidden="true">→</span> : null}
            <span className="max-w-full break-words rounded-md border border-border bg-background px-1.5 py-0.5 text-muted">
              {step.label || step.type}
            </span>
          </span>
        ))}
        <span className="text-muted" aria-hidden="true">→</span>
        <span className="max-w-full break-words rounded-md border border-border bg-background px-1.5 py-0.5 font-semibold text-foreground">
          {current}
        </span>
      </p>
      <p className="mt-1 text-muted">
        {t("di.network.trailExploringFrom").replace("{label}", current)}
      </p>
      <div className="mt-2">
        <Button type="button" variant="outline" size="sm" onClick={onReturnToOrigin}>
          {t("di.network.trailReturnTo").replace("{label}", origin.label || origin.type)}
        </Button>
      </div>
    </div>
  );
}
