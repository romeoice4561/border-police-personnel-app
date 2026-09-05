import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());
const EXPORT_FILES = [
  "lib/export/csv.ts",
  "lib/export/filename.ts",
  "lib/drug_intelligence/drug_export_auth.ts",
  "lib/drug_intelligence/drug_export_context.ts",
  "lib/drug_intelligence/drug_export_service.ts",
  "lib/drug_intelligence/drug_export_api_handlers.ts",
  "lib/drug_intelligence/drug_export_audit.ts",
  "app/api/drug-intelligence/exports/route.ts",
];

test("export modules never use MAX_SAFE_INTEGER", () => {
  for (const file of EXPORT_FILES) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /MAX_SAFE_INTEGER/, file);
  }
});

test("export modules do not call factual graph writers", () => {
  const forbidden = [
    /\.drugRelationship\.(create|update|delete)/,
    /\.drugPersonMerge\.(create|update|delete)/,
    /\.drugNetworkGroup\.(create|update|delete)/,
    /DrugPersonMergeService/,
  ];
  for (const file of EXPORT_FILES) {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const token of forbidden) {
      assert.doesNotMatch(src, token, `${file} ${token}`);
    }
  }
});

test("operational export writes audit only — factual counts stay identical", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const input: DrugCaseCreateRequest = {
    caseNumber: "EXPORT-ISO-001",
    title: "isolation",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.",
    province: "เชียงราย",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
  };
  await caseService.createCase(input);
  const before = {
    merge: await db.drugPersonMerge.count(),
    group: await db.drugNetworkGroup.count(),
    casePerson: await db.drugCasePerson.count(),
    person: await db.drugPerson.count(),
    cases: await db.drugCase.count(),
    phone: await db.drugCasePhone.count(),
    sim: await db.drugCaseSim.count(),
    device: await db.drugCaseDevice.count(),
    vehicle: await db.drugCaseVehicle.count(),
    location: await db.drugCaseLocation.count(),
    personDevice: await db.drugPersonDevice.count(),
    personVehicle: await db.drugPersonVehicle.count(),
    audits: await db.drugAuditLog.count(),
  };
  const headers = new Headers({
    cookie: `${SESSION_COOKIE_NAME}=test-session`,
    "content-type": "application/json",
  });
  const response = await handleDrugExportCreate(
    new DrugExportService(db),
    new Request("http://localhost/api/drug-intelligence/exports", {
      method: "POST",
      headers,
      body: JSON.stringify({
        actorId: "mock:admin",
        exportType: "OPERATIONAL_CASES",
        format: "CSV",
        context: { schemaVersion: 1, locale: "en", sourceRoute: "/drug-intelligence/cases" },
      }),
    })
  );
  assert.equal(response.status, 200);
  assert.equal(await db.drugPersonMerge.count(), before.merge);
  assert.equal(await db.drugNetworkGroup.count(), before.group);
  assert.equal(await db.drugCasePerson.count(), before.casePerson);
  assert.equal(await db.drugPerson.count(), before.person);
  assert.equal(await db.drugCase.count(), before.cases);
  assert.equal(await db.drugCasePhone.count(), before.phone);
  assert.equal(await db.drugCaseSim.count(), before.sim);
  assert.equal(await db.drugCaseDevice.count(), before.device);
  assert.equal(await db.drugCaseVehicle.count(), before.vehicle);
  assert.equal(await db.drugCaseLocation.count(), before.location);
  assert.equal(await db.drugPersonDevice.count(), before.personDevice);
  assert.equal(await db.drugPersonVehicle.count(), before.personVehicle);
  assert.equal(await db.drugAuditLog.count(), before.audits + 1);
});

test("operational CSV stays bounded for 100 and 1000 in-memory rows", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugCaseService({ db });
  for (let i = 0; i < 100; i += 1) {
    await service.createCase({
      caseNumber: `PERF-${i}`,
      title: `perf ${i}`,
      status: "OPEN",
      arrestDate: new Date("2026-01-15"),
      arrestTime: null,
      headquartersId: null,
      regionId: null,
      battalionId: null,
      companyId: null,
      reportingUnitText: "กก.",
      province: "เชียงราย",
      district: null,
      subdistrict: null,
      locationName: null,
      latitude: null,
      longitude: null,
      narrative: null,
      persons: [],
      seizedItems: [],
      locations: [],
      actorId: "mock:admin",
      actorName: "Administrator",
    });
  }
  const exporter = new DrugExportService(db);
  const context = {
    schemaVersion: 1 as const,
    locale: "en" as const,
    sourceRoute: "/drug-intelligence/cases",
    actorId: "mock:admin",
    generatedAt: new Date().toISOString(),
  };
  const started = Date.now();
  const result = await exporter.generate({
    actorName: "Administrator",
    exportType: "OPERATIONAL_CASES",
    format: "CSV",
    context,
    maskingMode: "MASKED",
  });
  assert.equal(result.recordCount, 100);
  assert.ok(Date.now() - started < 5000);
});
