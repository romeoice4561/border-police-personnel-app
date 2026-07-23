/**
 * Canonical executeIntelligenceTool() — sole future AI/tool execution path (Phase 49.6).
 */
import { isPersonnelIntelligenceError } from "@/lib/personnel_intelligence_service/errors";
import { createPersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";
import type { PersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";
import type { PersonnelIntelligenceServiceContext } from "@/lib/personnel_intelligence_service/context";
import { recordIntelligenceToolAudit } from "@/lib/personnel_intelligence_service/tools/audit";
import { IntelligenceToolError, isIntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import { assertCanExecuteIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/permission_resolver";
import { assertSafeIntelligenceToolOutput } from "@/lib/personnel_intelligence_service/tools/output_validator";
import { deriveIntelligenceToolResultCount } from "@/lib/personnel_intelligence_service/tools/result_count";
import {
  getIntelligenceToolDefinition,
  hasIntelligenceTool,
} from "@/lib/personnel_intelligence_service/tools/registry";
import {
  resolveIntelligenceToolScope,
  summarizeScope,
} from "@/lib/personnel_intelligence_service/tools/scope_resolver";
import { validateIntelligenceToolInput } from "@/lib/personnel_intelligence_service/tools/validator";
import type {
  IntelligenceToolCapability,
  IntelligenceToolExecutionRequest,
  IntelligenceToolExecutionResult,
  IntelligenceToolName,
} from "@/lib/personnel_intelligence_service/tools/types";

let requestSeq = 0;

function newRequestId(): string {
  requestSeq += 1;
  return `tool-req-${requestSeq}-${Date.now()}`;
}

function mapServiceError(error: unknown): IntelligenceToolError {
  if (isIntelligenceToolError(error)) return error;
  if (isPersonnelIntelligenceError(error)) {
    switch (error.code) {
      case "UNAUTHENTICATED":
        return new IntelligenceToolError("UNAUTHENTICATED", error.message);
      case "FORBIDDEN":
        return new IntelligenceToolError("FORBIDDEN", error.message);
      case "INVALID_SCOPE":
        return new IntelligenceToolError("INVALID_SCOPE", error.message);
      case "OFFICER_NOT_FOUND":
        return new IntelligenceToolError("OFFICER_NOT_FOUND", error.message);
      case "DATA_UNAVAILABLE":
        return new IntelligenceToolError("DATA_UNAVAILABLE", error.message);
      case "INVALID_QUERY":
        return new IntelligenceToolError("INVALID_TOOL_INPUT", error.message);
      default:
        return new IntelligenceToolError("TOOL_EXECUTION_FAILED", "Tool execution failed");
    }
  }
  return new IntelligenceToolError("TOOL_EXECUTION_FAILED", "Tool execution failed");
}

function resolveService(
  request: IntelligenceToolExecutionRequest
): { service: PersonnelIntelligenceService; context: PersonnelIntelligenceServiceContext } {
  if (request.service && request.serviceContext) {
    return { service: request.service, context: request.serviceContext };
  }
  if (request.serviceContext) {
    return {
      service: createPersonnelIntelligenceService(request.serviceContext),
      context: request.serviceContext,
    };
  }
  throw new IntelligenceToolError(
    "INTERNAL_ERROR",
    "Request-scoped PersonnelIntelligenceService or context is required"
  );
}

/**
 * Executes a registered intelligence tool through PersonnelIntelligenceService.
 *
 * Order: resolve tool → validate actor → validate input → authorize →
 * enforce scope → obtain service → handler → validate output → audit → result.
 */
export async function executeIntelligenceTool(
  request: IntelligenceToolExecutionRequest
): Promise<IntelligenceToolExecutionResult> {
  const startedAt = new Date();
  const requestId = request.requestId?.trim() || newRequestId();
  let toolName: string = String(request.toolName ?? "");
  let toolVersion = "";
  let contextId: string | undefined;
  let capability: IntelligenceToolCapability | "unknown" = "unknown";
  let scopeSummary = "n/a";
  let resultCount: number | undefined;

  const finishFailure = async (
    code: IntelligenceToolError["code"],
    message: string
  ): Promise<IntelligenceToolExecutionResult> => {
    const completedAt = new Date();
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
    await recordIntelligenceToolAudit(request.auditSink, {
      requestId,
      contextId,
      toolName: toolName || "unknown",
      toolVersion: toolVersion || "unknown",
      actorId: request.actor?.id,
      actorRole: request.actor?.role ?? "unknown",
      capability,
      scopeSummary,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      success: false,
      errorCode: code,
      resultCount,
    });
    return {
      ok: false,
      tool: toolName
        ? { name: toolName, ...(toolVersion ? { version: toolVersion } : {}) }
        : undefined,
      error: { code, message },
      meta: {
        requestId,
        executedAt: completedAt.toISOString(),
        durationMs,
        ...(contextId ? { contextId } : {}),
      },
    };
  };

  try {
    if (!request.actor) {
      return finishFailure("UNAUTHENTICATED", "Actor is required");
    }
    if (!hasIntelligenceTool(toolName)) {
      return finishFailure("TOOL_NOT_FOUND", `Unknown intelligence tool: ${toolName}`);
    }

    const definition = getIntelligenceToolDefinition(toolName);
    toolName = definition.name;
    toolVersion = definition.version;
    capability = definition.capability;

    // Snapshot input identity for mutation checks (shallow).
    const inputSnapshot =
      request.input && typeof request.input === "object"
        ? JSON.stringify(request.input)
        : String(request.input);

    const parsedInput = validateIntelligenceToolInput(definition, request.input ?? {});
    assertCanExecuteIntelligenceTool(request.actor, definition, parsedInput);

    const scope = resolveIntelligenceToolScope(request.actor, parsedInput);
    scopeSummary = summarizeScope(scope.authorized, scope.requested);

    const { service, context } = resolveService(request);
    contextId = context.contextId;

    // Defense: actor on context should match trusted request actor (no silent swap).
    if (context.actor.id !== request.actor.id) {
      return finishFailure("FORBIDDEN", "Actor/context mismatch");
    }

    const output = await definition.handler(parsedInput, {
      service,
      context,
      actor: request.actor,
      requestId,
    });

    assertSafeIntelligenceToolOutput(output);
    resultCount = deriveIntelligenceToolResultCount(definition.name as IntelligenceToolName, output);

    if (
      request.input &&
      typeof request.input === "object" &&
      JSON.stringify(request.input) !== inputSnapshot
    ) {
      return finishFailure("TOOL_EXECUTION_FAILED", "Tool input was mutated during execution");
    }

    const completedAt = new Date();
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
    await recordIntelligenceToolAudit(request.auditSink, {
      requestId,
      contextId,
      toolName: definition.name,
      toolVersion: definition.version,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      capability: definition.capability,
      scopeSummary,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      success: true,
      resultCount,
    });

    return {
      ok: true,
      tool: { name: definition.name, version: definition.version },
      data: output,
      meta: {
        requestId,
        contextId: context.contextId,
        executedAt: completedAt.toISOString(),
        durationMs,
        ...(resultCount !== undefined ? { resultCount } : {}),
      },
    };
  } catch (error) {
    const mapped = mapServiceError(error);
    return finishFailure(mapped.code, mapped.message);
  }
}
