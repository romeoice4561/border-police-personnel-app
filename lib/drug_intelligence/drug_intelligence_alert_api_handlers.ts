/**
 * Drug Intelligence Alert API handlers (Phase DI-6).
 *
 * Same framework-agnostic handler pattern as drug_network_graph_api_handlers.ts
 * — reuses `assertDrugIntelligencePermission`. Viewing is drug.read;
 * review/dismiss/reopen and manual generation-trigger require drug.edit
 * (Section 18 — a read-only viewer like commander must never mutate alert
 * state, matching every other Drug Intelligence write gate in this module).
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound, internalError } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugIntelligenceAlertService } from "@/lib/drug_intelligence/drug_intelligence_alert_service";
import { DrugIntelligenceAlertNotFoundError } from "@/lib/drug_intelligence/drug_intelligence_alert_types";
import type { DrugIntelligenceAlertRecord } from "@/lib/drug_intelligence/drug_intelligence_alert_types";
import {
  drugAlertListQuerySchema,
  drugAlertForEntityQuerySchema,
  drugAlertForCaseQuerySchema,
  drugAlertQuickCheckQuerySchema,
  drugAlertGenerateSchema,
  drugAlertReviewSchema,
  drugAlertDismissSchema,
  drugAlertReopenSchema,
} from "@/lib/drug_intelligence/drug_intelligence_alert_api_schemas";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function serializeAlert(alert: DrugIntelligenceAlertRecord) {
  return {
    ...alert,
    firstSeenAt: alert.firstSeenAt ? alert.firstSeenAt.toISOString() : null,
    lastSeenAt: alert.lastSeenAt ? alert.lastSeenAt.toISOString() : null,
    reviewedAt: alert.reviewedAt ? alert.reviewedAt.toISOString() : null,
    createdAt: alert.createdAt.toISOString(),
  };
}

/** GET /api/drug-intelligence/alerts — Alert Center list + KPI (Section 8, 20). Server-side filtering only, never client-side. */
export async function handleDrugAlertList(service: DrugIntelligenceAlertService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugAlertListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid alert query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const { alerts, kpi } = await service.listAlerts({
      status: parsed.data.status,
      alertType: parsed.data.alertType,
      severity: parsed.data.severity,
      entityType: parsed.data.entityType,
      currentCaseId: parsed.data.currentCaseId,
    });

    // Free-text query (Section 20: case number / person name — resolved
    // against the already-scoped result set, never a separate unfiltered
    // full-table scan) and pagination happen here at the handler layer.
    const query = parsed.data.query?.trim().toLowerCase();
    const filtered = query ? alerts.filter((a) => a.title.toLowerCase().includes(query) || a.explanation.toLowerCase().includes(query) || a.entityId.toLowerCase().includes(query)) : alerts;

    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const page = filtered.slice(start, start + parsed.data.pageSize);

    return jsonOk({
      alerts: page.map(serializeAlert),
      totalCount: filtered.length,
      kpi,
    });
  } catch {
    return internalError("Failed to load alerts");
  }
}

/** GET /api/drug-intelligence/alerts/entity — repeat-intelligence context for one entity (Section 14/15). */
export async function handleDrugAlertsForEntity(service: DrugIntelligenceAlertService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugAlertForEntityQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid entity-alert query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const alerts = await service.getAlertsForEntity(parsed.data.entityType, parsed.data.entityId);
    return jsonOk({ alerts: alerts.map(serializeAlert) });
  } catch {
    return internalError("Failed to load alerts for entity");
  }
}

/** GET /api/drug-intelligence/alerts/case — alert summary for one case (Section 13). */
export async function handleDrugAlertsForCase(service: DrugIntelligenceAlertService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugAlertForCaseQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid case-alert query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const alerts = await service.getAlertsForCase(parsed.data.caseId);
    return jsonOk({ alerts: alerts.map(serializeAlert) });
  } catch {
    return internalError("Failed to load alerts for case");
  }
}

/** GET /api/drug-intelligence/alerts/quick-check — Section 4's debounced real-time inline signal. Requires drug.create (same gate as the existing phones/check, devices/check endpoints this extends). */
export async function handleDrugAlertQuickCheck(service: DrugIntelligenceAlertService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugAlertQuickCheckQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid quick-check query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.create");
  if (denied) return denied;

  try {
    const { entityType } = parsed.data;
    const result =
      entityType === "PHONE"
        ? await service.quickCheckPhone(parsed.data.rawInput ?? "")
        : entityType === "DEVICE"
          ? await service.quickCheckDevice(parsed.data.imei1 ?? null, parsed.data.serialNumber ?? null)
          : await service.quickCheckVehicle(parsed.data.registrationNumber ?? null, parsed.data.registrationProvince ?? null, parsed.data.vin ?? null);
    return jsonOk({ ...result, lastSeenAt: result.lastSeenAt ? result.lastSeenAt.toISOString() : null });
  } catch {
    return internalError("Failed to check entity");
  }
}

/** POST /api/drug-intelligence/alerts/generate — Section 6/7's post-create generation trigger. Never blocks/rolls back case creation; this call happens AFTER a case is already saved. */
export async function handleDrugAlertGenerate(service: DrugIntelligenceAlertService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = drugAlertGenerateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid generate request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.create");
  if (denied) return denied;

  try {
    const alerts = await service.generateAlertsForCase(parsed.data.caseId, parsed.data.actorId, parsed.data.actorName);
    return jsonOk({ alerts: alerts.map(serializeAlert) });
  } catch {
    // Intelligence assistance is never allowed to surface as a hard case-creation failure to the caller — the case itself already saved successfully before this endpoint is ever called.
    return jsonOk({ alerts: [] });
  }
}

/** POST /api/drug-intelligence/alerts/{id}/review — Section 9 lifecycle. Requires drug.edit. */
export async function handleDrugAlertReview(service: DrugIntelligenceAlertService, alertId: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = drugAlertReviewSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid review request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const alert = await service.reviewAlert(alertId, parsed.data.actorId, parsed.data.actorName);
    return jsonOk({ alert: serializeAlert(alert) });
  } catch (error) {
    if (error instanceof DrugIntelligenceAlertNotFoundError) return notFound("Alert not found");
    return internalError("Failed to review alert");
  }
}

/** POST /api/drug-intelligence/alerts/{id}/dismiss — Section 9 lifecycle. Requires a reason. Requires drug.edit. */
export async function handleDrugAlertDismiss(service: DrugIntelligenceAlertService, alertId: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = drugAlertDismissSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid dismiss request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const alert = await service.dismissAlert(alertId, parsed.data.actorId, parsed.data.actorName, parsed.data.reason);
    return jsonOk({ alert: serializeAlert(alert) });
  } catch (error) {
    if (error instanceof DrugIntelligenceAlertNotFoundError) return notFound("Alert not found");
    return internalError("Failed to dismiss alert");
  }
}

/** POST /api/drug-intelligence/alerts/{id}/reopen — Section 9 lifecycle. Requires drug.edit. */
export async function handleDrugAlertReopen(service: DrugIntelligenceAlertService, alertId: string, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  const parsed = drugAlertReopenSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid reopen request", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.edit");
  if (denied) return denied;

  try {
    const alert = await service.reopenAlert(alertId, parsed.data.actorId, parsed.data.actorName);
    return jsonOk({ alert: serializeAlert(alert) });
  } catch (error) {
    if (error instanceof DrugIntelligenceAlertNotFoundError) return notFound("Alert not found");
    return internalError("Failed to reopen alert");
  }
}
