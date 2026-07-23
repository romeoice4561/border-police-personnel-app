import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/executor";
import {
  createIntelligenceToolAuditEvent,
  noopIntelligenceToolAuditSink,
  recordIntelligenceToolAudit,
} from "@/lib/personnel_intelligence_service/tools/audit";
import type { IntelligenceToolAuditEvent } from "@/lib/personnel_intelligence_service/tools/types";
import { makeBundle, officer } from "./_fixtures";

test("audit: success and failure events record safe metadata only", async () => {
  const events: IntelligenceToolAuditEvent[] = [];
  const sink = {
    record(event: IntelligenceToolAuditEvent) {
      events.push(event);
    },
  };
  const bundle = makeBundle("commander", [officer("a", { priority: "high" })]);

  await executeIntelligenceTool({
    toolName: "search_officers",
    input: { searchText: "SHOULD_NOT_BE_AUDITED", page: 1, pageSize: 10 },
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
    auditSink: sink,
  });

  const officerBundle = makeBundle("officer", [officer("a")], "a");
  await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: officerBundle.actor,
    service: officerBundle.service,
    serviceContext: officerBundle.context,
    auditSink: sink,
  });

  assert.equal(events.length, 2);
  assert.equal(events[0]!.success, true);
  assert.equal(events[1]!.success, false);
  assert.equal(events[1]!.errorCode, "FORBIDDEN");
  const blob = JSON.stringify(events);
  assert.equal(blob.includes("SHOULD_NOT_BE_AUDITED"), false);
  assert.equal(blob.includes("Officer a"), false);
  assert.equal(blob.includes("nationalId"), false);
  for (const e of events) {
    assert.ok(e.requestId);
    assert.ok(e.actorRole);
    assert.ok(typeof e.durationMs === "number");
  }
});

test("audit: no-op sink supported; sink failure does not throw to caller", async () => {
  await recordIntelligenceToolAudit(noopIntelligenceToolAuditSink, createIntelligenceToolAuditEvent({
    requestId: "r1",
    toolName: "get_commander_summary",
    toolVersion: "1.0.0",
    actorRole: "admin",
    capability: "intelligence.summary.view",
    scopeSummary: "unrestricted",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1,
    success: true,
  }));

  const throwing = {
    record() {
      throw new Error("audit boom");
    },
  };
  await recordIntelligenceToolAudit(throwing, createIntelligenceToolAuditEvent({
    requestId: "r2",
    toolName: "get_commander_summary",
    toolVersion: "1.0.0",
    actorRole: "admin",
    capability: "intelligence.summary.view",
    scopeSummary: "unrestricted",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1,
    success: true,
  }));
});
