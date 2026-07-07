/**
 * Shared API handler logic (Phase 13).
 *
 * The framework-agnostic core of each endpoint: functions that take an
 * ApiContainer + already-parsed inputs (or raw URLSearchParams) and return a
 * Web Response. Route handlers under app/api/ are thin adapters that build the
 * container and delegate here. Keeping the logic here (not in route.ts) makes
 * every endpoint unit-testable with a fake container and no running server.
 *
 * Zod validation and the consistent error envelope live here; database access
 * goes exclusively through the injected query repositories (no SQL).
 */

import { z } from "zod";
import type { ApiContainer } from "@/lib/api/api_container";
import { badRequest, internalError, jsonError, jsonOk, notFound, serviceUnavailable } from "@/lib/api/api_response";
import { DatabaseConfigError } from "@/lib/database/database";
import { resolveEnvironment } from "@/lib/config/env_validation";
import {
  officerIdParamSchema,
  officerListQuerySchema,
  officerSearchQuerySchema,
  searchParamsToObject,
} from "@/lib/api/api_schemas";

/** Package version for /health, read from package.json without hardcoding. */
async function appVersion(): Promise<string> {
  try {
    const pkg = (await import("@/package.json")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Formats a Zod error into the response `details` shape. */
function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * A container source: either an already-built ApiContainer, or a factory to
 * build one. Route handlers pass the (async, DB-touching) factory so that
 * request VALIDATION runs BEFORE any database client is created — an invalid
 * request returns 400 without ever touching (or requiring) the database.
 */
export type ContainerSource = ApiContainer | (() => Promise<ApiContainer>);

async function resolveContainer(source: ContainerSource): Promise<ApiContainer> {
  return typeof source === "function" ? source() : source;
}

/** GET /api/officers — paginated/filtered/sorted list. */
export async function handleOfficerList(source: ContainerSource, params: URLSearchParams): Promise<Response> {
  const parsed = officerListQuerySchema.safeParse(searchParamsToObject(params));
  if (!parsed.success) return badRequest("Invalid query parameters", zodDetails(parsed.error));

  const container = await resolveContainer(source);
  const result = await container.officers.list(parsed.data);

  return jsonOk(result.data, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}

/** GET /api/search — multi-field search with match modes. */
export async function handleOfficerSearch(source: ContainerSource, params: URLSearchParams): Promise<Response> {
  const parsed = officerSearchQuerySchema.safeParse(searchParamsToObject(params));
  if (!parsed.success) return badRequest("Invalid search parameters", zodDetails(parsed.error));

  const container = await resolveContainer(source);
  const result = await container.officers.search(parsed.data);

  return jsonOk(result.data, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
    match: parsed.data.match,
  });
}

/** GET /api/officers/{id} — full profile with timeline + quality/knowledge scores. */
export async function handleOfficerById(source: ContainerSource, rawId: string): Promise<Response> {
  const parsed = officerIdParamSchema.safeParse({ id: rawId });
  if (!parsed.success) return badRequest("Invalid officer id", zodDetails(parsed.error));

  const container = await resolveContainer(source);
  const officer = await container.officers.findByOfficerId(parsed.data.id);
  if (!officer) return notFound(`Officer '${parsed.data.id}' not found`);

  return jsonOk({
    officer: {
      id: officer.officerId,
      rank: officer.rank,
      firstName: officer.firstName,
      lastName: officer.lastName,
      currentPosition: officer.currentPosition,
      currentUnit: officer.currentUnit,
      phone: officer.phone,
      careerYears: officer.careerYears,
      region: officer.region,
      confidence: officer.confidence,
    },
    // Phase 20C: Organization master-data links (nullable helper references —
    // additive; `officer.region`/`currentUnit`/timeline text above remain authoritative).
    organization: {
      regionId: officer.regionId,
      battalionId: officer.battalionId,
      companyId: officer.companyId,
    },
    // Phase 17B: Drive photo identity (nullable — UI falls back to placeholder).
    photo: {
      driveFileId: officer.driveFileId,
      thumbnailUrl: officer.thumbnailUrl,
      webViewUrl: officer.webViewUrl,
    },
    // Phase 23A: additional contact channels (nullable, additive).
    contact: {
      email: officer.email,
      lineId: officer.lineId,
      facebookUrl: officer.facebookUrl,
    },
    timeline: officer.timeline
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((t) => ({
        sequence: t.sequence,
        year: t.year,
        yearValue: t.yearValue,
        position: t.position,
        unit: t.unit,
        // Phase 23A: per-row rank + provenance/verification (additive).
        rank: t.rank,
        source: t.source,
        verified: t.verified,
      })),
    phones: officer.phones.map((p) => p.number),
    // Phase 23A: education/training rows (additive).
    education: officer.education.map((e) => ({ id: e.id, year: e.year, institution: e.institution, degree: e.degree, notes: e.notes })),
    training: officer.training.map((t) => ({ id: t.id, year: t.year, course: t.course, organization: t.organization, notes: t.notes })),
    quality: { qualityScore: officer.qualityScore, knowledgeScore: officer.knowledgeScore },
  });
}

/** GET /api/units — unit list with officer counts. */
export async function handleUnits(container: ApiContainer): Promise<Response> {
  const units = await container.units.listWithCounts();
  return jsonOk(units, { total: units.length });
}

/** GET /api/ranks — rank list with officer counts. */
export async function handleRanks(container: ApiContainer): Promise<Response> {
  const ranks = await container.ranks.listWithCounts();
  return jsonOk(ranks, { total: ranks.length });
}

/** GET /api/statistics — aggregate metrics. */
export async function handleStatistics(container: ApiContainer): Promise<Response> {
  const stats = await container.statistics.compute();
  return jsonOk(stats);
}

/** GET /api/health — liveness + database reachability. */
export async function handleHealth(container: ApiContainer): Promise<Response> {
  const version = await appVersion();
  const timestamp = new Date().toISOString();
  const environment = resolveEnvironment();
  // Process uptime in whole seconds — how long this server instance has run.
  const uptime = Math.round(typeof process !== "undefined" ? process.uptime() : 0);

  try {
    await container.statistics.ping();
    return jsonOk({ status: "ok", database: "connected", version, uptime, environment, timestamp });
  } catch {
    // Degraded (not down): the server is up but its database dependency is
    // unreachable. Still 503 so probes fail, but the body carries the full
    // status shape (status/database/version/uptime/environment/timestamp).
    return jsonError(
      "SERVICE_UNAVAILABLE",
      "Database unavailable",
      503,
      { status: "degraded", database: "disconnected", version, uptime, environment, timestamp }
    );
  }
}

/**
 * Wraps a handler so failures become consistent responses (internal details
 * never leaked): a database configuration/connectivity failure is a 503
 * (the service can't reach its dependency), anything else a 500.
 */
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    // Temporary diagnostics (Phase 22A-FIX): the response body never leaks
    // these details (still a generic 503/500 below) — this only writes to
    // the server log so a real failure is no longer silent.
    console.error(error);
    console.error((error as { message?: unknown })?.message);
    console.error((error as { stack?: unknown })?.stack);
    if (error && typeof error === "object" && "code" in error) {
      console.error((error as { code: unknown }).code);
    }
    if (error && typeof error === "object" && "meta" in error) {
      console.error((error as { meta: unknown }).meta);
    }

    if (error instanceof DatabaseConfigError || isConnectionError(error)) {
      return serviceUnavailable("Database unavailable");
    }
    return internalError();
  }
}

/** Heuristic for a DB connection failure (pg/Prisma) so it maps to 503, not 500. */
function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|connection|Can't reach database/i.test(message);
}
