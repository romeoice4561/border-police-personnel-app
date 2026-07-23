/**
 * Server adapter for governed intelligence tool execution (Phase 49.6).
 *
 * Authenticates via Phase 49.5 conventions, builds one request-scoped
 * PersonnelIntelligenceService, then calls executeIntelligenceTool().
 *
 * No generic public /api/intelligence/tools/execute route — internal use only.
 */
import "server-only";

import type { NextRequest } from "next/server";
import { resolveIntelligenceActor } from "@/lib/server/personnel_intelligence_api_auth";
import { createPersonnelIntelligenceServiceForRequest } from "@/lib/server/personnel_intelligence_service";
import {
  createConsoleIntelligenceToolAuditSink,
  executeIntelligenceTool,
  type IntelligenceToolExecutionResult,
  type IntelligenceToolName,
} from "@/lib/personnel_intelligence_service/tools/index";
import type { IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";

export interface ExecuteIntelligenceToolForRequestInput {
  /** When provided, authenticates via Phase 49.5 cookie + Basic Auth. */
  request?: NextRequest;
  /** Trusted actor — required when `request` is omitted (tests / internal). */
  actor?: IntelligenceActor;
  toolName: IntelligenceToolName | string;
  input?: unknown;
  requestId?: string;
}

export interface ExecuteIntelligenceToolForRequestResult {
  result: IntelligenceToolExecutionResult;
  contextId: string;
  asOfIso: string;
}

function unauthenticatedResult(requestId?: string): IntelligenceToolExecutionResult {
  return {
    ok: false,
    error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    meta: {
      requestId: requestId ?? "missing",
      executedAt: new Date().toISOString(),
      durationMs: 0,
    },
  };
}

/**
 * Authenticate (optional NextRequest) → one service context → execute tool.
 * Dataset is loaded exactly once for the request.
 */
export async function executeIntelligenceToolForRequest(
  deps: ExecuteIntelligenceToolForRequestInput
): Promise<ExecuteIntelligenceToolForRequestResult> {
  let actor = deps.actor;
  if (!actor) {
    if (!deps.request) {
      return { result: unauthenticatedResult(deps.requestId), contextId: "", asOfIso: "" };
    }
    const resolved = await resolveIntelligenceActor(deps.request);
    if (!resolved.ok) {
      return { result: unauthenticatedResult(deps.requestId), contextId: "", asOfIso: "" };
    }
    actor = resolved.actor;
  }

  const bundle = await createPersonnelIntelligenceServiceForRequest({ actor });
  const result = await executeIntelligenceTool({
    toolName: deps.toolName,
    input: deps.input ?? {},
    actor,
    requestId: deps.requestId,
    service: bundle.service,
    serviceContext: bundle.context,
    auditSink: createConsoleIntelligenceToolAuditSink(),
  });

  return {
    result,
    contextId: bundle.contextId,
    asOfIso: bundle.asOfIso,
  };
}
