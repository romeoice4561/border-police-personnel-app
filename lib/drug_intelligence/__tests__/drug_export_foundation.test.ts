import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import { requireDrugExport, resolveDrugExportAccess } from "@/lib/drug_intelligence/drug_export_auth";
import { drugExportContextV1InputSchema, resolveDrugExportContext } from "@/lib/drug_intelligence/drug_export_context";
import { DRUG_EXPORT_OPERATIONAL_HARD_LIMIT, exportLimitsForType } from "@/lib/drug_intelligence/drug_export_limits";
import { presentExportIdentifier, presentExportPhone, resolveExportMaskingMode } from "@/lib/drug_intelligence/drug_export_masking";
import { assertExportColumnsAllowed, columnsForPreset } from "@/lib/drug_intelligence/drug_export_presets";

const validContext = {
  schemaVersion: 1 as const,
  locale: "th" as const,
  sourceRoute: "/drug-intelligence/cases",
};

test("export requires drug.read AND drug.export", () => {
  assert.equal(resolveDrugExportAccess(undefined).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.read"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.export"]).canExport, false);
  assert.equal(resolveDrugExportAccess(["drug.read", "drug.export"]).canExport, true);
  assert.equal(requireDrugExport(defaultPermissionsForRole("admin"))?.canExport, true);
  assert.equal(requireDrugExport(defaultPermissionsForRole("commander"))?.canExport, true);
  assert.equal(requireDrugExport(defaultPermissionsForRole("officer")), null);
});

test("unmasked FULL requires drug.edit; commander is masked-only", () => {
  assert.equal(resolveExportMaskingMode("FULL", defaultPermissionsForRole("commander")).allowed, false);
  assert.equal(resolveExportMaskingMode("FULL", defaultPermissionsForRole("admin")).allowed, true);
  assert.equal(resolveExportMaskingMode("MASKED", defaultPermissionsForRole("commander")).mode, "MASKED");
  assert.equal(presentExportPhone("0812345678", "MASKED"), "081-xxx-5678");
  assert.equal(presentExportPhone("0812345678", "FULL"), "0812345678");
  assert.equal(presentExportIdentifier("1103700123456", "MASKED"), "xxxxxxxxx3456");
});

test("context rejects malformed input and server-derives actor/generatedAt", () => {
  assert.equal(drugExportContextV1InputSchema.safeParse({ ...validContext, sourceRoute: "/officers" }).success, false);
  assert.equal(drugExportContextV1InputSchema.safeParse({ ...validContext, sourceRoute: "/drug-intelligence/../secret" }).success, false);
  assert.equal(
    drugExportContextV1InputSchema.safeParse({
      ...validContext,
      period: { dateFrom: "2026-09-06", dateTo: "2026-09-01" },
    }).success,
    false
  );
  assert.equal(
    drugExportContextV1InputSchema.safeParse({
      ...validContext,
      network: { maxNodes: 151 },
    }).success,
    false
  );
  const ok = drugExportContextV1InputSchema.parse({
    ...validContext,
    network: { maxNodes: 150, depth: 2 },
    period: { fiscalYearBe: 2569, dateFrom: "2026-01-01", dateTo: "2026-09-06" },
  });
  const resolved = resolveDrugExportContext(ok, "mock:admin", new Date("2026-09-06T03:00:00.000Z"));
  assert.equal(resolved.actorId, "mock:admin");
  assert.equal(resolved.generatedAt, "2026-09-06T03:00:00.000Z");
  const stripped = drugExportContextV1InputSchema.parse({
    ...validContext,
    actorId: "mock:1101700123456",
    generatedAt: "1999-01-01T00:00:00.000Z",
    masking: "FULL",
  } as typeof validContext & { actorId: string; generatedAt: string; masking: string });
  assert.equal("actorId" in stripped, false);
  assert.equal("generatedAt" in stripped, false);
});

test("CUSTOM cannot request restricted columns; intelligence stays masked-column-safe", () => {
  assert.deepEqual(assertExportColumnsAllowed(["phone", "imei", "caseNumber"]), ["phone", "imei"]);
  const custom = columnsForPreset("OPERATIONAL_CASES", "CUSTOM", ["caseNumber", "phone", "title"]);
  assert.deepEqual(custom, ["caseNumber", "title"]);
  const intelligence = columnsForPreset("OPERATIONAL_CASES", "INTELLIGENCE");
  assert.equal(intelligence.includes("phone"), false);
});

test("operational hard limit is 5000 and never MAX_SAFE_INTEGER", () => {
  const limits = exportLimitsForType("OPERATIONAL_CASES");
  assert.equal(limits.hardLimit, 5000);
  assert.equal(limits.softLimit, 2000);
  assert.equal(DRUG_EXPORT_OPERATIONAL_HARD_LIMIT, 5000);
  assert.notEqual(limits.hardLimit, Number.MAX_SAFE_INTEGER);
});
