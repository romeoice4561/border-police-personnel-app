/**
 * EpfInsightsCard (Phase 46B — "AI Insights").
 *
 * IMPORTANT: not an LLM. Renders the deterministic, rule-based statements
 * from lib/document/epf_insights.ts's computeInsights — every line is a
 * translation-key template plus, where applicable, a real number already
 * computed elsewhere (pending count, days since last upload, completion %).
 * Never free-text generated. Max 5 insights, already ordered by severity by
 * the derivation layer — this component only renders them, generically,
 * from each insight's own valuePosition/suffixKey (no per-id branching).
 */
"use client";

import { AlertTriangle, Info, CheckCircle2, Sparkles } from "lucide-react";
import type { Insight, InsightSeverity } from "@/lib/document/epf_insights";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SEVERITY_ICON: Record<InsightSeverity, typeof AlertTriangle> = {
  critical: AlertTriangle,
  notable: AlertTriangle,
  positive: CheckCircle2,
  informational: Info,
};

const SEVERITY_COLOR: Record<InsightSeverity, string> = {
  critical: "text-serious",
  notable: "text-warning",
  positive: "text-good",
  informational: "text-muted",
};

function InsightText({ insight }: { insight: Insight }) {
  const { t } = useT();
  const label = t(insight.labelKey as TranslationKey);
  if (!insight.value) return <>{label}</>;
  if (insight.valuePosition === "before") return <>{insight.value} {label}</>;
  return (
    <>
      {label} {insight.value}
      {insight.suffixKey ? <> {t(insight.suffixKey as TranslationKey)}</> : null}
    </>
  );
}

export function EpfInsightsCard({ insights }: { insights: Insight[] }) {
  const { t } = useT();

  return (
    <section aria-labelledby="epf-insights-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 id="epf-insights-heading" className="text-sm font-semibold text-foreground">
          {t("epf.insights.title")}
        </h3>
      </div>
      <p className="mt-0.5 text-xs text-muted">{t("epf.insights.subtitle")}</p>

      {insights.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{t("epf.insights.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {insights.map((insight) => {
            const Icon = SEVERITY_ICON[insight.severity];
            return (
              <li key={insight.id} className="flex items-start gap-2 text-sm text-foreground">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${SEVERITY_COLOR[insight.severity]}`} aria-hidden="true" />
                <span>
                  <InsightText insight={insight} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
