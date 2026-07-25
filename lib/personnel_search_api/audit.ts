/**
 * Structured audit events for Personnel Search API (Phase 51.1).
 * Never logs raw query text that may contain PII.
 */
import { createHash } from "node:crypto";
import type { SearchIntent } from "@/lib/personnel_search/types";
import type { SearchClient } from "@/lib/personnel_search/types";

export type PersonnelSearchAuditOutcome = "success" | "forbidden" | "invalid" | "error";

export interface SafeScopeSummary {
  unrestricted: boolean;
  regionId?: number;
  divisionId?: number;
  companyId?: number;
}

export interface PersonnelSearchAuditEvent {
  requestId: string;
  actorUserId: string;
  actorOfficerId?: string;
  role: string;
  client: SearchClient;
  queryCategory: SearchIntent | "UNKNOWN";
  normalizedQueryHash?: string;
  organizationScope: SafeScopeSummary;
  disclosureLevel: 1 | 2 | 3;
  resultCount: number;
  outcome: PersonnelSearchAuditOutcome;
  requestedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface PersonnelSearchAuditSink {
  record(event: PersonnelSearchAuditEvent): void | Promise<void>;
}

export const noopPersonnelSearchAuditSink: PersonnelSearchAuditSink = {
  record() {
    /* intentionally empty */
  },
};

export function createConsolePersonnelSearchAuditSink(): PersonnelSearchAuditSink {
  return {
    record(event) {
      if (process.env.NODE_ENV === "production") return;
      console.info("[personnel-search-audit]", {
        requestId: event.requestId,
        role: event.role,
        client: event.client,
        queryCategory: event.queryCategory,
        normalizedQueryHash: event.normalizedQueryHash,
        organizationScope: event.organizationScope,
        disclosureLevel: event.disclosureLevel,
        resultCount: event.resultCount,
        outcome: event.outcome,
        durationMs: event.durationMs,
      });
    },
  };
}

export function hashQueryForAudit(query: string): string {
  return createHash("sha256").update(query).digest("hex").slice(0, 24);
}

export async function recordPersonnelSearchAudit(
  sink: PersonnelSearchAuditSink | undefined,
  event: PersonnelSearchAuditEvent
): Promise<void> {
  try {
    await (sink ?? noopPersonnelSearchAuditSink).record(event);
  } catch {
    // Audit failures must not corrupt the API response.
  }
}
