/**
 * Entity Media / Visual Identity — persistence, primary invariant, auth,
 * validation, merge remap, and presentation attach (search/graph).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugEntityMediaService } from "@/lib/drug_intelligence/drug_entity_media_service";
import {
  handleEntityMediaDelete,
  handleEntityMediaList,
  handleEntityMediaUpload,
} from "@/lib/drug_intelligence/drug_entity_media_api_handlers";
import { attachGraphNodeVisuals, attachSearchGroupedVisuals } from "@/lib/drug_intelligence/drug_entity_media_present";
import { InMemoryBoardImageObjectStore } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import { BoardImageValidationError } from "@/lib/drug_intelligence/drug_investigation_board_image_validation";
import {
  EntityMediaMergedWriteError,
  buildEntityMediaStoragePath,
} from "@/lib/drug_intelligence/drug_entity_media_validation";
import { visualLookupKey } from "@/lib/drug_intelligence/drug_entity_media_types";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";
import type { DrugSearchGroupedResults } from "@/lib/drug_intelligence/drug_search_types";

const ROOT = process.cwd();
const actor = { actorId: "mock:admin", actorName: "Administrator" };

function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  ]);
}

function jpegBytes(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MEDIA-CASE-001",
    title: "คดีทดสอบสื่อ",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    province: null,
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
    ...overrides,
  };
}

async function seedPersonVehicle(db: InMemoryDatabaseClient) {
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      persons: [
        {
          newPerson: {
            primaryFullName: "นายสื่อ ทดสอบ",
            nationality: "ไทย",
            dateOfBirth: new Date("1990-01-01"),
            notes: null,
            identifiers: [],
          },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [
            {
              registrationNumber: "กข-1234",
              registrationProvince: "เชียงราย",
              vehicleType: null,
              brand: null,
              model: null,
              color: null,
              vin: null,
              firstSeenAt: null,
              lastSeenAt: null,
              notes: null,
            },
          ],
        },
      ],
    })
  );
  const personId = ((await db.drugCasePerson.findMany({ where: { caseId: created.caseId } }))[0] as { personId: string })
    .personId;
  const vehicleId = ((await db.drugPersonVehicle.findMany({ where: { personId } }))[0] as { vehicleId: string }).vehicleId;
  return { caseId: created.caseId, personId, vehicleId };
}

function mediaService(db = new InMemoryDatabaseClient(), store = new InMemoryBoardImageObjectStore()) {
  return { db, store, service: new DrugEntityMediaService(db, store) };
}

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

function uploadForm(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const file of files) form.append("file", file);
  return form;
}

test("storage path is server-generated and rejects traversal", () => {
  assert.equal(buildEntityMediaStoragePath("PERSON", "p1", "m1", "png"), "entities/PERSON/p1/m1.png");
  assert.throws(() => buildEntityMediaStoragePath("PERSON", "../x", "m1", "png"), BoardImageValidationError);
  assert.throws(() => buildEntityMediaStoragePath("PERSON", "p1", "../m", "png"), BoardImageValidationError);
});

test("entity without photo lists empty and graph/search attach a null visual", async () => {
  const { db, service } = mediaService();
  const { personId } = await seedPersonVehicle(db);
  const listed = await service.list("PERSON", personId);
  assert.equal(listed.photoCount, 0);
  assert.equal(listed.primaryId, null);

  const visuals = await service.visualsFor([{ entityType: "PERSON", entityId: personId }]);
  assert.equal(visuals.has(visualLookupKey("PERSON", personId)), false);

  const grouped = await attachSearchGroupedVisuals(service, {
    query: "นายสื่อ",
    classification: "PERSON_NAME",
    totalCount: 1,
    groups: [
      {
        entityType: "PERSON",
        count: 1,
        results: [
          {
            entityType: "PERSON",
            entityId: personId,
            primaryLabel: "นายสื่อ ทดสอบ",
            secondaryLabel: null,
            matchedField: "PRIMARY_NAME",
            matchedValueMasked: "นายสื่อ ทดสอบ",
            strength: "EXACT",
            firstSeen: null,
            lastSeen: null,
            caseCount: 1,
            hasPotentialDuplicate: null,
            canonicalTarget: null,
          },
        ],
      },
    ],
  } satisfies DrugSearchGroupedResults);
  assert.equal(grouped.groups[0]?.results[0]?.visual ?? null, null);

  const nodes = await attachGraphNodeVisuals(service, [{ id: personId, type: "PERSON" }]);
  assert.equal(nodes[0]?.visual ?? null, null);
  assert.equal(nodes[0]?.photoCount, 0);
});

test("first photo becomes primary; additional photos do not; set-primary is exclusive", async () => {
  const { db, store, service } = mediaService();
  const { personId, caseId } = await seedPersonVehicle(db);

  const first = await service.upload(
    {
      entityType: "PERSON",
      entityId: personId,
      category: "PROFILE",
      sourceCaseId: caseId,
      bytes: pngBytes(),
      declaredMime: "image/png",
      originalName: "face.png",
    },
    actor
  );
  assert.equal(first.isPrimary, true);
  assert.equal(first.sourceCaseId, caseId);
  assert.match(first.thumbnailUrl ?? "", /&w=128&h=128/);
  assert.equal(store.objects.size, 1);

  const second = await service.upload(
    {
      entityType: "PERSON",
      entityId: personId,
      category: "ARREST",
      bytes: pngBytes(),
      declaredMime: "image/png",
      originalName: "arrest.png",
    },
    actor
  );
  assert.equal(second.isPrimary, false);

  const listed = await service.list("PERSON", personId);
  assert.equal(listed.photoCount, 2);
  assert.equal(listed.items.filter((item) => item.isPrimary).length, 1);
  assert.equal(listed.primaryId, first.id);

  const updated = await service.update(second.id, { isPrimary: true }, actor);
  assert.equal(updated.isPrimary, true);
  const after = await service.list("PERSON", personId);
  assert.equal(after.items.find((item) => item.id === first.id)?.isPrimary, false);
  assert.equal(after.items.filter((item) => item.isPrimary).length, 1);

  const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugEntityMedia" } });
  assert.ok(audits.some((row) => (row as { action: string }).action === "entity_media_uploaded"));
  assert.ok(audits.some((row) => (row as { action: string }).action === "entity_media_primary_set"));
});

test("deleting the primary photo does not auto-promote another photo", async () => {
  const { db, store, service } = mediaService();
  const { personId } = await seedPersonVehicle(db);
  const first = await service.upload(
    { entityType: "PERSON", entityId: personId, bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );
  await service.upload(
    { entityType: "PERSON", entityId: personId, bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );
  await service.remove(first.id, actor);
  const listed = await service.list("PERSON", personId);
  assert.equal(listed.photoCount, 1);
  assert.equal(listed.primaryId, null);
  assert.equal(listed.items[0]?.isPrimary, false);
  assert.equal(store.objects.size, 1);
});

test("vehicle media supports multiple categorized photos and one primary", async () => {
  const { db, service } = mediaService();
  const { vehicleId } = await seedPersonVehicle(db);
  const front = await service.upload(
    { entityType: "VEHICLE", entityId: vehicleId, category: "FRONT", bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );
  const plate = await service.upload(
    {
      entityType: "VEHICLE",
      entityId: vehicleId,
      category: "LICENSE_PLATE",
      bytes: pngBytes(),
      declaredMime: "image/png",
    },
    actor
  );
  assert.equal(front.isPrimary, true);
  assert.equal(plate.isPrimary, false);
  const listed = await service.list("VEHICLE", vehicleId);
  assert.equal(listed.photoCount, 2);
  assert.deepEqual(listed.items.map((item) => item.category).sort(), ["FRONT", "LICENSE_PLATE"]);
});

test("merged person writes are rejected; reads resolve onto the survivor", async () => {
  const { db, service } = mediaService();
  const first = await seedPersonVehicle(db);
  const secondCase = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "MEDIA-CASE-002",
      persons: [
        {
          newPerson: {
            primaryFullName: "นายสื่อ ซ้ำ",
            nationality: "ไทย",
            dateOfBirth: new Date("1990-01-01"),
            notes: null,
            identifiers: [],
          },
          role: "ACCUSED",
          linkedOfficerId: null,
          notes: null,
          phones: [],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  const mergedPersonId = (
    (await db.drugCasePerson.findMany({ where: { caseId: secondCase.caseId } }))[0] as { personId: string }
  ).personId;

  const incoming = await service.upload(
    { entityType: "PERSON", entityId: mergedPersonId, bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );
  const survivorPhoto = await service.upload(
    { entityType: "PERSON", entityId: first.personId, bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );

  const merge = new DrugPersonMergeService(db);
  const preview = await merge.preview(first.personId, mergedPersonId);
  assert.equal(preview.movedCounts.media, 1);
  await merge.merge({
    survivorPersonId: first.personId,
    mergedPersonId,
    reason: "duplicate",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  await assert.rejects(
    () =>
      service.upload(
        { entityType: "PERSON", entityId: mergedPersonId, bytes: pngBytes(), declaredMime: "image/png" },
        actor
      ),
    EntityMediaMergedWriteError
  );

  const remapped = await db.drugEntityMedia.findMany({ where: { entityId: first.personId } });
  assert.equal(remapped.length, 2);
  assert.equal((await db.drugEntityMedia.findMany({ where: { entityId: mergedPersonId } })).length, 0);
  assert.equal((remapped as Array<{ isPrimary: boolean }>).filter((row) => row.isPrimary).length, 1);
  assert.equal((remapped.find((row) => row.id === survivorPhoto.id) as { isPrimary: boolean }).isPrimary, true);
  assert.equal((remapped.find((row) => row.id === incoming.id) as { isPrimary: boolean }).isPrimary, false);

  const listed = await service.list("PERSON", mergedPersonId);
  assert.equal(listed.photoCount, 2);
  assert.equal(listed.primaryId, survivorPhoto.id);

  const visuals = await service.visualsFor([{ entityType: "PERSON", entityId: mergedPersonId }]);
  assert.equal(visuals.get(visualLookupKey("PERSON", mergedPersonId))?.mediaId, survivorPhoto.id);
});

test("search and graph keep working when visual attach throws", async () => {
  const broken = {
    visualsFor: async () => {
      throw new Error("media-unavailable");
    },
    photoCountsFor: async () => {
      throw new Error("media-unavailable");
    },
  };
  const grouped = await attachSearchGroupedVisuals(broken as never, {
    query: "นายสื่อ",
    classification: "PERSON_NAME",
    totalCount: 1,
    groups: [
      {
        entityType: "PERSON",
        count: 1,
        results: [
          {
            entityType: "PERSON",
            entityId: "p1",
            primaryLabel: "นายสื่อ ทดสอบ",
            secondaryLabel: null,
            matchedField: "PRIMARY_NAME",
            matchedValueMasked: "นายสื่อ ทดสอบ",
            strength: "EXACT",
            firstSeen: null,
            lastSeen: null,
            caseCount: 1,
            hasPotentialDuplicate: null,
            canonicalTarget: null,
          },
        ],
      },
    ],
  } satisfies DrugSearchGroupedResults);
  assert.equal(grouped.totalCount, 1);
  assert.equal(grouped.groups[0]?.results[0]?.primaryLabel, "นายสื่อ ทดสอบ");

  const nodes = await attachGraphNodeVisuals(broken as never, [{ id: "p1", type: "PERSON" }]);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.id, "p1");
});

test("search and graph attach thumbnail-sized visuals without changing topology", async () => {
  const { db, service } = mediaService();
  const { personId, vehicleId } = await seedPersonVehicle(db);
  const photo = await service.upload(
    { entityType: "PERSON", entityId: personId, bytes: pngBytes(), declaredMime: "image/png" },
    actor
  );
  const grouped = await attachSearchGroupedVisuals(service, {
    query: "นายสื่อ",
    classification: "PERSON_NAME",
    totalCount: 2,
    groups: [
      {
        entityType: "PERSON",
        count: 1,
        results: [
          {
            entityType: "PERSON",
            entityId: personId,
            primaryLabel: "นายสื่อ ทดสอบ",
            secondaryLabel: null,
            matchedField: "PRIMARY_NAME",
            matchedValueMasked: "นายสื่อ ทดสอบ",
            strength: "EXACT",
            firstSeen: null,
            lastSeen: null,
            caseCount: 1,
            hasPotentialDuplicate: null,
            canonicalTarget: null,
          },
        ],
      },
      {
        entityType: "VEHICLE",
        count: 1,
        results: [
          {
            entityType: "VEHICLE",
            entityId: vehicleId,
            primaryLabel: "กข-1234",
            secondaryLabel: null,
            matchedField: "REGISTRATION_NUMBER",
            matchedValueMasked: "กข-1234",
            strength: "EXACT",
            firstSeen: null,
            lastSeen: null,
            caseCount: 1,
            hasPotentialDuplicate: null,
            canonicalTarget: null,
          },
        ],
      },
    ],
  } satisfies DrugSearchGroupedResults);
  assert.equal(grouped.groups[0]?.results[0]?.visual?.mediaId, photo.id);
  assert.match(grouped.groups[0]?.results[0]?.visual?.thumbnailUrl ?? "", /&w=128&h=128/);
  assert.equal(grouped.groups[1]?.results[0]?.visual ?? null, null);
  assert.equal(grouped.totalCount, 2);

  const nodes = await attachGraphNodeVisuals(service, [
    { id: personId, type: "PERSON" },
    { id: vehicleId, type: "VEHICLE" },
    { id: "phone-1", type: "PHONE" },
  ]);
  assert.equal(nodes[0]?.visual?.mediaId, photo.id);
  assert.equal(nodes[0]?.photoCount, 1);
  assert.equal(nodes[1]?.visual ?? null, null);
  assert.equal(nodes[2]?.visual ?? null, null);
});

test("upload rejects empty, executable, and MIME-mismatched files", async () => {
  const { db, service } = mediaService();
  const { personId } = await seedPersonVehicle(db);
  await assert.rejects(
    () => service.upload({ entityType: "PERSON", entityId: personId, bytes: new Uint8Array(), declaredMime: "image/png" }, actor),
    BoardImageValidationError
  );
  await assert.rejects(
    () =>
      service.upload(
        {
          entityType: "PERSON",
          entityId: personId,
          bytes: new TextEncoder().encode("MZ executable"),
          declaredMime: "image/png",
        },
        actor
      ),
    BoardImageValidationError
  );
  await assert.rejects(
    () =>
      service.upload(
        { entityType: "PERSON", entityId: personId, bytes: jpegBytes(), declaredMime: "image/png" },
        actor
      ),
    BoardImageValidationError
  );
});

test("list requires drug.read; upload/delete require drug.edit", async () => {
  const { db, service } = mediaService();
  const { personId } = await seedPersonVehicle(db);
  const file = new File([pngBytes() as BlobPart], "face.png", { type: "image/png" });

  const officerList = await handleEntityMediaList(
    service,
    new URLSearchParams({ actorId: "mock:1101700123456", entityType: "PERSON", entityId: personId }),
    requestWithSession(`http://localhost/api/drug-intelligence/entity-media?actorId=mock:1101700123456&entityType=PERSON&entityId=${personId}`)
  );
  assert.equal(officerList.status, 403);

  const commanderUpload = await handleEntityMediaUpload(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/entity-media", {
      method: "POST",
      body: uploadForm(
        { actorId: "mock:bpp414", actorName: "Commander", entityType: "PERSON", entityId: personId },
        [file]
      ),
    })
  );
  assert.equal(commanderUpload.status, 403);

  const adminUpload = await handleEntityMediaUpload(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/entity-media", {
      method: "POST",
      body: uploadForm(
        { actorId: "mock:admin", actorName: "Administrator", entityType: "PERSON", entityId: personId, category: "PROFILE" },
        [file]
      ),
    })
  );
  assert.equal(adminUpload.status, 201);
  const uploaded = (await adminUpload.json()) as { data: { id: string } };

  const commanderList = await handleEntityMediaList(
    service,
    new URLSearchParams({ actorId: "mock:bpp414", entityType: "PERSON", entityId: personId }),
    requestWithSession(`http://localhost/api/drug-intelligence/entity-media?actorId=mock:bpp414&entityType=PERSON&entityId=${personId}`)
  );
  assert.equal(commanderList.status, 200);

  const commanderDelete = await handleEntityMediaDelete(
    service,
    uploaded.data.id,
    requestWithSession(`http://localhost/api/drug-intelligence/entity-media/${uploaded.data.id}`, {
      method: "DELETE",
      body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander" }),
    })
  );
  assert.equal(commanderDelete.status, 403);
});

test("UI surfaces keep visual identity hooks without replacing graph semantics", () => {
  const searchCard = readFileSync(join(ROOT, "components/drug_intelligence/drug_search_result_card.tsx"), "utf8");
  const relationship = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
  const graphNode = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_graph_node.tsx"), "utf8");
  const inspector = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_node_detail.tsx"), "utf8");
  const gallery = readFileSync(join(ROOT, "components/drug_intelligence/drug_entity_media_gallery.tsx"), "utf8");
  const graphHandler = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_api_handlers.ts"), "utf8");

  assert.match(searchCard, /DrugEntityVisualThumb/);
  assert.match(searchCard, /size=\{result\.entityType === "PERSON"/);
  assert.match(relationship, /item\.to\.visual/);
  assert.match(graphNode, /graphNode\.visual\?\.thumbnailUrl/);
  assert.match(graphNode, /size=\{isCompact \? "search" : isFocus \? "graphFocus" : "graph"\}/);
  assert.match(inspector, /di\.media\.openGallery/);
  assert.match(inspector, /di\.media\.allPhotos/);
  assert.match(gallery, /capture="environment"/);
  assert.match(gallery, /di\.media\.chooseFile/);
  const identityHeader = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_identity_header.tsx"), "utf8");
  assert.match(identityHeader, /size="portrait"/);
  assert.match(identityHeader, /flex-1 basis-0/);
  assert.match(identityHeader, /md:flex-row/);
  assert.doesNotMatch(identityHeader, /lg:justify-between/);
  assert.doesNotMatch(identityHeader, /break-all/);
  assert.match(readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8"), /DrugPersonIdentityHeader/);
  assert.match(graphHandler, /attachGraphNodeVisuals/);
  assert.match(graphHandler, /depth/);
});
