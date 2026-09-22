/**
 * DI-8.7 V1 — "ข้อสังเกตจากข้อมูล" (Observations from recorded data) panel.
 * Presentation only; consumes NetworkGraphInsight[] (see
 * drug_network_graph_insights.ts). Renders inside the existing Network
 * Inspector — NOT a second drawer, NOT a new dashboard.
 *
 * Every card follows the mandatory answer-first order (Section 11):
 * A. what did the system notice (title) → B. which entity → C. the fact →
 * D. supporting case records → E. "เหตุที่ระบบแสดง" (mandatory) →
 * F. actions (ดูบนผัง / ดูหลักฐาน).
 *
 * "ดูหลักฐาน" reveals the insight's own real supporting-case links
 * (drugEntityDetailPath("CASE", caseId) + withReturnTo — the same link
 * primitives DI-8.6's path-evidence list already uses) — never a second,
 * unrelated evidence viewer, and never a flattened list implying every
 * item proves the same transition (each insight's cases ARE the full,
 * honest evidence set for that specific observation).
 *
 * OBSERVATION is a presentation category, never a DrugGraphEdgeKind — cards
 * never use DIRECT/PATH/INFERRED language for themselves.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { withReturnTo } from "@/lib/ui/return_context";
import {
  INSIGHT_INITIAL_LIMIT,
  type NetworkGraphInsight,
} from "@/lib/drug_intelligence/drug_network_graph_insights";

export function DrugNetworkInsightPanel({
  insights,
  onViewOnGraph,
  openReturnPath = null,
  className,
}: {
  insights: readonly NetworkGraphInsight[];
  /** "ดูบนผัง" — passes the insight's own real loaded node/edge ids (graphFocus) to the existing camera/highlight mechanism. Presentation-only; never mutates graph data. */
  onViewOnGraph: (insight: NetworkGraphInsight) => void;
  /** Navigation-only path to restore after opening a case from "ดูหลักฐาน" — same contract as the rest of the Inspector. */
  openReturnPath?: string | null;
  className?: string;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [evidenceOpenId, setEvidenceOpenId] = useState<string | null>(null);
  const hasMore = insights.length > INSIGHT_INITIAL_LIMIT;
  const visible = expanded ? insights : insights.slice(0, INSIGHT_INITIAL_LIMIT);

  return (
    <div className={cn("space-y-2.5", className)} data-testid="network-insight-panel">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("di.network.insightPanelHeading")}</p>
        {insights.length > 0 ? (
          <p className="text-[11px] text-muted">{t("di.network.insightOrderingNote")}</p>
        ) : null}
      </div>

      {insights.length === 0 ? (
        <div className="rounded-lg bg-neutral-bg/60 px-3 py-2.5" data-testid="network-insight-empty">
          <p className="text-xs text-muted">{t("di.network.insightPanelEmpty")}</p>
          <p className="mt-1 text-[11px] text-muted/80">{t("di.network.insightPanelEmptyHint")}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((insight) => {
              const Icon = insight.entityType ? DRUG_ENTITY_ICON[insight.entityType] : null;
              const evidenceOpen = evidenceOpenId === insight.id;
              return (
                <li
                  key={insight.id}
                  className="rounded-lg border border-border/80 bg-surface px-3 py-2.5"
                  data-testid="network-insight-card"
                  data-insight-type={insight.type}
                >
                  {/* A. what did the system notice — PRIMARY */}
                  <p className="text-sm font-semibold leading-snug text-foreground" data-testid="network-insight-title">
                    {t(insight.titleKey)}
                  </p>

                  {/* B. which entity */}
                  {insight.entityLabel ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /> : null}
                      <p className="truncate text-sm font-medium text-foreground">{insight.entityLabel}</p>
                    </div>
                  ) : null}

                  {/* C. the fact — SECONDARY */}
                  <p className="mt-0.5 text-xs font-medium text-foreground" data-testid="network-insight-fact">
                    {insight.factText}
                  </p>

                  {/* D. supporting case records — SUPPORTING */}
                  {insight.cases.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1" data-testid="network-insight-cases">
                      {insight.cases.map((c) => (
                        <span key={c.caseId} className="rounded bg-neutral-bg px-1.5 py-0.5 text-[11px] text-foreground">
                          {c.caseNumber}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* E. เหตุที่ระบบแสดง — mandatory, EXPLANATION */}
                  <div className="mt-1.5 rounded-md bg-neutral-bg/60 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      {t("di.network.insightReasonHeading")}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-foreground" data-testid="network-insight-reason">
                      {t(insight.reasonKey)}
                    </p>
                  </div>

                  {/* F. actions */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onViewOnGraph(insight)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      data-testid="network-insight-view-on-graph"
                    >
                      {t("di.network.insightActionViewOnGraph")}
                    </button>
                    {insight.cases.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setEvidenceOpenId((current) => (current === insight.id ? null : insight.id))}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        data-testid="network-insight-view-evidence"
                        aria-expanded={evidenceOpen}
                      >
                        {t("di.network.insightActionViewEvidence")}
                      </button>
                    ) : null}
                  </div>

                  {evidenceOpen ? (
                    <ul className="mt-2 space-y-1 border-t border-border/60 pt-2" data-testid="network-insight-evidence-list">
                      {insight.cases.map((c) => (
                        <li key={c.caseId}>
                          <Link
                            href={withReturnTo(drugEntityDetailPath("CASE", c.caseId), openReturnPath)}
                            className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                          >
                            {t("di.network.openRelatedCase")}: {c.caseNumber}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-accent hover:underline"
              data-testid="network-insight-toggle-all"
            >
              {expanded ? t("di.network.insightShowFewer") : t("di.network.insightShowAll").replace("{count}", String(insights.length))}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
