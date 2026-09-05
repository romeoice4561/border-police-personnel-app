/**
 * DI-10B export size ceilings. Export code must never use MAX_SAFE_INTEGER.
 */

import { DRUG_GRAPH_HARD_MAX_NODES, DRUG_GRAPH_PATH_MAX_DEPTH } from "@/lib/drug_intelligence/drug_network_graph_types";
import { DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES } from "@/lib/drug_intelligence/drug_investigation_board_state";

export const DRUG_EXPORT_OPERATIONAL_SOFT_LIMIT = 2_000;
export const DRUG_EXPORT_OPERATIONAL_HARD_LIMIT = 5_000;
export const DRUG_EXPORT_MAP_SOFT_LIMIT = 2_000;
export const DRUG_EXPORT_MAP_HARD_LIMIT = 5_000;
export const DRUG_EXPORT_NETWORK_HARD_MAX_NODES = DRUG_GRAPH_HARD_MAX_NODES;
export const DRUG_EXPORT_NETWORK_MAX_DEPTH = DRUG_GRAPH_PATH_MAX_DEPTH;
export const DRUG_EXPORT_BOARD_STATE_MAX_BYTES = DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES;

export function exportLimitsForType(exportType: string): { softLimit: number; hardLimit: number } {
  if (exportType === "MAP_DATA") {
    return { softLimit: DRUG_EXPORT_MAP_SOFT_LIMIT, hardLimit: DRUG_EXPORT_MAP_HARD_LIMIT };
  }
  if (exportType === "NETWORK_DATA") {
    return { softLimit: DRUG_EXPORT_NETWORK_HARD_MAX_NODES, hardLimit: DRUG_EXPORT_NETWORK_HARD_MAX_NODES };
  }
  return { softLimit: DRUG_EXPORT_OPERATIONAL_SOFT_LIMIT, hardLimit: DRUG_EXPORT_OPERATIONAL_HARD_LIMIT };
}
