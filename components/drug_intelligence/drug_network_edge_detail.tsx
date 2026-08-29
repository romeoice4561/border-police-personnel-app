/**
 * Edge detail panel content (Phase DI-5, Section 11; polished DI-9.1
 * Section 10; DI-9.3 Section 7/21 adds an optional presentation-state
 * routing section). Rendered inside the shared Drawer primitive. Every
 * edge always shows: source/target entity, relationship type, DIRECT vs
 * INFERRED, explanation, evidence count, first/last seen, and clickable
 * source cases (Section 11's explicit requirement — "never a mysterious
 * line").
 *
 * DI-9.1 addition: the source/target node LABELS ("ระหว่าง A และ B"). The
 * canvas only ever labels the RELATIONSHIP on the edge itself, not which
 * two entities it connects — on a dense graph a user opening this drawer
 * could not previously tell which two nodes this specific line was
 * between without looking back at the canvas. DrugGraphEdge only carries
 * source/target as opaque node IDs, so the page resolves them to
 * DrugGraphNode objects from the already-fetched neighborhood and passes
 * them in — no new API call, no new data.
 *
 * DI-9.3 addition: "การจัดเส้นบนผัง" (route on board) — shown ONLY when
 * `route`/route-editing callbacks are provided (i.e. Analyst Mode; View
 * Mode passes none of them and the whole section is omitted, matching the
 * pin section's existing pattern in drug_network_node_detail.tsx).
 * Deliberately its own bordered block, visually and semantically separate
 * from the FACTUAL fields above it (relationship type, DIRECT/INFERRED,
 * evidence, source/target, cases, explanation) — routing is presentation
 * state, never evidence, per Section 21's explicit requirement.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Waypoints, Plus, Trash2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY, explainDrugGraphEdgeClient } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugNetworkEdgeRouteMode, DrugNetworkEdgeRouteState } from "@/lib/drug_intelligence/drug_network_edge_routing";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(value: string | null, language: "th" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

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
  routeEdit,
}: {
  edge: DrugGraphEdge;
  sourceNode: DrugGraphNode | null;
  targetNode: DrugGraphNode | null;
  /** DI-9.3: present only in Analyst Mode — omitting it hides the entire routing section (same "no edit affordance in View Mode" contract as the node inspector's pin section). */
  routeEdit?: DrugNetworkEdgeRouteEditProps;
}) {
  const { t, language } = useT();

  const roleLabel = (role: string): string => {
    if (!isValidDrugCasePersonRole(role)) return role;
    const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
    return language === "th" ? meta.labelTh : meta.labelEn;
  };
  const explanation = explainDrugGraphEdgeClient(edge.explanation, roleLabel, language);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-foreground">{t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[edge.relationshipType] as TranslationKey)}</p>
        <Badge tone={edge.edgeKind === "DIRECT" ? "accent" : "warning"}>{edge.edgeKind === "DIRECT" ? t("di.network.edgeDirect") : t("di.network.edgeInferred")}</Badge>
      </div>

      {sourceNode && targetNode ? (
        <p className="rounded-lg bg-neutral-bg px-3 py-2 text-sm text-foreground">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{t("di.network.edgeBetween")}: </span>
          {sourceNode.label} <span aria-hidden="true">↔</span> <span className="sr-only">{t("di.network.edgeTo")}</span> {targetNode.label}
        </p>
      ) : null}

      <p className="text-sm text-foreground">{explanation}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">{t("di.network.evidenceCount")}</dt>
          <dd className="text-foreground">{edge.evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.network.firstSeen")}</dt>
          <dd className="text-foreground">{formatDate(edge.firstSeenAt, language)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.network.lastSeen")}</dt>
          <dd className="text-foreground">{formatDate(edge.lastSeenAt, language)}</dd>
        </div>
      </dl>

      {edge.sourceCaseIds.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.network.sourceCases")}</p>
          <div className="flex flex-wrap gap-2">
            {edge.sourceCaseIds.map((caseId) => (
              <Link
                key={caseId}
                href={`/drug-intelligence/cases/${encodeURIComponent(caseId)}`}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-accent hover:border-accent/50 hover:underline"
              >
                {t("di.network.openCase")}
              </Link>
            ))}
          </div>
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
