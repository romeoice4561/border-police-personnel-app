/**
 * Safe audit events for intelligence tool execution (Phase 49.6).
 *
 * Never records search text, officer names/ids, tool I/O bodies, or credentials.
 */
import type {
  IntelligenceToolAuditEvent,
  IntelligenceToolAuditSink,
} from "@/lib/personnel_intelligence_service/tools/types";

/** Default sink — no-op (no uncontrolled file/DB logger). */
export const noopIntelligenceToolAuditSink: IntelligenceToolAuditSink = {
  record() {
    /* intentionally empty */
  },
};

/**
 * Dev-console sink: logs only safe metadata fields already on the event.
 * Never dumps input/output.
 */
export function createConsoleIntelligenceToolAuditSink(): IntelligenceToolAuditSink {
  return {
    record(event: IntelligenceToolAuditEvent) {
      if (process.env.NODE_ENV === "production") return;
      console.info("[intelligence-tool-audit]", {
        requestId: event.requestId,
        contextId: event.contextId,
        toolName: event.toolName,
        toolVersion: event.toolVersion,
        actorRole: event.actorRole,
        capability: event.capability,
        scopeSummary: event.scopeSummary,
        success: event.success,
        errorCode: event.errorCode,
        durationMs: event.durationMs,
        resultCount: event.resultCount,
      });
    },
  };
}

export function createIntelligenceToolAuditEvent(
  partial: IntelligenceToolAuditEvent
): IntelligenceToolAuditEvent {
  return { ...partial };
}

/** Best-effort record — audit sink failures must not change tool outcome. */
export async function recordIntelligenceToolAudit(
  sink: IntelligenceToolAuditSink | undefined,
  event: IntelligenceToolAuditEvent
): Promise<void> {
  const target = sink ?? noopIntelligenceToolAuditSink;
  try {
    await target.record(event);
  } catch {
    // Swallow — never surface audit errors or private data
  }
}
