/**
 * Drug Intelligence Entity Detail API handlers (Phase DI-3, Sections 12-16).
 * Same framework-agnostic pattern as every other DI handler file. All 4
 * require drug.read — viewing an entity's detail is no more sensitive than
 * viewing it inside a Person Profile or Case Workspace already is.
 */

import { jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugEntityDetailService } from "@/lib/drug_intelligence/drug_entity_detail_service";
import {
  DrugPhoneNotFoundError,
  DrugSimNotFoundError,
  DrugDeviceNotFoundError,
  DrugVehicleNotFoundError,
} from "@/lib/drug_intelligence/drug_entity_detail_service";

async function requireActorAndPermission(searchParams: URLSearchParams, request: Request): Promise<Response | { actorId: string }> {
  const actorId = searchParams.get("actorId");
  if (!actorId) return jsonError("BAD_REQUEST", "actorId query parameter is required", 400);
  const denied = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (denied) return denied;
  return { actorId };
}

/** GET /api/drug-intelligence/phones/{id} — Section 13's Phone detail. */
export async function handleDrugPhoneDetail(service: DrugEntityDetailService, phoneNumberId: string, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const auth = await requireActorAndPermission(searchParams, request);
  if (auth instanceof Response) return auth;

  try {
    return jsonOk(await service.getPhoneDetail(phoneNumberId));
  } catch (error) {
    if (error instanceof DrugPhoneNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/sims/{id} — Section 14's SIM detail. */
export async function handleDrugSimDetail(service: DrugEntityDetailService, simId: string, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const auth = await requireActorAndPermission(searchParams, request);
  if (auth instanceof Response) return auth;

  try {
    return jsonOk(await service.getSimDetail(simId));
  } catch (error) {
    if (error instanceof DrugSimNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/devices/{id} — Section 15's Device detail. */
export async function handleDrugDeviceDetail(service: DrugEntityDetailService, deviceId: string, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const auth = await requireActorAndPermission(searchParams, request);
  if (auth instanceof Response) return auth;

  try {
    return jsonOk(await service.getDeviceDetail(deviceId));
  } catch (error) {
    if (error instanceof DrugDeviceNotFoundError) return notFound(error.message);
    throw error;
  }
}

/** GET /api/drug-intelligence/vehicles/{id} — Section 16's Vehicle detail. */
export async function handleDrugVehicleDetail(service: DrugEntityDetailService, vehicleId: string, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const auth = await requireActorAndPermission(searchParams, request);
  if (auth instanceof Response) return auth;

  try {
    return jsonOk(await service.getVehicleDetail(vehicleId));
  } catch (error) {
    if (error instanceof DrugVehicleNotFoundError) return notFound(error.message);
    throw error;
  }
}
