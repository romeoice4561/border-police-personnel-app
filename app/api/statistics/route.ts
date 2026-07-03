/**
 * GET /api/statistics — aggregate metrics (totals, averages, regions/units/
 * timelines counts, duplicate phone/name counts).
 */

import { getApiContainer } from "@/lib/api/api_container";
import { handleStatistics, guarded } from "@/lib/api/api_handlers";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const container = await getApiContainer();
    return handleStatistics(container);
  });
}
