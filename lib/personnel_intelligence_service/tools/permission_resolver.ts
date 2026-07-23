/**
 * Thin permission resolver over Phase 49.5 capability checks (Phase 49.6).
 */
import {
  actorHasCapability,
  assertCanViewOfficer,
  type IntelligenceActor,
} from "@/lib/personnel_intelligence_service/permissions";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import {
  TOOL_CAPABILITY_TO_SERVICE,
  type IntelligenceToolDefinition,
} from "@/lib/personnel_intelligence_service/tools/types";

export function canExecuteIntelligenceTool(
  actor: IntelligenceActor | null | undefined,
  definition: IntelligenceToolDefinition,
  input?: unknown
): boolean {
  if (!actor) return false;
  const serviceCap = TOOL_CAPABILITY_TO_SERVICE[definition.capability];
  if (!actorHasCapability(actor, serviceCap)) return false;

  if (definition.name === "get_officer_intelligence") {
    const officerId =
      input && typeof input === "object" && input !== null && "officerId" in input
        ? String((input as { officerId: unknown }).officerId ?? "")
        : "";
    if (!officerId) return false;
    try {
      assertCanViewOfficer(actor, officerId);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export function assertCanExecuteIntelligenceTool(
  actor: IntelligenceActor | null | undefined,
  definition: IntelligenceToolDefinition,
  input?: unknown
): void {
  if (!actor) {
    throw new IntelligenceToolError("UNAUTHENTICATED", "Actor is required");
  }
  const serviceCap = TOOL_CAPABILITY_TO_SERVICE[definition.capability];
  if (!actorHasCapability(actor, serviceCap)) {
    throw new IntelligenceToolError("FORBIDDEN", `Missing capability: ${definition.capability}`);
  }
  if (definition.name === "get_officer_intelligence") {
    const officerId =
      input && typeof input === "object" && input !== null && "officerId" in input
        ? String((input as { officerId: unknown }).officerId ?? "").trim()
        : "";
    if (!officerId) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "officerId is required");
    }
    try {
      assertCanViewOfficer(actor, officerId);
    } catch {
      throw new IntelligenceToolError("FORBIDDEN", "Not allowed to view this officer's intelligence");
    }
  }
}
