/**
 * GET /api/ranks — rank list with per-rank officer counts.
 */

import { getApiContainer } from "@/lib/api/api_container";
import { handleRanks, guarded } from "@/lib/api/api_handlers";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const container = await getApiContainer();
    return handleRanks(container);
  });
}
