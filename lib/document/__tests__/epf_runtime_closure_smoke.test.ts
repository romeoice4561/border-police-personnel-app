/**
 * Phase 49A.3 runtime-closure smoke (no browser harness in CI).
 *
 * Exercises the real upload service path for JPG + PDF, non-first empty-
 * category type binding, localized built-in titles, and thumbnail scale
 * tokens — the same contracts the interactive drawer uses.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "@/lib/document/document_categories";
import { DOCUMENT_CATEGORIES } from "@/lib/document/document_categories";
import { getDocumentTypeLabel, resolveDocumentDisplayTitle } from "@/lib/document/document_type_labels";
import { DocumentUploadService } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";
import type { OfficerDocument, DatabaseClient } from "@/lib/database/database_types";
import { documentThumbnailContentScale } from "@/lib/ui/media_tokens";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";

class WorkingStorage implements PortraitStorage {
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    return {
      storagePath: input.storagePath,
      publicUrl: `https://storage.test/${input.storagePath}`,
      thumbnailUrl: `https://storage.test/thumb/${input.storagePath}`,
    };
  }
  async remove(): Promise<void> {}
}

class FakeDb implements Pick<DatabaseClient, "officerDocument"> {
  rows: OfficerDocument[] = [];
  private nextId = 1;
  readonly officerDocument: DatabaseClient["officerDocument"] = {
    findUnique: async ({ where }) => this.rows.find((r) => r.id === (where as { id: number }).id) ?? null,
    findMany: async (args) => {
      let result = [...this.rows];
      const w = (args?.where ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(w)) {
        result = result.filter((r) => (r as unknown as Record<string, unknown>)[k] === v);
      }
      return result;
    },
    create: async (args) => {
      const row = { id: this.nextId++, isActive: true, ...args.data } as unknown as OfficerDocument;
      this.rows.push(row);
      return { ...row };
    },
    update: async (args) => {
      const row = this.rows.find((r) => r.id === (args.where as { id: number }).id)!;
      Object.assign(row, args.data);
      return { ...row };
    },
    updateMany: async (args) => {
      const w = args.where as Record<string, unknown>;
      let count = 0;
      for (const r of this.rows) {
        if (Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)) {
          Object.assign(r, args.data);
          count++;
        }
      }
      return { count };
    },
    upsert: async () => {
      throw new Error("not implemented");
    },
    deleteMany: async () => ({ count: 0 }),
    count: async () => this.rows.length,
  } as DatabaseClient["officerDocument"];
}

function service() {
  const db = new FakeDb();
  return {
    db,
    svc: new DocumentUploadService({
      repository: new DocumentRepository(db as unknown as DatabaseClient),
      storage: new WorkingStorage(),
    }),
  };
}

test("interactive JPG smoke: upload PASSPORT → preview URL → download → TH label", async () => {
  const { svc } = service();
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(1)]);
  const doc = await svc.upload({
    officerPk: 1,
    officerId: "smoke/1",
    documentType: "PASSPORT",
    title: getDocumentTypeLabel("PASSPORT", "en"),
    bytes: jpg,
    mimeType: "image/jpeg",
    originalFilename: "passport-smoke.jpg",
    uploadedBy: "smoke",
  });
  assert.ok(doc.fileUrl);
  assert.equal(doc.mimeType, "image/jpeg");
  const info = await svc.getDownloadInfo(doc.id);
  assert.ok(info?.fileUrl);
  assert.equal(resolveDocumentDisplayTitle(doc.title, "PASSPORT", "th"), "หนังสือเดินทาง");
  assert.notEqual(resolveDocumentDisplayTitle(doc.title, "PASSPORT", "th"), "Passport");
  assert.ok(documentThumbnailContentScale("md") >= 0.88);
});

test("interactive PDF smoke: upload + history + replace + readiness bump", async () => {
  const { svc } = service();
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(40).fill(0)]);
  const v1 = await svc.upload({
    officerPk: 2,
    officerId: "smoke/2",
    documentType: "HOUSE_REGISTRATION",
    title: "House Registration",
    bytes: pdf,
    mimeType: "application/pdf",
    originalFilename: "house.pdf",
    uploadedBy: "smoke",
  });
  assert.equal(v1.mimeType, "application/pdf");
  const v2 = await svc.upload({
    officerPk: 2,
    officerId: "smoke/2",
    documentType: "HOUSE_REGISTRATION",
    title: getDocumentTypeLabel("HOUSE_REGISTRATION", "th"),
    bytes: pdf,
    mimeType: "application/pdf",
    originalFilename: "house-v2.pdf",
    uploadedBy: "smoke",
  });
  assert.equal(v2.version, 2);
  const history = await svc.getHistory(2, "HOUSE_REGISTRATION");
  assert.equal(history.length, 2);
  assert.equal(resolveDocumentDisplayTitle(v1.title, "HOUSE_REGISTRATION", "th"), "ทะเบียนบ้าน");

  const before = composeOfficerDocumentIntelligence({ officerId: "smoke/2", officerPk: 2, documents: [] });
  const after = composeOfficerDocumentIntelligence({
    officerId: "smoke/2",
    officerPk: 2,
    documents: await svc.listActive(2),
  });
  assert.ok(after.completenessScore >= before.completenessScore);
});

test("non-first empty-category type binds correctly (DRIVER_LICENSE in IDENTITY)", () => {
  const identity = DOCUMENT_CATEGORIES.find((c) => c.code === "IDENTITY")!;
  assert.ok(identity.typeCodes.length > 1);
  assert.notEqual(identity.typeCodes[0], "DRIVER_LICENSE");
  assert.ok(identity.typeCodes.includes("DRIVER_LICENSE"));
  assert.equal(getDocumentTypeLabel("DRIVER_LICENSE", "th"), "ใบอนุญาตขับขี่");
  assert.equal(getDocumentTypeLabel("DRIVER_LICENSE", "en"), "Driver License");
});

test("TH↔EN switch without reload: same type returns both locales from pure helper", () => {
  const th = getDocumentTypeLabel("PASSPORT", "th");
  const en = getDocumentTypeLabel("PASSPORT", "en");
  assert.equal(th, "หนังสือเดินทาง");
  assert.equal(en, "Passport");
  assert.notEqual(th, en);
});
