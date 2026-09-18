/**
 * Presentation-only visual attachment. Does not change ranking or graph topology.
 */

import { visualLookupKey, type DrugEntityMediaVisual } from "@/lib/drug_intelligence/drug_entity_media_types";
import type { DrugEntityMediaService } from "@/lib/drug_intelligence/drug_entity_media_service";
import type { DrugSearchGroupedResults, DrugSearchResult } from "@/lib/drug_intelligence/drug_search_types";

export type WithVisual<T> = T & { visual?: DrugEntityMediaVisual | null };

export type DrugSearchGroupedResultsWithVisuals = Omit<DrugSearchGroupedResults, "groups"> & {
  groups: Array<{
    entityType: DrugSearchGroupedResults["groups"][number]["entityType"];
    count: number;
    results: Array<WithVisual<DrugSearchResult>>;
  }>;
};

export async function attachSearchGroupedVisuals(
  media: DrugEntityMediaService | null | undefined,
  result: DrugSearchGroupedResults
): Promise<DrugSearchGroupedResultsWithVisuals> {
  if (!media) return result;
  try {
    const refs = result.groups.flatMap((group) =>
      group.results.map((row) => ({
        entityType: row.entityType,
        entityId: row.canonicalTarget?.entityId ?? row.entityId,
      }))
    );
    const visuals = await media.visualsFor(refs);
    return {
      ...result,
      groups: result.groups.map((group) => ({
        ...group,
        results: group.results.map((row) => withSearchVisual(row, visuals)),
      })),
    };
  } catch (error) {
    console.error("entity media search visual attach failed", error instanceof Error ? error.name : "unknown");
    return result;
  }
}

export async function attachSearchRowVisuals(
  media: DrugEntityMediaService | null | undefined,
  rows: DrugSearchResult[]
): Promise<Array<WithVisual<DrugSearchResult>>> {
  if (!media) return rows;
  try {
    const visuals = await media.visualsFor(
      rows.map((row) => ({ entityType: row.entityType, entityId: row.canonicalTarget?.entityId ?? row.entityId }))
    );
    return rows.map((row) => withSearchVisual(row, visuals));
  } catch (error) {
    console.error("entity media search-row visual attach failed", error instanceof Error ? error.name : "unknown");
    return rows;
  }
}

export async function attachGraphNodeVisuals<T extends { id: string; type: string }>(
  media: DrugEntityMediaService | null | undefined,
  nodes: T[]
): Promise<Array<T & { visual?: DrugEntityMediaVisual | null; photoCount?: number }>> {
  if (!media) return nodes;
  try {
    const refs = nodes.map((node) => ({ entityType: node.type, entityId: node.id }));
    const [visuals, counts] = await Promise.all([media.visualsFor(refs), media.photoCountsFor(refs)]);
    return nodes.map((node) => ({
      ...node,
      visual: visuals.get(visualLookupKey(node.type, node.id)) ?? null,
      photoCount: counts.get(visualLookupKey(node.type, node.id)) ?? 0,
    }));
  } catch (error) {
    console.error("entity media graph visual attach failed", error instanceof Error ? error.name : "unknown");
    return nodes;
  }
}

function withSearchVisual(
  row: DrugSearchResult,
  visuals: Map<string, DrugEntityMediaVisual>
): WithVisual<DrugSearchResult> {
  const id = row.canonicalTarget?.entityId ?? row.entityId;
  return { ...row, visual: visuals.get(visualLookupKey(row.entityType, id)) ?? null };
}
