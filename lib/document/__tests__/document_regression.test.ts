/**
 * Regression tests for Phase 29B.1 — Download and History storage isolation.
 *
 * Proves:
 *   1. getHistory() never calls storage — works when Storage is unavailable.
 *   2. getDownloadInfo() never calls storage — works when Storage is unavailable.
 *   3. Both operations share the same service layer as upload, just without
 *      the storage write path being exercised.
 *
 * Run with:
 *   npx tsx --test lib/document/__tests__/document_regression.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { DocumentUploadService } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";
import type { OfficerDocument } from "@/lib/database/database_types";
import type { DatabaseClient } from "@/lib/database/database_types";

// ── Fakes ─────────────────────────────────────────────────────────────────────

/**
 * Storage that records whether put() was called, so tests can assert
 * storage was NOT touched during read-only operations.
 */
class SpyStorage implements PortraitStorage {
  putCalled = false;
  removeCalled = false;

  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    void input;
    this.putCalled = true;
    throw new Error("Storage not configured — SpyStorage put() was called unexpectedly");
  }
  async remove(path: string): Promise<void> {
    void path;
    this.removeCalled = true;
  }
}

/** Working storage for seeding documents that need a real fileUrl. */
class WorkingStorage implements PortraitStorage {
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    return {
      storagePath: input.storagePath,
      publicUrl: `https://storage.test/${input.storagePath}`,
      thumbnailUrl: `https://storage.test/thumb/${input.storagePath}`,
    };
  }
  async remove(path: string): Promise<void> { void path; }
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
        if (matches) { Object.assign(r, args.data); count += 1; }
      }
      return { count };
    },
    upsert: async () => { throw new Error("not implemented"); },
    deleteMany: async () => ({ count: 0 }),
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
  b.set([0x25, 0x50, 0x44, 0x46]);
  return b;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a service backed by WorkingStorage and seeds one document. */
async function seedDocument(db: FakeDb) {
  const working = new WorkingStorage();
  const repo = new DocumentRepository(db as unknown as DatabaseClient);
  const seedService = new DocumentUploadService({ repository: repo, storage: working });
  return seedService.upload({
    officerPk: 1, officerId: "test",
    documentType: "GP7", title: "ก.พ.7",
    bytes: pdfBytes(), mimeType: "application/pdf",
    originalFilename: "kp7.pdf",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("History — storage isolation", () => {
  test("getHistory() does not call storage.put() or storage.remove()", async () => {
    const db = new FakeDb();
    await seedDocument(db);

    // Switch to SpyStorage — if storage is called, test fails
    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    const history = await service.getHistory(1, "GP7");
    assert.equal(history.length, 1, "history must return the seeded document");
    assert.equal(spy.putCalled, false, "storage.put() must NOT be called during getHistory()");
    assert.equal(spy.removeCalled, false, "storage.remove() must NOT be called during getHistory()");
  });

  test("getHistory() returns results even when storage would throw on put()", async () => {
    const db = new FakeDb();
    await seedDocument(db);

    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    // getHistory must succeed even though storage.put() would throw
    const history = await service.getHistory(1, "GP7");
    assert.ok(history.length > 0, "history must not be empty");
  });

  test("getHistory() returns empty array for unknown type regardless of storage state", async () => {
    const db = new FakeDb();
    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    const history = await service.getHistory(99, "UNKNOWN_TYPE");
    assert.deepEqual(history, []);
    assert.equal(spy.putCalled, false);
  });

  test("listActive() does not call storage", async () => {
    const db = new FakeDb();
    await seedDocument(db);

    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    await service.listActive(1);
    assert.equal(spy.putCalled, false, "storage.put() must NOT be called during listActive()");
  });
});

describe("Download — storage isolation", () => {
  test("getDownloadInfo() does not call storage.put() or storage.remove()", async () => {
    const db = new FakeDb();
    const doc = await seedDocument(db);

    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    const info = await service.getDownloadInfo(doc.id);
    assert.ok(info, "download info must be returned");
    assert.ok(info.fileUrl.startsWith("https://"), "fileUrl must be present");
    assert.equal(spy.putCalled, false, "storage.put() must NOT be called during getDownloadInfo()");
    assert.equal(spy.removeCalled, false, "storage.remove() must NOT be called during getDownloadInfo()");
  });

  test("getDownloadInfo() works when storage would throw on any write", async () => {
    const db = new FakeDb();
    const doc = await seedDocument(db);

    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    // Must not throw even though spy.put() would fail
    const info = await service.getDownloadInfo(doc.id);
    assert.ok(info !== null, "download info must succeed");
    assert.equal(info.filename, "kp7.pdf");
    assert.equal(info.mimeType, "application/pdf");
  });

  test("getDownloadInfo() returns null for non-existent document without touching storage", async () => {
    const db = new FakeDb();
    const spy = new SpyStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: spy });

    const info = await service.getDownloadInfo(9999);
    assert.equal(info, null);
    assert.equal(spy.putCalled, false);
  });
});

describe("Shared container — upload and download use same storage path", () => {
  test("upload produces a fileUrl that getDownloadInfo can read back", async () => {
    const db = new FakeDb();
    const working = new WorkingStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: working });

    const uploaded = await service.upload({
      officerPk: 1, officerId: "test",
      documentType: "NATIONAL_ID", title: "บัตรประชาชน",
      bytes: pdfBytes(), mimeType: "application/pdf",
      originalFilename: "id_card.pdf",
    });

    // Same service (same container) used for download — exactly as in production
    const info = await service.getDownloadInfo(uploaded.id);
    assert.ok(info, "download info must be available after upload");
    assert.equal(info.fileUrl, uploaded.fileUrl, "download fileUrl must match uploaded fileUrl");
    assert.equal(info.filename, "id_card.pdf");
  });

  test("replace (re-upload) updates fileUrl; getDownloadInfo returns the new version's URL", async () => {
    const db = new FakeDb();
    const working = new WorkingStorage();
    const repo = new DocumentRepository(db as unknown as DatabaseClient);
    const service = new DocumentUploadService({ repository: repo, storage: working });

    const v1 = await service.upload({
      officerPk: 1, officerId: "test",
      documentType: "PASSPORT", title: "Passport v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
      originalFilename: "passport_v1.pdf",
    });
    const v2 = await service.upload({
      officerPk: 1, officerId: "test",
      documentType: "PASSPORT", title: "Passport v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
      originalFilename: "passport_v2.pdf",
    });

    const infoV1 = await service.getDownloadInfo(v1.id);
    const infoV2 = await service.getDownloadInfo(v2.id);

    // v1 is now inactive — getDownloadInfo must return null
    assert.equal(infoV1, null, "v1 is inactive after replace; download must return null");
    assert.ok(infoV2, "v2 (active) must be downloadable");
    assert.equal(infoV2.filename, "passport_v2.pdf");
  });
});
