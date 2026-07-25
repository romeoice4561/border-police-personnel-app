/**
 * Loads CommanderQueryDataset once per request.
 * Does not mutate canonical officer records.
 */
import "server-only";

import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";
import { DatabaseConfigError } from "@/lib/database/database";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";

export type DatasetLoader = () => Promise<CommanderQueryDataset>;
export { applyOrganizationFilter } from "@/lib/personnel_search_api/organization_filter";

const defaultLoader: DatasetLoader = () => getCommanderQueryDataset();

export async function loadPersonnelSearchDataset(
  loader: DatasetLoader = defaultLoader
): Promise<CommanderQueryDataset> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      throw new PersonnelSearchApiError("SEARCH_UNAVAILABLE", "Search service unavailable", 503);
    }
    throw error;
  }
}
