/**
 * Unit tests for handleOfficerProfileSave (Phase 23A) over a real
 * OfficerProfileService backed by the in-memory fake DatabaseClient — no
 * running server, no live DB.
 *
 * Run with:
 *   npx tsx --test lib/officer_profile/__tests__/officer_profile_api_handlers.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { OfficerRepository, type OfficerInput } from "@/lib/database/repositories/officer_repository";
import { OfficerProfileService } from "@/lib/officer_profile/officer_profile_service";
import { handleOfficerProfileSave } from "@/lib/officer_profile/officer_profile_api_handlers";

function officerInput(ov: Partial<OfficerInput> = {}): OfficerInput {
  return {
    officerId: "ภาค1/5",
    rank: "ร.ต.ท.",
    firstName: "อนิรุทธิ์",
    lastName: "ขาวจันทร์คง",
    currentPosition: "ผบ.ร้อย",
    currentUnit: "ตชด.447",
    phone: "081-540-7336",
    careerYears: 19,
    qualityScore: 90,
    knowledgeScore: 80,
    region: "ภาค1",
    confidence: 80,
    driveFileId: null,
    thumbnailUrl: null,
    webViewUrl: null,
    ...ov,
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/officers/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seededService() {
  const db = new InMemoryDatabaseClient();
  await new OfficerRepository(db).upsert(officerInput());
  return new OfficerProfileService({ db });
}

test("PATCH saves and returns 200 with the save result", async () => {
  const service = await seededService();
  const res = await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ profile: { phone: "089-000-0000" } }));
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { officerId: string; profileUpdated: boolean } };
  assert.equal(json.data.officerId, "ภาค1/5");
  assert.equal(json.data.profileUpdated, true);
});

test("PATCH returns 404 for an unknown officer id", async () => {
  const service = await seededService();
  const res = await handleOfficerProfileSave(service, "ไม่มี/999", jsonRequest({ profile: { phone: "080-000-0000" } }));
  assert.equal(res.status, 404);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, "NOT_FOUND");
});

test("Phase 23B: PATCH ACCEPTS a free-form rank (imported ranks outside the standard list must be saveable)", async () => {
  const service = await seededService();
  const res = await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ profile: { rank: "ร.ท." } }));
  assert.equal(res.status, 200);
});

test("PATCH still returns 400 for a malformed email (structural guard retained)", async () => {
  const service = await seededService();
  const res = await handleOfficerProfileSave(service, "ภาค1/5", jsonRequest({ profile: { email: "not-an-email" } }));
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, "BAD_REQUEST");
});

test("PATCH returns 400 for malformed JSON", async () => {
  const service = await seededService();
  const badRequest = new Request("http://localhost/api/officers/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  const res = await handleOfficerProfileSave(service, "ภาค1/5", badRequest);
  assert.equal(res.status, 400);
});

test("PATCH returns 400 for an invalid officer id param", async () => {
  const service = await seededService();
  const res = await handleOfficerProfileSave(service, "   ", jsonRequest({}));
  assert.equal(res.status, 400);
});
