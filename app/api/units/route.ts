/**
 * GET /api/units — unit list with per-unit officer counts.
 */

import { getApiContainer } from "@/lib/api/api_container";
import { handleUnits, guarded } from "@/lib/api/api_handlers";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const container = await getApiContainer();
    return handleUnits(container);
  });
}
