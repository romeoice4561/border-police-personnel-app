/**
 * Custom @xyflow/react edge renderer for manually-routed factual edges
 * (Phase DI-9.3, Section 5). Only ever used for an edge that currently has
 * a non-AUTO route mode WITH at least one waypoint — every other edge
 * keeps rendering through xyflow's original built-in edge types
 * (smoothstep/step/default), completely untouched by this component.
 *
 * Purpose is ROUTING, not semantic redesign — visual styling (DIRECT solid
 * / INFERRED dashed, selection ring, dimming, relationship label, arrow
 * marker) is passed straight through as the same `style`/`label`/
 * `markerEnd` props the pre-DI-9.3 built-in edges already received, so a
 * routed edge looks identical to an unrouted one except for its path
 * shape. Route geometry math lives in the pure
 * lib/drug_intelligence/drug_network_edge_routing.ts module; this
 * component only supplies already-transformed graph-space points to it and
 * renders the result.
 *
 * The route Record in the page component (`edgeRoutes`) is the single
 * source of truth — NOT xyflow's own internal edge array, which gets
 * rebuilt from scratch by buildDrugNetworkFlowGraph on every relevant
 * re-render. A waypoint drag therefore calls back up to the page via
 * `data.onWaypointDrag` rather than calling xyflow's `setEdges` directly,
 * so the dragged position survives the next rebuild instead of being
 * silently overwritten by stale route data.
 *
 * Waypoint handles (Section 9/20): rendered via EdgeLabelRenderer (an HTML
 * portal already positioned/scaled with the viewport transform, per
 * xyflow's own documented pattern) — small neutral circles, never using
 * node-type colors, never confusable with factual entities. Only shown
 * when this edge is BOTH the selected edge AND `analystMode` is true AND
 * the board isn't locked (Section 4/19) — never on every edge at once,
 * which would make a dense graph unreadable (Section 9's explicit
 * requirement).
 *
 * Section 8's DI-9.2 drawer-backdrop warning applies here too: the page
 * deliberately decouples `selectedEdge` (drives `selected` here) from the
 * Edge Inspector Drawer's own open/closed visibility — closing the drawer
 * no longer clears the selection. Without that, the drawer's full-screen
 * modal backdrop would sit on top of these very handles while open, and
 * closing it would hide them again by deselecting, leaving no reachable
 * state to actually drag a waypoint from. See the page's `edgeDrawerOpen`
 * state and its doc comment for the full explanation.
 */
"use client";

import { useCallback } from "react";
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from "@xyflow/react";
import { buildRoutedPath, type RoutePoint } from "@/lib/drug_intelligence/drug_network_edge_routing";
import { useT } from "@/components/i18n/language_provider";
import type { DrugNetworkFlowEdgeData } from "@/lib/drug_intelligence/drug_network_graph_flow_adapter";

export function DrugNetworkRoutedEdge(props: EdgeProps & { data: DrugNetworkFlowEdgeData }) {
  const { id, sourceX, sourceY, targetX, targetY, style, markerEnd, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius, selected, data } = props;
  const { t } = useT();
  const { screenToFlowPosition } = useReactFlow();

  const route = data.route;
  const points: RoutePoint[] = [{ x: sourceX, y: sourceY }, ...route.waypoints, { x: targetX, y: targetY }];
  const path = route.mode === "AUTO" ? "" : buildRoutedPath(route.mode, points);

  // Section 11/26: converts the live pointer position to graph-space on
  // every move — correct after any pan/zoom/fitView because
  // screenToFlowPosition reads the CURRENT viewport transform each call,
  // never a cached one.
  const handlePointerDown = useCallback(
    (waypointId: string) => (event: React.PointerEvent) => {
      if (!data.analystMode || data.boardLocked) return;
      // Stops this pointerdown from also starting xyflow's own canvas-pan
      // drag underneath the handle.
      event.nativeEvent.stopImmediatePropagation();
      event.stopPropagation();
      (event.target as Element).setPointerCapture(event.pointerId);

      function onMove(moveEvent: PointerEvent) {
        const flowPos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
        data.onWaypointDrag(id, waypointId, flowPos);
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [data, id, screenToFlowPosition]
  );

  const showHandles = data.analystMode && !data.boardLocked && selected;

  return (
    <>
      <BaseEdge
        id={id}
        path={path || `M ${sourceX},${sourceY} L ${targetX},${targetY}`}
        style={style}
        markerEnd={markerEnd}
        label={label}
        labelStyle={labelStyle}
        labelShowBg
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
      />
      {showHandles ? (
        <EdgeLabelRenderer>
          {route.waypoints.map((wp) => (
            <div
              key={wp.id}
              role="button"
              tabIndex={0}
              aria-label={t("di.network.routeWaypointHandle")}
              onPointerDown={handlePointerDown(wp.id)}
              onClick={(event) => {
                // A click on the handle (including the one that fires on
                // pointerup after a drag) must never reach xyflow's Pane
                // onClick, which calls resetSelectedElements() — that's
                // an internal xyflow visual-selection reset, harmless to
                // this page's own selectedEdge state, but stopping it
                // here keeps xyflow's own selection ring in sync and
                // avoids any flicker.
                event.nativeEvent.stopImmediatePropagation();
                event.stopPropagation();
              }}
              className="nodrag nopan absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-neutral bg-surface shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ left: wp.x, top: wp.y, pointerEvents: "all" }}
            >
              <span className="sr-only">{t("di.network.routeWaypointHandle")}</span>
            </div>
          ))}
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
