/**
 * Core handler for POST /api/personnel-search (Phase 51.1).
 * Thin orchestration — domain logic stays in lib/personnel_search.
 *
 * Default loaders (auth / dataset / enrichment) are dynamically imported so
 * unit tests can inject fakes without pulling `server-only` modules.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { searchPersonnel } from "@/lib/personnel_search/gateway";
import { resolveSearchIntent } from "@/lib/personnel_search/intent";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import type { PersonnelSearchActor } from "@/lib/personnel_search_api/authentication";
import {
  createConsolePersonnelSearchAuditSink,
  hashQueryForAudit,
  recordPersonnelSearchAudit,
  type PersonnelSearchAuditOutcome,
  type PersonnelSearchAuditSink,
} from "@/lib/personnel_search_api/audit";
import {
  actorCanUsePersonnelSearchApi,
  buildExecutionContext,
  resolveEffectiveUnitFilter,
} from "@/lib/personnel_search_api/context";
import type { OrgTree } from "@/lib/organization/org_tree";
import { buildOrgEntityCatalog } from "@/lib/personnel_entities/organization";
import type { DatasetLoader } from "@/lib/personnel_search_api/dataset_adapter";
import type { EnrichmentLoader } from "@/lib/personnel_search_api/enrichment_adapter";
import type { OrganizationTreeLoader } from "@/lib/personnel_search_api/organization_adapter";
import { applyOrganizationFilter } from "@/lib/personnel_search_api/organization_filter";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";
import {
  buildSearchFingerprint,
  decodeCursor,
  nextCursorForPage,
} from "@/lib/personnel_search_api/pagination";
import {
  allowAllPersonnelSearchRateLimiter,
  type PersonnelSearchRateLimiter,
} from "@/lib/personnel_search_api/rate_limit";
import { sanitizePersonnelSearchResult } from "@/lib/personnel_search_api/sanitize";
import { mapApiClientToGatewayClient, validatePersonnelSearchApiBody } from "@/lib/personnel_search_api/validation";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export interface PersonnelSearchHandlerDeps {
  resolveActor?: (request: NextRequest) => Promise<PersonnelSearchActor>;
  loadDataset?: DatasetLoader;
  loadEnrichment?: EnrichmentLoader;
  loadOrganizationTree?: OrganizationTreeLoader;
  auditSink?: PersonnelSearchAuditSink;
  rateLimiter?: PersonnelSearchRateLimiter;
  now?: () => Date;
}

function jsonResponse(body: PersonnelSearchApiResponse, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(requestId: string, error: PersonnelSearchApiError): Response {
  return jsonResponse(
    {
      ok: false,
      requestId,
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
      },
    },
    error.httpStatus
  );
}

async function defaultResolveActor(request: NextRequest): Promise<PersonnelSearchActor> {
  const { resolvePersonnelSearchActor } = await import("@/lib/personnel_search_api/authentication");
  return resolvePersonnelSearchActor(request);
}

async function defaultLoadDataset() {
  const { loadPersonnelSearchDataset } = await import("@/lib/personnel_search_api/dataset_adapter");
  return loadPersonnelSearchDataset();
}

async function defaultLoadEnrichment() {
  const { loadPersonnelSearchEnrichment } = await import("@/lib/personnel_search_api/enrichment_adapter");
  return loadPersonnelSearchEnrichment();
}

async function defaultLoadOrganizationTree(): Promise<OrgTree> {
  const { loadPersonnelSearchOrganizationTree } = await import(
    "@/lib/personnel_search_api/organization_adapter"
  );
  return loadPersonnelSearchOrganizationTree();
}

export async function handlePersonnelSearchRequest(
  request: NextRequest,
  deps: PersonnelSearchHandlerDeps = {}
): Promise<Response> {
  const requestId = randomUUID();
  const requestedAt = (deps.now?.() ?? new Date()).toISOString();
  const started = Date.now();
  const auditSink = deps.auditSink ?? createConsolePersonnelSearchAuditSink();
  const rateLimiter = deps.rateLimiter ?? allowAllPersonnelSearchRateLimiter;

  let outcome: PersonnelSearchAuditOutcome = "error";
  let actorUserId = "anonymous";
  let actorOfficerId: string | undefined;
  let role = "unknown";
  let client: ReturnType<typeof mapApiClientToGatewayClient> = "web";
  let disclosureLevel: 1 | 2 | 3 = 1;
  let queryCategory: ReturnType<typeof resolveSearchIntent>["intent"] | "UNKNOWN" = "UNKNOWN";
  let resultCount = 0;
  let scopeSummary = { unrestricted: false as boolean };
  let queryHash: string | undefined;

  try {
    if (request.method !== "POST") {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Method not allowed", 405);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Content-Type must be application/json", 415);
    }

    const actor = await (deps.resolveActor ?? defaultResolveActor)(request);
    actorUserId = actor.id;
    actorOfficerId = actor.officerId ?? undefined;
    role = actor.role;

    if (!actorCanUsePersonnelSearchApi(actor)) {
      outcome = "forbidden";
      throw new PersonnelSearchApiError("FORBIDDEN", "Not allowed to use personnel search", 403);
    }

    const rate = await rateLimiter.check(`personnel-search:${actor.id}`);
    if (!rate.allowed) {
      throw new PersonnelSearchApiError("RATE_LIMITED", "Too many requests", 429);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "Malformed JSON body", 400);
    }

    // Never trust client-supplied identity / role / permissions.
    if (rawBody && typeof rawBody === "object") {
      const body = rawBody as Record<string, unknown>;
      delete body.role;
      delete body.permissions;
      delete body.officerId;
      delete body.userId;
      delete body.subjectOfficerId;
    }

    const validated = validatePersonnelSearchApiBody(rawBody);
    client = mapApiClientToGatewayClient(validated.client);
    disclosureLevel = validated.disclosureLevel;
    queryHash = hashQueryForAudit(validated.query);

    const execution = buildExecutionContext(actor, requestId, requestedAt);
    const organizationTree = await (deps.loadOrganizationTree ?? defaultLoadOrganizationTree)();
    const catalog = buildOrgEntityCatalog(organizationTree);
    const unitFilter = resolveEffectiveUnitFilter(
      execution.organizationScope,
      validated.unitScope,
      catalog
    );
    scopeSummary = {
      unrestricted: execution.organizationScope.unrestricted,
      ...unitFilter,
    };

    const fingerprint = buildSearchFingerprint({
      query: validated.query,
      disclosureLevel: validated.disclosureLevel,
      userId: actor.id,
      ...unitFilter,
    });
    const offset = validated.cursor ? decodeCursor(validated.cursor, fingerprint) : 0;

    const dataset = await (deps.loadDataset ?? defaultLoadDataset)();
    const scoped = applyOrganizationFilter(dataset, unitFilter);
    const enrichment = await (deps.loadEnrichment ?? defaultLoadEnrichment)();

    // intentHint is advisory metadata only — gateway resolves intent from query.
    void validated.intentHint;

    const gatewayResult = searchPersonnel(
      {
        query: validated.query,
        client,
        permissions: actor.permissions,
        role: actor.role,
        subjectOfficerId: actor.officerId,
        disclosureLevel: validated.disclosureLevel,
        limit: validated.limit,
        offset,
        nowIso: requestedAt,
      },
      {
        dataset: scoped,
        enrichmentByOfficerId: enrichment,
        organizationTree,
      }
    );

    queryCategory = gatewayResult.intent;
    resultCount = gatewayResult.items.length;

    const suppressNext =
      gatewayResult.resultType === "person_disambiguation" && offset === 0 && gatewayResult.clarification != null;

    const nextCursor = nextCursorForPage({
      offset,
      limit: validated.limit,
      totalCount: gatewayResult.totalCount,
      fingerprint,
      suppress: suppressNext || gatewayResult.resultType === "unit_summary" || gatewayResult.resultType === "person",
    });

    const sanitized = sanitizePersonnelSearchResult(gatewayResult);
    outcome = gatewayResult.resultType === "error" ? "forbidden" : "success";

    const body: PersonnelSearchApiResponse = {
      ok: true,
      requestId,
      result: sanitized,
      meta: {
        generatedAt: new Date().toISOString(),
        client,
        disclosureLevel: validated.disclosureLevel,
        nextCursor,
        resultCount: sanitized.items.length,
        totalCount: sanitized.totalCount,
      },
    };

    await recordPersonnelSearchAudit(auditSink, {
      requestId,
      actorUserId,
      actorOfficerId,
      role,
      client,
      queryCategory,
      normalizedQueryHash: queryHash,
      organizationScope: scopeSummary,
      disclosureLevel,
      resultCount,
      outcome,
      requestedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    });

    return jsonResponse(body, 200);
  } catch (error) {
    if (error instanceof PersonnelSearchApiError) {
      if (error.code === "FORBIDDEN" || error.code === "OUT_OF_SCOPE") outcome = "forbidden";
      else if (
        error.code === "INVALID_REQUEST" ||
        error.code === "QUERY_TOO_LONG" ||
        error.code === "INVALID_DISCLOSURE_LEVEL"
      ) {
        outcome = "invalid";
      } else if (error.code === "UNAUTHENTICATED") {
        outcome = "forbidden";
      } else {
        outcome = "error";
      }

      await recordPersonnelSearchAudit(auditSink, {
        requestId,
        actorUserId,
        actorOfficerId,
        role,
        client,
        queryCategory,
        normalizedQueryHash: queryHash,
        organizationScope: scopeSummary,
        disclosureLevel,
        resultCount,
        outcome,
        requestedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      });

      return errorResponse(requestId, error);
    }

    console.error("[personnel-search-api] unhandled", error instanceof Error ? error.message : "error");
    await recordPersonnelSearchAudit(auditSink, {
      requestId,
      actorUserId,
      actorOfficerId,
      role,
      client,
      queryCategory,
      normalizedQueryHash: queryHash,
      organizationScope: scopeSummary,
      disclosureLevel,
      resultCount,
      outcome: "error",
      requestedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    });

    return errorResponse(
      requestId,
      new PersonnelSearchApiError("INTERNAL_ERROR", "Internal server error", 500)
    );
  }
}
