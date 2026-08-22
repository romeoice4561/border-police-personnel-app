/**
 * Deterministic radial layout for the Network Intelligence canvas (Phase
 * DI-5, Section 8).
 *
 * A simple, dependency-free layout: the focus node sits at the center;
 * every other node is placed on a ring whose radius is its hop-distance
 * (via BFS over the returned edges) from the focus, spread evenly around
 * the ring. This is deterministic (same input always produces the same
 * layout — no physics simulation, no randomness) and cheap enough to
 * recompute on every expand without a layout library. @xyflow/react only
 * needs {x, y} positions — this module computes exactly that and nothing
 * about rendering.
 *
 * Pure — no I/O, no React.
 */

export interface LayoutNodeInput {
  id: string;
}
export interface LayoutEdgeInput {
  source: string;
  target: string;
}

const RING_SPACING = 220;
const CENTER = { x: 0, y: 0 };

export function computeRadialLayout(focusId: string, nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  // BFS hop-distance from the focus node — nodes unreachable from focus (shouldn't happen given how the service builds a connected neighborhood, but handled safely) fall onto an outer ring by insertion order.
  const distance = new Map<string, number>();
  if (adjacency.has(focusId)) {
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
  }

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
