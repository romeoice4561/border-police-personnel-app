/**
 * Pure position-merge helpers for Analyst Mode node pinning (Phase DI-9.2).
 *
 * Pinning is PRESENTATION STATE ONLY — a Set<string> of node ids living in
 * the page component's local state, never written to DrugGraphNode, never
 * sent to any API, never persisted. This module never imports React or
 * @xyflow/react so it stays testable without a DOM/provider, matching the
 * existing convention in drug_network_graph_layout.ts and
 * drug_network_graph_flow_adapter.ts.
 *
 * Two distinct concepts (Section 4/7 of the DI-9.2 spec — do not conflate):
 *   - PINNED: excluded from auto-layout recomputation. Still draggable.
 *   - BOARD LOCKED: a separate xyflow `nodesDraggable={false}` toggle,
 *     applied directly in the page component — nothing here.
 */

export interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

const MIN_SPACING = 130;
const RELAXATION_PASSES = 24;

/**
 * Section 8/9/10 — the core DI-9.2 requirement. Given freshly computed
 * layout positions and the positions currently on screen, returns a merged
 * position map where every PINNED node id keeps its exact current on-screen
 * position (authoritative — Section 10) and every other node takes its
 * newly computed position. A pinned node with no current position (e.g. it
 * was pinned then the graph changed and it's somehow missing) falls back to
 * the computed position rather than being dropped.
 *
 * Then runs the same bounded, deterministic relaxation pass used by
 * computeCompactLayout (no new collision engine — Section 10's explicit
 * instruction) restricted to nudging UNPINNED nodes away from pinned ones;
 * pinned positions are never moved by this pass.
 */
export function applyPinnedPositions(computedPositions: Map<string, { x: number; y: number }>, currentPositions: Map<string, { x: number; y: number }>, pinnedNodeIds: ReadonlySet<string>): Map<string, { x: number; y: number }> {
  const merged = new Map<string, { x: number; y: number }>();
  for (const [id, computed] of computedPositions) {
    if (pinnedNodeIds.has(id)) {
      const current = currentPositions.get(id);
      merged.set(id, current ?? computed);
    } else {
      merged.set(id, computed);
    }
  }
  return relaxUnpinnedAroundPinned(merged, pinnedNodeIds);
}

/**
 * Section 10 — collision relaxation scoped to pinned/unpinned conflicts
 * only: an unpinned node that lands within MIN_SPACING of a pinned node (or
 * another unpinned node) is pushed away; pinned nodes never move. This is
 * the same fixed-pass, id-ordered, no-randomness approach as
 * computeCompactLayout so behavior stays deterministic and bounded.
 */
function relaxUnpinnedAroundPinned(positions: Map<string, { x: number; y: number }>, pinnedNodeIds: ReadonlySet<string>): Map<string, { x: number; y: number }> {
  if (positions.size <= 1) return positions;
  const ids = [...positions.keys()].sort();

  for (let pass = 0; pass < RELAXATION_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const aPinned = pinnedNodeIds.has(idA);
        const bPinned = pinnedNodeIds.has(idB);
        if (aPinned && bPinned) continue; // Section 10: pinned positions are authoritative — never adjusted against each other.

        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
          const nudge = MIN_SPACING / 2;
          if (!aPinned) positions.set(idA, { x: a.x - nudge, y: a.y });
          if (!bPinned) positions.set(idB, { x: b.x + nudge, y: b.y });
          moved = true;
          continue;
        }
        if (dist >= MIN_SPACING) continue;

        const overlap = MIN_SPACING - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        if (aPinned) {
          // Section 10: prefer moving the unpinned node when one side is pinned.
          positions.set(idB, { x: b.x + ux * overlap, y: b.y + uy * overlap });
        } else if (bPinned) {
          positions.set(idA, { x: a.x - ux * overlap, y: a.y - uy * overlap });
        } else {
          const half = overlap / 2;
          positions.set(idA, { x: a.x - ux * half, y: a.y - uy * half });
          positions.set(idB, { x: b.x + ux * half, y: b.y + uy * half });
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return positions;
}

/**
 * Section 12/20 — when the graph's node set changes (focus/depth/filter
 * change), stale pin ids for nodes no longer present must be dropped so
 * they can never silently apply to an unrelated future node that happens to
 * reuse the id space (ids are UUIDs so collision is not a real risk, but a
 * pin for a node that no longer exists is simply dead weight otherwise).
 * Pins for ids still present in the new node set are preserved as-is.
 */
export function prunePinnedNodeIds(pinnedNodeIds: ReadonlySet<string>, currentNodeIds: ReadonlySet<string>): Set<string> {
  const next = new Set<string>();
  for (const id of pinnedNodeIds) {
    if (currentNodeIds.has(id)) next.add(id);
  }
  return next;
}
