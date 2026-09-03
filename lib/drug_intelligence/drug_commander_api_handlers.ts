/**
 * Commander Intelligence Dashboard API handlers (Phase 2B).
 *
 * Framework-agnostic handler functions — take a DrugCommanderDashboardService
 * + URLSearchParams + Request and return a Web Response. Route handlers
 * are thin adapters that build the container and delegate here.
 *
 * All endpoints require drug.read. The "signals" endpoint is global
 * (not date-bounded) — it reads the alert table which is not filtered by
 * arrestDate.
 *
 * Same pattern as drug_intelligence_alert_api_handlers.ts.
 */

import { badRequest, jsonOk } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { resolveCommanderDashboardScope, resolveCommanderFilter, commanderInvalidDateRangeMessage } from "@/lib/drug_intelligence/drug_commander_filter";

async function authorizeAndResolve(params: URLSearchParams, actorId: string | null, request: Request) {
  if (!actorId) return { error: badRequest("actorId is required") as Response };
  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return { error: denied };
  const rangeError = commanderInvalidDateRangeMessage(params);
  if (rangeError) return { error: badRequest(rangeError) as Response };
  const requested = resolveCommanderFilter(params);
  const filter = resolveCommanderDashboardScope({ id: actorId }, requested);
  return { filter };
}

/** GET /api/drug-intelligence/command/overview */
export async function handleCommanderOverview(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  const resolved = await authorizeAndResolve(params, actorId, request);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await service.getOverview(resolved.filter!);
  return jsonOk(data, { generatedAt: data.generatedAt });
}

/** GET /api/drug-intelligence/command/seizures */
export async function handleCommanderSeizures(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  const resolved = await authorizeAndResolve(params, actorId, request);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await service.getSeizures(resolved.filter!);
  return jsonOk(data, { generatedAt: data.generatedAt });
}

/** GET /api/drug-intelligence/command/trend */
export async function handleCommanderTrend(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  const resolved = await authorizeAndResolve(params, actorId, request);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await service.getTrend(resolved.filter!);
  return jsonOk(data, { generatedAt: data.generatedAt });
}

/** GET /api/drug-intelligence/command/areas */
export async function handleCommanderAreas(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  const resolved = await authorizeAndResolve(params, actorId, request);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await service.getAreas(resolved.filter!);
  return jsonOk(data, { generatedAt: data.generatedAt });
}

/** GET /api/drug-intelligence/command/units */
export async function handleCommanderUnits(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  const resolved = await authorizeAndResolve(params, actorId, request);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await service.getUnits(resolved.filter!);
  return jsonOk(data, { generatedAt: data.generatedAt });
}

/** GET /api/drug-intelligence/command/signals — global, not date-bounded */
export async function handleCommanderSignals(
  service: DrugCommanderDashboardService,
  params: URLSearchParams,
  actorId: string | null,
  request: Request
): Promise<Response> {
  if (!actorId) return badRequest("actorId is required");
  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;

  const data = await service.getSignals();
  return jsonOk(data, { generatedAt: data.generatedAt });
}
