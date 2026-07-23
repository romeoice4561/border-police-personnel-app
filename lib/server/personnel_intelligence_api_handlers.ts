/**
 * Shared handlers for /api/intelligence/* (Phase 49.5).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import { searchParamsToObject } from "@/lib/api/api_schemas";
import {
  httpStatusForIntelligenceError,
  isPersonnelIntelligenceError,
} from "@/lib/personnel_intelligence_service/errors";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { resolveIntelligenceActor } from "@/lib/server/personnel_intelligence_api_auth";
import { createPersonnelIntelligenceServiceForRequest } from "@/lib/server/personnel_intelligence_service";

function metaFor(asOfIso: string, extra: Record<string, unknown> = {}) {
  const fy = computeFiscalYearSummary(new Date(asOfIso));
  return {
    asOf: asOfIso,
    fiscalYearBe: fy.fiscalYearBe,
    ...extra,
  };
}

function mapError(error: unknown): Response {
  if (isPersonnelIntelligenceError(error)) {
    const status = httpStatusForIntelligenceError(error.code);
    if (error.code === "INVALID_QUERY") return badRequest(error.message, error.details);
    if (error.code === "OFFICER_NOT_FOUND") return notFound(error.message);
    return jsonError(error.code, error.message, status, error.details);
  }
  console.error("[personnel-intelligence] unhandled", error instanceof Error ? error.message : error);
  return jsonError("INTERNAL_ERROR", "Internal server error", 500);
}

export async function handleIntelligenceSummary(request: NextRequest): Promise<Response> {
  try {
    const resolved = await resolveIntelligenceActor(request);
    if (!resolved.ok) return resolved.response;
    const { service, asOfIso, contextId } = await createPersonnelIntelligenceServiceForRequest({
      actor: resolved.actor,
    });
    const raw = searchParamsToObject(request.nextUrl.searchParams);
    const data = service.getCommanderSummary(raw);
    return jsonOk(data, metaFor(asOfIso, { contextId, operation: "getCommanderSummary" }));
  } catch (error) {
    return mapError(error);
  }
}

export async function handleIntelligenceOfficers(request: NextRequest): Promise<Response> {
  try {
    const resolved = await resolveIntelligenceActor(request);
    if (!resolved.ok) return resolved.response;
    const { service, asOfIso, contextId } = await createPersonnelIntelligenceServiceForRequest({
      actor: resolved.actor,
    });
    const raw = searchParamsToObject(request.nextUrl.searchParams);
    const data = service.searchOfficers(raw);
    return jsonOk(data, metaFor(asOfIso, { contextId, operation: "searchOfficers", total: data.pagination.total }));
  } catch (error) {
    return mapError(error);
  }
}

export async function handleIntelligenceOfficerDetail(
  request: NextRequest,
  officerId: string
): Promise<Response> {
  try {
    const resolved = await resolveIntelligenceActor(request);
    if (!resolved.ok) return resolved.response;
    const { service, asOfIso, contextId } = await createPersonnelIntelligenceServiceForRequest({
      actor: resolved.actor,
    });
    const data = service.getOfficerIntelligence(decodeURIComponent(officerId));
    return jsonOk(data, metaFor(asOfIso, { contextId, operation: "getOfficerIntelligence" }));
  } catch (error) {
    return mapError(error);
  }
}
