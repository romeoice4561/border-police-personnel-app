/**
 * Deterministic client-side layout engine for the Network Intelligence
 * canvas (Phase DI-5 Section 8; extended by Phase DI-5.3 Sections 4-10).
 *
 * Every function here is a pure position-computer: (focus, nodes, edges) in,
 * {id -> {x,y}} out. No physics simulation, no randomness, no external
 * layout library (dagre/elk/d3-force) — per DI-5.3 Section 9's explicit
 * instruction to first exhaust what's achievable with @xyflow/react plus
 * hand-written deterministic helpers before adding a dependency. Switching
 * layout mode NEVER touches graph data (nodes/edges/relationships) — it only
 * recomputes {x,y}. @xyflow/react is not imported here; this stays testable
 * without a DOM or provider.
 */

export interface LayoutNodeInput {
  id: string;
  type: LayoutNodeType;
}
export interface LayoutEdgeInput {
  source: string;
  target: string;
}

export type LayoutNodeType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE" | "LOCATION";

export type DrugNetworkLayoutMode = "AUTO" | "PERSON_CENTERED" | "CASE_CENTERED" | "HIERARCHICAL" | "GROUP_BY_TYPE" | "COMPACT" | "PATH";

const RING_SPACING = 220;
const CENTER = { x: 0, y: 0 };

/** BFS hop-distance from `focusId` over an undirected view of `edges`. Unreachable nodes (shouldn't happen given how the service builds a connected neighborhood, but handled safely) get `undefined`. */
function bfsDistances(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const distance = new Map<string, number>();
  if (!adjacency.has(focusId)) return distance;
  distance.set(focusId, 0);
  const queue: string[] = [focusId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distance.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, currentDist + 1);
      queue.push(neighbor);
    }
  }
  return distance;
}

/**
 * Original DI-5 radial layout — kept as the plain fallback (no type-sector
 * grouping) for any caller that doesn't know node types, and as the engine
 * `computePersonCenteredLayout` builds sector-awareness on top of.
 */
export function computeRadialLayout(focusId: string, nodes: { id: string }[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const distance = bfsDistances(
    focusId,
    nodes.map((n) => ({ id: n.id, type: "PERSON" as LayoutNodeType })),
    edges
  );

  const maxKnownDistance = Math.max(0, ...distance.values());
  const ringGroups = new Map<number, string[]>();
  for (const node of nodes) {
    const ring = distance.get(node.id) ?? maxKnownDistance + 1;
    const group = ringGroups.get(ring) ?? [];
    group.push(node.id);
    ringGroups.set(ring, group);
  }

  positions.set(focusId, { ...CENTER });
  for (const [ring, ids] of ringGroups) {
    if (ring === 0) continue;
    const radius = ring * RING_SPACING;
    const count = ids.length;
    ids.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      positions.set(id, {
        x: CENTER.x + radius * Math.cos(angle),
        y: CENTER.y + radius * Math.sin(angle),
      });
    });
  }

  return positions;
}

/**
 * DI-5.3 Section 5: type-sector angular ordering — reduces edge crossing by
 * grouping same-type nodes into a contiguous angular slice per ring, instead
 * of scattering them by arbitrary insertion order. Cases / Phones-SIM /
 * Devices / Vehicles / Persons-Locations, in that fixed clockwise order
 * starting from the top, so the sector a type lands in is deterministic and
 * stable across renders/rings.
 */
const TYPE_SECTOR_ORDER: LayoutNodeType[] = ["CASE", "PHONE", "SIM", "DEVICE", "VEHICLE", "PERSON", "LOCATION"];
function sectorIndex(type: LayoutNodeType): number {
  const i = TYPE_SECTOR_ORDER.indexOf(type);
  return i === -1 ? TYPE_SECTOR_ORDER.length : i;
}

/**
 * Section 5: Person-centered radial layout. Ring 0 = focus person; Ring 1 =
 * direct neighbors; Ring 2 = second-hop. Within each ring, nodes are sorted
 * by type-sector then id (for a stable tie-break), so same-type nodes form
 * a contiguous angular group instead of interleaving — this is what keeps
 * "every ring node at nearly the same angle" from happening on a dense
 * neighborhood.
 */
export function computePersonCenteredLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  return computeSectoredRadialLayout(focusId, nodes, edges);
}

/**
 * Section 6: Case-centered layout. The focus case sits at the center;
 * first-ring entities are placed by fixed quadrant (Persons top-left,
 * Phones/SIM top-right, Devices/Vehicles bottom-right, Locations
 * bottom-left) rather than the generic sector order, matching the spec's
 * explicit quadrant requirement. Second-hop entities sit on an outer ring
 * in the same quadrant scheme.
 */
const CASE_CENTERED_QUADRANT: Record<LayoutNodeType, number> = {
  // Quadrant angle centers, radians, 0 = right/east, increasing clockwise (screen y-down).
  PERSON: (5 * Math.PI) / 4, // top-left
  LOCATION: (3 * Math.PI) / 4, // bottom-left
  PHONE: (7 * Math.PI) / 4, // top-right
  SIM: (7 * Math.PI) / 4, // top-right
  DEVICE: Math.PI / 4, // bottom-right
  VEHICLE: Math.PI / 4, // bottom-right
  CASE: 0,
};

export function computeCaseCenteredLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const distance = bfsDistances(focusId, nodes, edges);
  const maxKnownDistance = Math.max(0, ...distance.values());
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const ringGroups = new Map<number, string[]>();
  for (const node of nodes) {
    const ring = distance.get(node.id) ?? maxKnownDistance + 1;
    const group = ringGroups.get(ring) ?? [];
    group.push(node.id);
    ringGroups.set(ring, group);
  }

  positions.set(focusId, { ...CENTER });
  for (const [ring, ids] of ringGroups) {
    if (ring === 0) continue;
    const radius = ring * RING_SPACING;
    // Sort within the ring by quadrant angle, then id, then spread within a
    // fixed +/- arc around each type's quadrant center so same-type nodes
    // stay clustered but don't overlap at one exact angle.
    const grouped = new Map<number, string[]>();
    for (const id of ids) {
      const type = byId.get(id)?.type ?? "PERSON";
      const center = CASE_CENTERED_QUADRANT[type];
      const bucket = grouped.get(center) ?? [];
      bucket.push(id);
      grouped.set(center, bucket);
    }
    const sortedCenters = [...grouped.keys()].sort((a, b) => a - b);
    for (const center of sortedCenters) {
      const bucket = grouped.get(center)!.sort();
      const arc = Math.PI / 3; // +/- 30deg spread within the quadrant so a bucket of >1 doesn't stack exactly
      bucket.forEach((id, index) => {
        const spread = bucket.length === 1 ? 0 : arc * (index / (bucket.length - 1) - 0.5);
        const angle = center + spread;
        positions.set(id, {
          x: CENTER.x + radius * Math.cos(angle),
          y: CENTER.y + radius * Math.sin(angle),
        });
      });
    }
  }

  return positions;
}

/** Shared sector-ordered radial placement used by both Person-centered and (as a base) Compact. */
function computeSectoredRadialLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const distance = bfsDistances(focusId, nodes, edges);
  const maxKnownDistance = Math.max(0, ...distance.values());
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const ringGroups = new Map<number, string[]>();
  for (const node of nodes) {
    const ring = distance.get(node.id) ?? maxKnownDistance + 1;
    const group = ringGroups.get(ring) ?? [];
    group.push(node.id);
    ringGroups.set(ring, group);
  }

  positions.set(focusId, { ...CENTER });
  for (const [ring, ids] of ringGroups) {
    if (ring === 0) continue;
    const radius = ring * RING_SPACING;
    const sorted = [...ids].sort((a, b) => {
      const ta = sectorIndex(byId.get(a)?.type ?? "PERSON");
      const tb = sectorIndex(byId.get(b)?.type ?? "PERSON");
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    });
    const count = sorted.length;
    sorted.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      positions.set(id, {
        x: CENTER.x + radius * Math.cos(angle),
        y: CENTER.y + radius * Math.sin(angle),
      });
    });
  }

  return positions;
}

/**
 * Section 7: Hierarchical layout — top-to-bottom layers by hop distance
 * from focus. Within a layer, deterministic sorting by (type-sector, id)
 * reduces edge crossings versus arbitrary order, mirroring the sectoring
 * used by the radial layouts so the same node lands in a visually
 * consistent relative position across layout modes.
 */
const LAYER_HEIGHT = 160;
const LAYER_NODE_SPACING = 200;

export function computeHierarchicalLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const distance = bfsDistances(focusId, nodes, edges);
  const maxKnownDistance = Math.max(0, ...distance.values());
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const layerGroups = new Map<number, string[]>();
  for (const node of nodes) {
    const layer = distance.get(node.id) ?? maxKnownDistance + 1;
    const group = layerGroups.get(layer) ?? [];
    group.push(node.id);
    layerGroups.set(layer, group);
  }

  for (const [layer, ids] of layerGroups) {
    const sorted = [...ids].sort((a, b) => {
      const ta = sectorIndex(byId.get(a)?.type ?? "PERSON");
      const tb = sectorIndex(byId.get(b)?.type ?? "PERSON");
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    });
    const totalWidth = (sorted.length - 1) * LAYER_NODE_SPACING;
    sorted.forEach((id, index) => {
      positions.set(id, {
        x: index * LAYER_NODE_SPACING - totalWidth / 2,
        y: layer * LAYER_HEIGHT,
      });
    });
  }

  return positions;
}

/**
 * Section 8: Group-by-entity-type layout — one vertical lane per node type,
 * nodes stacked within their lane sorted by id for determinism. Lane order
 * follows TYPE_SECTOR_ORDER so it's visually consistent with the other
 * layouts' sector ordering.
 */
const LANE_WIDTH = 240;
const LANE_NODE_SPACING = 110;

export function computeGroupByTypeLayout(_focusId: string, nodes: LayoutNodeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const byType = new Map<LayoutNodeType, string[]>();
  for (const node of nodes) {
    const bucket = byType.get(node.type) ?? [];
    bucket.push(node.id);
    byType.set(node.type, bucket);
  }

  for (const type of TYPE_SECTOR_ORDER) {
    const ids = (byType.get(type) ?? []).sort();
    const laneIndex = sectorIndex(type);
    const totalHeight = (ids.length - 1) * LANE_NODE_SPACING;
    ids.forEach((id, index) => {
      positions.set(id, {
        x: laneIndex * LANE_WIDTH,
        y: index * LANE_NODE_SPACING - totalHeight / 2,
      });
    });
  }

  return positions;
}

/** Lane label i18n-key metadata for Section 8's optional lane headers — pure data, no i18n import. */
export function groupByTypeLaneOrder(): LayoutNodeType[] {
  return [...TYPE_SECTOR_ORDER];
}

/**
 * Section 9: Compact layout — deterministic collision-aware placement.
 * Starts from the sectored radial layout (keeps focus centered, connected
 * clusters close) then applies a bounded number of deterministic
 * relaxation passes: any pair of nodes closer than MIN_SPACING is pushed
 * apart along the line between their current centers. No physics engine,
 * no randomness — same input always converges to the same output, and the
 * pass count is fixed so runtime stays bounded.
 */
const MIN_SPACING = 130;
const RELAXATION_PASSES = 24;

export function computeCompactLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = computeSectoredRadialLayout(focusId, nodes, edges);
  if (positions.size <= 1) return positions;

  const ids = [...positions.keys()].sort(); // fixed iteration order for determinism
  for (let pass = 0; pass < RELAXATION_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        if (idA === focusId && idB === focusId) continue;
        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= MIN_SPACING || dist === 0) {
          if (dist === 0) {
            // Exact coincidence (degenerate input) — nudge deterministically by id order, never randomly.
            const nudge = MIN_SPACING / 2;
            if (idA !== focusId) positions.set(idA, { x: a.x - nudge, y: a.y });
            if (idB !== focusId) positions.set(idB, { x: b.x + nudge, y: b.y });
            moved = true;
          }
          continue;
        }
        const overlap = MIN_SPACING - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const half = overlap / 2;
        // The focus node stays fixed so it never drifts from center; the other node absorbs the full push.
        if (idA === focusId) {
          positions.set(idB, { x: b.x + ux * overlap, y: b.y + uy * overlap });
        } else if (idB === focusId) {
          positions.set(idA, { x: a.x - ux * overlap, y: a.y - uy * overlap });
        } else {
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
 * Section 10: Path layout — a linear/stepped A -> ... -> B arrangement for
 * Find Connection results. Path nodes are placed left-to-right in step
 * order at y=0; every non-path node (still shown, faded, never removed —
 * Section 10) is placed on a secondary row below so it doesn't collide with
 * the path itself.
 */
const PATH_STEP_SPACING = 260;
const OFF_PATH_ROW_Y = 220;
const OFF_PATH_NODE_SPACING = 180;

export function computePathLayout(pathNodeIdsInOrder: string[], allNodes: LayoutNodeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const pathSet = new Set(pathNodeIdsInOrder);

  pathNodeIdsInOrder.forEach((id, index) => {
    positions.set(id, { x: index * PATH_STEP_SPACING, y: 0 });
  });

  const offPath = allNodes.filter((n) => !pathSet.has(n.id)).sort((a, b) => a.id.localeCompare(b.id));
  const totalWidth = (offPath.length - 1) * OFF_PATH_NODE_SPACING;
  offPath.forEach((n, index) => {
    positions.set(n.id, { x: index * OFF_PATH_NODE_SPACING - totalWidth / 2, y: OFF_PATH_ROW_Y });
  });

  return positions;
}

/**
 * Section 4: AUTO layout resolution — deterministic choice based on the
 * current focus/composition, never a heuristic that could vary between
 * runs on the same input.
 */
export interface AutoLayoutContext {
  focusType: LayoutNodeType;
  isPathResult: boolean;
  nodeCount: number;
}

export function resolveAutoLayoutMode(ctx: AutoLayoutContext): Exclude<DrugNetworkLayoutMode, "AUTO"> {
  if (ctx.isPathResult) return "PATH";
  if (ctx.focusType === "PERSON") return "PERSON_CENTERED";
  if (ctx.focusType === "CASE") return "CASE_CENTERED";
  if (ctx.nodeCount > 18) return "COMPACT";
  return "HIERARCHICAL";
}

/**
 * Single entry point dispatching to the right pure layout function for a
 * resolved (non-AUTO) mode — DI-5.3 Section 11: switching layout only
 * recomputes positions, never touches nodes/edges data.
 */
export function computeLayoutForMode(
  mode: Exclude<DrugNetworkLayoutMode, "AUTO">,
  focusId: string,
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  pathNodeIdsInOrder?: string[]
): Map<string, { x: number; y: number }> {
  switch (mode) {
    case "PERSON_CENTERED":
      return computePersonCenteredLayout(focusId, nodes, edges);
    case "CASE_CENTERED":
      return computeCaseCenteredLayout(focusId, nodes, edges);
    case "HIERARCHICAL":
      return computeHierarchicalLayout(focusId, nodes, edges);
    case "GROUP_BY_TYPE":
      return computeGroupByTypeLayout(focusId, nodes);
    case "COMPACT":
      return computeCompactLayout(focusId, nodes, edges);
    case "PATH":
      return computePathLayout(pathNodeIdsInOrder ?? [], nodes);
  }
}

/**
 * Recommended xyflow edge `type` per layout mode — Section 14,
 * presentation-only, never changes edge semantics. Must be one of
 * @xyflow/react's built-in edge type names (default/straight/step/
 * smoothstep/simplebezier) — "default" IS the bezier-curve renderer
 * (BezierEdgeInternal); "bezier" is not a registered type name and using
 * it silently falls back to "default" anyway, so name it correctly here.
 */
export function edgeTypeForLayoutMode(mode: Exclude<DrugNetworkLayoutMode, "AUTO">): "smoothstep" | "step" | "default" {
  switch (mode) {
    case "HIERARCHICAL":
    case "GROUP_BY_TYPE":
    case "PATH":
      return "smoothstep";
    case "PERSON_CENTERED":
    case "CASE_CENTERED":
    case "COMPACT":
      return "default";
  }
}
