/**
 * Edge detail panel content (Phase DI-5, Section 11; polished DI-9.1
 * Section 10; DI-9.3 Section 7/21 adds an optional presentation-state
 * routing section). Rendered inside the shared Drawer primitive.
 *
 * DI-9.5 / DI-9.5.1: field-officer investigation story composed from the
 * already-fetched neighborhood. Canvas edge labels stay short category tags.
 * `route`/route-editing callbacks are provided (i.e. Analyst Mode; View
 * Mode passes none of them and the whole section is omitted, matching the
 * pin section's existing pattern in drug_network_node_detail.tsx).
 * Deliberately its own bordered block, visually and semantically separate
 * from the factual story above — routing is presentation state, never
 * evidence, per Section 21's explicit requirement.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Waypoints, Plus, Trash2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import {
  DRUG_GRAPH_NODE_TYPE_LABEL_KEY,
  explainDrugGraphEdgeClient,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import {
  buildRelationshipExplanation,
  relationshipEntityHref,
} from "@/lib/drug_intelligence/drug_network_relationship_explainability";
import { withReturnTo } from "@/lib/ui/return_context";
import type { DrugNetworkEdgeRouteMode, DrugNetworkEdgeRouteState } from "@/lib/drug_intelligence/drug_network_edge_routing";
import type { DrugGraphEdge, DrugGraphNeighborhoodResponse, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ROUTE_MODE_ORDER: DrugNetworkEdgeRouteMode[] = ["AUTO", "STRAIGHT", "ORTHOGONAL", "CURVED"];
const ROUTE_MODE_LABEL_KEY: Record<DrugNetworkEdgeRouteMode, TranslationKey> = {
  AUTO: "di.network.routeModeAuto",
  STRAIGHT: "di.network.routeModeStraight",
  ORTHOGONAL: "di.network.routeModeOrthogonal",
  CURVED: "di.network.routeModeCurved",
};

export interface DrugNetworkEdgeRouteEditProps {
  route: DrugNetworkEdgeRouteState;
  boardLocked: boolean;
  onModeChange: (mode: DrugNetworkEdgeRouteMode) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (waypointId: string) => void;
  onResetRoute: () => void;
}

export function DrugNetworkEdgeDetail({
  edge,
  sourceNode,
  targetNode,
  neighborhood,
  focusId = null,
  onFocusNode,
  routeEdit,
  openReturnPath = null,
}: {
  edge: DrugGraphEdge;
  sourceNode: DrugGraphNode | null;
  targetNode: DrugGraphNode | null;
  neighborhood?: Pick<DrugGraphNeighborhoodResponse, "nodes" | "edges">;
  focusId?: string | null;
  onFocusNode?: (node: DrugGraphNode) => void;
  /** DI-9.3: present only in Analyst Mode — omitting it hides the entire routing section (same "no edit affordance in View Mode" contract as the node inspector's pin section). */
  routeEdit?: DrugNetworkEdgeRouteEditProps;
  /** Navigation-only Network (or other internal) path to restore after an entity drill-down. */
  openReturnPath?: string | null;
}) {
  const { t, language } = useT();

  const roleLabel = (role: string): string => {
    if (!isValidDrugCasePersonRole(role)) return role;
    const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
    return language === "th" ? meta.labelTh : meta.labelEn;
  };
  const typedExplanation = explainDrugGraphEdgeClient(edge.explanation, roleLabel, language);
  const loadedNeighborhood = neighborhood ?? {
    nodes: [sourceNode, targetNode].filter((node): node is DrugGraphNode => Boolean(node)),
    edges: [edge],
  };
  const model = buildRelationshipExplanation({
    edge,
    sourceNode,
    targetNode,
    neighborhood: loadedNeighborhood,
    language,
    focusId,
  });
  const sentence = model.insufficientDetail ? t("di.network.explainInsufficient") : model.sentence;
  void typedExplanation;
  const sourceHeading = model.sourceLabel ?? (sourceNode ? t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[sourceNode.type] as TranslationKey) : null);
  const targetHeading = model.targetLabel ?? (targetNode ? t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[targetNode.type] as TranslationKey) : null);
  const whyHeading =
    model.whyHeadingKind === "INFERRED_PERSONS"
      ? t("di.network.explainWhyInferredHeading")
      : t("di.network.explainWhyHeading");
  const primaryActions = model.actions.filter((item) => item.prominence === "primary");
  const secondaryActions = model.actions.filter((item) => item.prominence === "secondary");

  const nodeForAction = (entityId: string): DrugGraphNode | null => {
    if (sourceNode?.id === entityId) return sourceNode;
    if (targetNode?.id === entityId) return targetNode;
    if (model.focusPerson?.id === entityId) return model.focusPerson;
    if (model.focusCase?.id === entityId) return model.focusCase;
    return loadedNeighborhood.nodes.find((node) => node.id === entityId) ?? null;
  };
  const entityOpenHref = (type: DrugGraphNode["type"], id: string): string | null => {
    const href = relationshipEntityHref(type, id);
    return href ? withReturnTo(href, openReturnPath) : null;
  };

  return (
    <div className="space-y-3">
      <section className="space-y-1.5">
        <h3 className="text-base font-semibold leading-snug text-foreground">{whyHeading}</h3>
        {sourceHeading && targetHeading ? (
          <p className="text-sm font-medium text-foreground">
            {sourceHeading} <span aria-hidden="true">↔</span> <span className="sr-only">{t("di.network.edgeTo")}</span> {targetHeading}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-foreground">{sentence}</p>
        {model.followUpSentence ? <p className="text-sm leading-relaxed text-foreground">{model.followUpSentence}</p> : null}
        {model.compactCaseContext ? <p className="text-xs leading-relaxed text-muted">{model.compactCaseContext}</p> : null}
        {model.inferredFacts.length > 0 ? (
          <ul className="space-y-0.5 text-sm text-foreground">
            {model.inferredFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : null}
        {model.inferredDisclaimer ? <p className="text-xs leading-relaxed text-muted">{model.inferredDisclaimer}</p> : null}
        <Badge tone={edge.edgeKind === "DIRECT" ? "accent" : "warning"} className="mt-1 opacity-80">
          {edge.edgeKind === "DIRECT" ? t("di.network.explainDirect") : t("di.network.explainInferred")}
        </Badge>
        {edge.edgeKind === "INFERRED" ? (
          <p className="text-xs text-muted">{t("di.network.explainSharedCount").replace("{count}", String(edge.evidenceCount))}</p>
        ) : null}
      </section>

      {model.summaryChips.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold text-foreground">{t("di.network.explainCaseRevealHeading")}</h4>
          <p className="mb-1.5 text-[11px] text-muted">{t("di.network.explainCaseRevealHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {model.summaryChips.map((chip) => (
              <span key={chip.type} className="rounded-md border border-border bg-neutral-bg px-2 py-1 text-xs text-foreground">
                {chip.emoji} {chip.label} {chip.count}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {model.crossCaseSignals.length > 0 ? (
        <section className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">{t("di.network.explainCrossCaseHeading")}</h4>
          <ul className="space-y-1.5">
            {model.crossCaseSignals.map((item) => {
              const href = entityOpenHref(item.type, item.id);
              return (
                <li key={item.id} className="rounded-md border border-border px-2.5 py-2">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-neutral-bg px-1.5 py-px text-[10px] font-medium text-foreground">
                      {t("di.network.explainRepeatedBadge")}
                    </span>
                    <span className="text-xs font-semibold text-foreground">{item.totalLine}</span>
                  </div>
                  <p className="text-[11px] text-muted">{item.typeLabel}</p>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground">{item.story}</p>
                  {item.otherCaseLabels.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {item.otherCaseLabels.map((caseLabel) => (
                        <li key={caseLabel} className="text-xs text-foreground">
                          {caseLabel}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.openAllHint ? <p className="mt-1 text-[11px] text-muted">{item.openAllHint}</p> : null}
                  {href ? (
                    <Link href={href} className="mt-1 inline-block text-xs text-accent hover:underline">
                      {item.openLabel}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {model.otherInCase.length > 0 ? (
        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">{t("di.network.explainOtherInCaseHeading")}</h4>
          <ul className="divide-y divide-border rounded-md border border-border">
            {model.otherInCase.map((item) => {
              const href = entityOpenHref(item.type, item.id);
              const row = (
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {item.emoji} {item.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{item.foundLine}</span>
                </span>
              );
              return (
                <li key={item.id} className="px-2.5 py-1.5">
                  {href ? (
                    <Link href={href} className="block hover:text-accent">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {model.showSeparateProvenance && model.provenanceCases.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {model.provenanceCases.map((item) => (
            <Link
              key={item.id}
              href={withReturnTo(drugEntityDetailPath("CASE", item.id), openReturnPath)}
              className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-accent hover:underline"
            >
              {item.label ?? t("di.network.openCase")}
            </Link>
          ))}
        </div>
      ) : null}

      {primaryActions.length > 0 || secondaryActions.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-col gap-2">
            {primaryActions.map((action, index) => {
              const node = nodeForAction(action.entityId);
              if (action.kind === "FOCUS" && node) {
                return (
                  <Button key={`${action.kind}:${action.entityId}`} type="button" variant={index === 0 ? "accent" : "outline"} size="sm" onClick={() => onFocusNode?.(node)}>
                    {action.label}
                  </Button>
                );
              }
              const href = entityOpenHref(action.entityType, action.entityId);
              if (action.kind === "OPEN" && href) {
                return (
                  <Button key={`${action.kind}:${action.entityId}`} asChild variant={index === 0 ? "accent" : "outline"} size="sm">
                    <Link href={href}>{action.label}</Link>
                  </Button>
                );
              }
              return null;
            })}
          </div>
          {secondaryActions.map((action) => {
            const href = entityOpenHref(action.entityType, action.entityId);
            if (!href) return null;
            return (
              <Link key={`${action.kind}:${action.entityId}`} href={href} className="inline-block text-xs text-muted hover:text-accent hover:underline">
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      {routeEdit ? <DrugNetworkEdgeRouteSection {...routeEdit} /> : null}
    </div>
  );
}

/**
 * DI-9.3 Section 7/21/29: the presentation-only routing section. Its own
 * bordered block (same visual pattern as the DI-9.2 pin-status section in
 * drug_network_node_detail.tsx) so it's unmistakably separate from the
 * factual fields above. All controls are plain keyboard-accessible
 * buttons (Section 29) — waypoint DRAG remains pointer-only (canvas
 * handles), but add/remove/reset/mode-change never require a pointer.
 */
function DrugNetworkEdgeRouteSection({ route, boardLocked, onModeChange, onAddWaypoint, onRemoveWaypoint, onResetRoute }: DrugNetworkEdgeRouteEditProps) {
  const { t } = useT();
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);

  const waypointStillExists = route.waypoints.some((wp) => wp.id === selectedWaypointId);
  const effectiveSelectedWaypointId = waypointStillExists ? selectedWaypointId : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-neutral-bg/40 p-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Waypoints className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("di.network.routeSectionTitle")}
        </p>
        <p className="mt-1 text-xs text-muted">{t("di.network.routeSectionMicrocopy")}</p>
      </div>

      {boardLocked ? <p className="text-xs text-warning">{t("di.network.routeEditDisabledLocked")}</p> : null}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.routeModeLabel")}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("di.network.routeModeLabel")}>
          {ROUTE_MODE_ORDER.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={route.mode === mode ? "accent" : "outline"}
              disabled={boardLocked}
              aria-pressed={route.mode === mode}
              onClick={() => onModeChange(mode)}
            >
              {t(ROUTE_MODE_LABEL_KEY[mode])}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-foreground">
        {t("di.network.routeWaypointCount")}: <span className="font-medium">{route.waypoints.length}</span>
      </p>

      {route.waypoints.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {route.waypoints.map((wp, index) => (
            <button
              key={wp.id}
              type="button"
              disabled={boardLocked}
              aria-pressed={effectiveSelectedWaypointId === wp.id}
              onClick={() => setSelectedWaypointId(wp.id)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${effectiveSelectedWaypointId === wp.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:text-foreground"}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">{t("di.network.routeNoWaypoints")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={boardLocked} onClick={onAddWaypoint}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("di.network.routeAddWaypoint")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={boardLocked || !effectiveSelectedWaypointId}
          onClick={() => {
            if (effectiveSelectedWaypointId) {
              onRemoveWaypoint(effectiveSelectedWaypointId);
              setSelectedWaypointId(null);
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t("di.network.routeRemoveWaypoint")}
        </Button>
        <Button variant="ghost" size="sm" disabled={boardLocked} onClick={onResetRoute}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("di.network.routeResetRoute")}
        </Button>
      </div>
    </div>
  );
}
