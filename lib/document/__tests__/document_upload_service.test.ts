/**
 * Unit tests for DocumentUploadService (Phase 29A — Officer Document Vault Foundation).
 *
 * Uses in-memory fakes for storage and repository — no network, no live DB.
 *
 * Run with:
 *   npx tsx --test lib/document/__tests__/document_upload_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DocumentUploadService, DocumentUploadError } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";
import type { OfficerDocument } from "@/lib/database/database_types";
import type { DatabaseClient } from "@/lib/database/database_types";

// ── Fakes ─────────────────────────────────────────────────────────────────────

class FakeStorage implements PortraitStorage {
  calls: PutPortraitInput[] = [];
  removed: string[] = [];

  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    this.calls.push(input);
    return {
      storagePath: input.storagePath,
      publicUrl: `https://s.test/${input.storagePath}`,
      thumbnailUrl: `https://s.test/t/${input.storagePath}`,
    };
  }
  async remove(storagePath: string): Promise<void> {
    this.removed.push(storagePath);
  }
}

class FakeDb implements Pick<DatabaseClient, "officerDocument"> {
  rows: OfficerDocument[] = [];
  private nextId = 1;

  readonly officerDocument: DatabaseClient["officerDocument"] = {
    findUnique: async ({ where }) => {
      const id = (where as { id: number }).id;
      return this.rows.find((r) => r.id === id) ?? null;
    },
    findMany: async (args) => {
      let result = [...this.rows];
      const w = (args?.where ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(w)) {
        result = result.filter((r) => (r as unknown as Record<string, unknown>)[k] === v);
      }
      const orderByRaw = (args as { orderBy?: unknown })?.orderBy;
      if (orderByRaw && typeof orderByRaw === "object" && !Array.isArray(orderByRaw)) {
        const orderBy = orderByRaw as Record<string, "asc" | "desc">;
        const [field, dir] = Object.entries(orderBy)[0];
        result.sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field];
          const bv = (b as unknown as Record<string, unknown>)[field];
          if (typeof av === "number" && typeof bv === "number") {
            return dir === "asc" ? av - bv : bv - av;
          }
          return 0;
        });
      }
      return result;
    },
    create: async (args) => {
      const row = { id: this.nextId++, isActive: true, ...args.data } as unknown as OfficerDocument;
      this.rows.push(row);
      return { ...row };
    },
    update: async (args) => {
      const id = (args.where as { id: number }).id;
      const row = this.rows.find((r) => r.id === id)!;
      Object.assign(row, args.data);
      return { ...row };
    },
    updateMany: async (args) => {
      const w = args.where as Record<string, unknown>;
      let count = 0;
      for (const r of this.rows) {
        const matches = Object.entries(w).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v
        );
        if (matches) {
          Object.assign(r, args.data);
          count += 1;
        }
      }
      return { count };
    },
    upsert: async () => { throw new Error("not implemented"); },
    deleteMany: async () => { return { count: 0 }; },
    count: async (args) => {
      const w = (args?.where ?? {}) as Record<string, unknown>;
      return this.rows.filter((r) =>
        Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
      ).length;
    },
  };
}

function pdfBytes(): Uint8Array {
  const b = new Uint8Array(10);
  b.set([0x25, 0x50, 0x44, 0x46]); // "%PDF" magic
  return b;
}

function setup() {
  const fakeDb = new FakeDb();
  const storage = new FakeStorage();
  const repo = new DocumentRepository(fakeDb as unknown as DatabaseClient);
  const service = new DocumentUploadService({ repository: repo, storage });
  return { service, repo, storage, fakeDb };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("upload a valid PDF creates a row with version=1", async () => {
  const { service } = setup();
  const doc = await service.upload({
    officerPk: 5,
    officerId: "ภาค1/5",
    documentType: "GP7",
    title: "ก.พ.7",
    bytes: pdfBytes(),
    mimeType: "application/pdf",
  });
  assert.equal(doc.documentType, "GP7");
  assert.equal(doc.version, 1);
  assert.equal(doc.isActive, true);
  assert.ok(doc.storagePath?.includes("GP7"));
  assert.ok(doc.fileUrl?.startsWith("https://"));
});

test("upload stores the file in the storage backend", async () => {
  const { service, storage } = setup();
  await service.upload({
    officerPk: 5, officerId: "test", documentType: "PASSPORT",
    title: "Passport", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  assert.equal(storage.calls.length, 1);
  assert.ok(storage.calls[0].storagePath.includes("PASSPORT"));
});

test("second upload for same type creates version=2 and demotes prior", async () => {
  const { service } = setup();
  const v1 = await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "ก.พ.7 v1", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  const v2 = await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "ก.พ.7 v2", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.isActive, true);

  const v1Again = await service.getById(v1.id);
  assert.ok(v1Again);
  assert.equal(v1Again.isActive, false);
});

test("listActive returns only active documents", async () => {
  const { service } = setup();
  await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "ก.พ.7", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  const v1 = await service.upload({
    officerPk: 5, officerId: "test", documentType: "PASSPORT",
    title: "Passport", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  await service.upload({
    officerPk: 5, officerId: "test", documentType: "PASSPORT",
    title: "Passport v2", bytes: pdfBytes(), mimeType: "application/pdf",
  });

  const active = await service.listActive(5);
  assert.equal(active.length, 2);
  const passportActive = active.find((d) => d.documentType === "PASSPORT");
  assert.ok(passportActive);
  assert.equal(passportActive.version, 2);
  // v1 should not be in active list
  const v1Active = active.find((d) => d.id === v1.id);
  assert.equal(v1Active, undefined);
});

test("upload throws UNSUPPORTED_TYPE for image/gif", async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.upload({
      officerPk: 5, officerId: "test", documentType: "GP7",
      title: "test", bytes: new Uint8Array([1, 2, 3]), mimeType: "image/gif",
    }),
    (err: unknown) => {
      assert.ok(err instanceof DocumentUploadError);
      assert.equal(err.code, "UNSUPPORTED_TYPE");
      return true;
    }
  );
});

test("upload throws EMPTY for zero-length file", async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.upload({
      officerPk: 5, officerId: "test", documentType: "GP7",
      title: "test", bytes: new Uint8Array(0), mimeType: "application/pdf",
    }),
    (err: unknown) => {
      assert.ok(err instanceof DocumentUploadError);
      assert.equal(err.code, "EMPTY");
      return true;
    }
  );
});

test("softDelete makes the document inactive", async () => {
  const { service } = setup();
  const doc = await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "ก.พ.7", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  const deleted = await service.softDelete(doc.id);
  assert.ok(deleted);
  assert.equal(deleted.isActive, false);
});

test("softDelete returns null for non-existent document", async () => {
  const { service } = setup();
  const result = await service.softDelete(999);
  assert.equal(result, null);
});

test("getHistory returns all versions including inactive", async () => {
  const { service } = setup();
  await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "v1", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  await service.upload({
    officerPk: 5, officerId: "test", documentType: "GP7",
    title: "v2", bytes: pdfBytes(), mimeType: "application/pdf",
  });
  const history = await service.getHistory(5, "GP7");
  assert.equal(history.length, 2);
});

test("storage rollback on DB failure", async () => {
  const fakeDb = new FakeDb();
  const storage = new FakeStorage();
  const repo = new DocumentRepository(fakeDb as unknown as DatabaseClient);

  // Override create to simulate DB failure
  const originalCreate = fakeDb.officerDocument.create.bind(fakeDb.officerDocument);
  let callCount = 0;
  (fakeDb.officerDocument as unknown as { create: typeof originalCreate }).create = async (args) => {
    callCount += 1;
    if (callCount === 1) throw new Error("DB write failed");
    return originalCreate(args);
  };

  const service = new DocumentUploadService({ repository: repo, storage });
  await assert.rejects(
    () => service.upload({
      officerPk: 5, officerId: "test", documentType: "GP7",
      title: "test", bytes: pdfBytes(), mimeType: "application/pdf",
    }),
    DocumentUploadError
  );

  // The storage rollback should have been called.
  assert.equal(storage.removed.length, 1);
});
