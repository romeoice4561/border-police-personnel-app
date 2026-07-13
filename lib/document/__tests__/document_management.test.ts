/**
 * Unit tests for Phase 29B document management operations:
 * Replace, History ordering, Version increment, Soft delete, Download info.
 *
 * Uses in-memory fakes (no network, no live DB) — same fakes as
 * document_upload_service.test.ts.
 *
 * Run with:
 *   npx tsx --test lib/document/__tests__/document_management.test.ts
 */

import { test, describe } from "node:test";
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
  shouldFail = false;

  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    if (this.shouldFail) throw new Error("Storage unavailable");
    this.calls.push(input);
    return {
      storagePath: input.storagePath,
      publicUrl: `https://storage.test/${input.storagePath}`,
      thumbnailUrl: `https://storage.test/thumb/${input.storagePath}`,
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
    deleteMany: async (args) => {
      const w = (args?.where ?? {}) as Record<string, unknown>;
      const before = this.rows.length;
      this.rows = this.rows.filter((r) =>
        !Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
      );
      return { count: before - this.rows.length };
    },
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

const OFFICER_PK = 7;
const OFFICER_ID = "ภาค4/999";

// ── Replace (version increment) ───────────────────────────────────────────────

describe("Replace", () => {
  test("second upload increments version to 2 and demotes v1", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const v2 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7 ฉบับใหม่",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    assert.equal(v2.version, 2, "v2 should have version=2");
    assert.equal(v2.isActive, true, "v2 should be active");

    const v1Updated = await service.getById(v1.id);
    assert.ok(v1Updated, "v1 row must still exist");
    assert.equal(v1Updated.isActive, false, "v1 should be demoted to inactive");
  });

  test("third upload increments version to 3 monotonically", async () => {
    const { service } = setup();
    for (let i = 1; i <= 3; i++) {
      await service.upload({
        officerPk: OFFICER_PK, officerId: OFFICER_ID,
        documentType: "NATIONAL_ID", title: `บัตรประชาชน v${i}`,
        bytes: pdfBytes(), mimeType: "application/pdf",
      });
    }
    const active = await service.listActive(OFFICER_PK);
    const natId = active.find((d) => d.documentType === "NATIONAL_ID");
    assert.ok(natId, "active NATIONAL_ID doc must exist");
    assert.equal(natId.version, 3, "should be on version 3");
  });

  test("replace stores a new file in storage for each version", async () => {
    const { service, storage } = setup();
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport renewed",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    assert.equal(storage.calls.length, 2, "two separate storage uploads expected");
    // Both paths share the document type namespace
    assert.ok(storage.calls.every((c) => c.storagePath.includes("PASSPORT")));
  });

  test("replace of a different type does not demote the other type", async () => {
    const { service } = setup();
    const gpDoc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    // GP7 should still be active and at version 1
    const gpUpdated = await service.getById(gpDoc.id);
    assert.ok(gpUpdated, "GP7 doc must exist");
    assert.equal(gpUpdated.isActive, true, "GP7 must remain active");
    assert.equal(gpUpdated.version, 1, "GP7 version must remain 1");
  });
});

// ── History ordering ──────────────────────────────────────────────────────────

describe("History", () => {
  test("getHistory returns all versions including inactive, newest version first", async () => {
    const { service } = setup();
    for (let i = 0; i < 4; i++) {
      await service.upload({
        officerPk: OFFICER_PK, officerId: OFFICER_ID,
        documentType: "GP7", title: `v${i + 1}`,
        bytes: pdfBytes(), mimeType: "application/pdf",
      });
    }
    const history = await service.getHistory(OFFICER_PK, "GP7");
    assert.equal(history.length, 4, "all 4 versions should be in history");
    // Newest (v4) first
    assert.equal(history[0].version, 4);
    assert.equal(history[history.length - 1].version, 1);
    // Strictly descending
    for (let i = 0; i < history.length - 1; i++) {
      assert.ok(history[i].version > history[i + 1].version, "versions must be descending");
    }
  });

  test("getHistory for unknown type returns empty array", async () => {
    const { service } = setup();
    const history = await service.getHistory(OFFICER_PK, "NON_EXISTENT_TYPE");
    assert.deepEqual(history, []);
  });

  test("getHistory includes both active and inactive documents", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "DRIVER_LICENSE", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "DRIVER_LICENSE", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    const history = await service.getHistory(OFFICER_PK, "DRIVER_LICENSE");
    assert.equal(history.length, 2);
    const v1InHistory = history.find((h) => h.id === v1.id);
    assert.ok(v1InHistory, "v1 (now inactive) must appear in history");
    assert.equal(v1InHistory.isActive, false, "v1 must show as inactive");
  });
});

// ── Soft delete ───────────────────────────────────────────────────────────────

describe("Soft delete", () => {
  test("softDelete sets isActive=false and row remains accessible", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const deleted = await service.softDelete(doc.id);
    assert.ok(deleted, "softDelete must return the updated row");
    assert.equal(deleted.isActive, false);

    // Row still accessible via getById
    const fetched = await service.getById(doc.id);
    assert.ok(fetched, "row must still be retrievable after soft-delete");
    assert.equal(fetched.isActive, false);
  });

  test("softDelete of already-inactive document returns null", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.softDelete(doc.id);
    const result = await service.softDelete(doc.id); // second call
    assert.equal(result, null, "second softDelete must return null");
  });

  test("softDelete of non-existent id returns null", async () => {
    const { service } = setup();
    const result = await service.softDelete(9999);
    assert.equal(result, null);
  });

  test("soft-deleted document no longer appears in listActive", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.softDelete(doc.id);
    const active = await service.listActive(OFFICER_PK);
    assert.equal(active.length, 0, "no active documents after soft-delete");
  });

  test("soft-deleted document still appears in getHistory", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.softDelete(doc.id);
    const history = await service.getHistory(OFFICER_PK, "GP7");
    assert.equal(history.length, 1, "soft-deleted doc must appear in history");
    assert.equal(history[0].isActive, false);
  });
});

// ── Download info ─────────────────────────────────────────────────────────────

describe("Download info", () => {
  test("getDownloadInfo returns fileUrl and metadata for active document", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
      originalFilename: "kp7_2026.pdf",
    });
    const info = await service.getDownloadInfo(doc.id);
    assert.ok(info, "download info must be returned for active doc");
    assert.ok(info.fileUrl.startsWith("https://"), "fileUrl must be a URL");
    assert.equal(info.filename, "kp7_2026.pdf");
    assert.equal(info.mimeType, "application/pdf");
  });

  test("getDownloadInfo uses fallback filename when originalFilename is null", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport",
      bytes: pdfBytes(), mimeType: "application/pdf",
      // no originalFilename
    });
    const info = await service.getDownloadInfo(doc.id);
    assert.ok(info, "download info must be returned");
    assert.ok(info.filename.startsWith("document-"), `fallback name must start with 'document-', got: ${info.filename}`);
  });

  test("getDownloadInfo returns null for non-existent document", async () => {
    const { service } = setup();
    const info = await service.getDownloadInfo(9999);
    assert.equal(info, null);
  });

  test("getDownloadInfo returns null for soft-deleted document", async () => {
    const { service } = setup();
    const doc = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "ก.พ.7",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.softDelete(doc.id);
    const info = await service.getDownloadInfo(doc.id);
    assert.equal(info, null, "inactive doc must not be downloadable");
  });

  test("getDownloadInfo returns null when fileUrl is null", async () => {
    const { service, fakeDb } = setup();
    // Manually insert a row with no fileUrl
    const row: OfficerDocument = {
      id: 999, officerId: OFFICER_PK, documentType: "GP7", title: "no file",
      description: null, storagePath: null, fileUrl: null,
      originalFilename: null, mimeType: null, fileSize: null,
      uploadedAt: null, uploadedBy: null, verifiedAt: null, verifiedBy: null,
      version: 1, isActive: true,
      createdAt: new Date(), updatedAt: new Date(),
    };
    fakeDb.rows.push(row);
    const info = await service.getDownloadInfo(999);
    assert.equal(info, null, "doc with no fileUrl must not be downloadable");
  });
});

// ── Regression: upload does not affect other officers ────────────────────────

describe("Regression", () => {
  test("uploading for officer A does not affect officer B documents", async () => {
    const { service } = setup();
    await service.upload({
      officerPk: 1, officerId: "officer-A",
      documentType: "GP7", title: "ก.พ.7 A",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: 2, officerId: "officer-B",
      documentType: "GP7", title: "ก.พ.7 B",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: 1, officerId: "officer-A",
      documentType: "GP7", title: "ก.พ.7 A v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    const bActive = await service.listActive(2);
    assert.equal(bActive.length, 1, "officer B must still have 1 active document");
    assert.equal(bActive[0].version, 1, "officer B version must still be 1");
  });

  test("DocumentUploadError thrown for validation failures", async () => {
    const { service } = setup();
    await assert.rejects(
      () =>
        service.upload({
          officerPk: OFFICER_PK, officerId: OFFICER_ID,
          documentType: "GP7", title: "test",
          bytes: new Uint8Array(0), mimeType: "application/pdf",
        }),
      (err: unknown) => {
        assert.ok(err instanceof DocumentUploadError);
        assert.equal(err.code, "EMPTY");
        return true;
      }
    );
  });
});

// ── PART 2 / PART 7: softDeleteWithPromotion ─────────────────────────────────

describe("softDeleteWithPromotion (PART 2 / PART 7)", () => {
  test("deleting v2 (active) promotes v1 to active", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const v2 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    const result = await service.softDeleteWithPromotion(v2.id);
    assert.ok(result, "must return a result");
    assert.equal(result.deleted.id, v2.id, "deleted must be v2");
    assert.equal(result.deleted.isActive, false, "v2 must be inactive");
    assert.ok(result.promoted, "v1 must be promoted");
    assert.equal(result.promoted.id, v1.id, "promoted must be v1");
    assert.equal(result.promoted.isActive, true, "v1 must now be active");
  });

  test("deleting v3 (active) promotes v2 (latest inactive)", async () => {
    const { service } = setup();
    for (let i = 1; i <= 3; i++) {
      await service.upload({
        officerPk: OFFICER_PK, officerId: OFFICER_ID,
        documentType: "NATIONAL_ID", title: `v${i}`,
        bytes: pdfBytes(), mimeType: "application/pdf",
      });
    }
    const history = await service.getHistory(OFFICER_PK, "NATIONAL_ID");
    const v3 = history.find((h) => h.version === 3)!;
    const v2 = history.find((h) => h.version === 2)!;

    const result = await service.softDeleteWithPromotion(v3.id);
    assert.ok(result?.promoted, "v2 must be promoted");
    assert.equal(result.promoted.version, 2, "latest inactive is v2");
    assert.equal(result.promoted.isActive, true, "v2 must be active");

    // v1 must remain inactive
    const v1 = await service.getById(history.find((h) => h.version === 1)!.id);
    assert.equal(v1?.isActive, false, "v1 must still be inactive");

    // Only one active document for this type
    const active = await service.listActive(OFFICER_PK);
    const natId = active.filter((d) => d.documentType === "NATIONAL_ID");
    assert.equal(natId.length, 1, "exactly one active NATIONAL_ID doc");
    assert.equal(natId[0].version, 2, "promoted to v2");
    void v2; // used for comment clarity only
  });

  test("deleting only version returns promoted=null", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    const result = await service.softDeleteWithPromotion(v1.id);
    assert.ok(result, "must return a result");
    assert.equal(result.deleted.id, v1.id);
    assert.equal(result.promoted, null, "no version to promote");

    const active = await service.listActive(OFFICER_PK);
    assert.equal(
      active.filter((d) => d.documentType === "PASSPORT").length,
      0,
      "no active PASSPORT doc after deleting only version"
    );
  });

  test("softDeleteWithPromotion on already-inactive version returns null", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    // Replace to make v1 inactive
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    // v1 is now inactive — softDeleteWithPromotion must return null
    const result = await service.softDeleteWithPromotion(v1.id);
    assert.equal(result, null, "must return null for inactive version");
  });

  test("deleting from one type does not affect another type", async () => {
    const { service } = setup();
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "GP7 v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const passportV1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const passportV2 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "PASSPORT", title: "Passport v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    // Delete passport v2 → v1 promoted
    await service.softDeleteWithPromotion(passportV2.id);

    // GP7 must remain active and untouched
    const active = await service.listActive(OFFICER_PK);
    const gp7 = active.find((d) => d.documentType === "GP7");
    assert.ok(gp7, "GP7 must still be active");
    assert.equal(gp7.version, 1, "GP7 version must still be 1");

    const passport = active.find((d) => d.documentType === "PASSPORT");
    assert.ok(passport, "PASSPORT must be active after promotion");
    assert.equal(passport.id, passportV1.id, "PASSPORT active must be v1");
  });
});

// ── PART 3: deleteVersion ─────────────────────────────────────────────────────

describe("deleteVersion (PART 3 — per-history-version delete)", () => {
  test("deleteVersion on active version soft-deletes and promotes", async () => {
    const { service } = setup();
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    const v2 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    const result = await service.deleteVersion(v2.id);
    assert.ok(result?.promoted, "v1 must be promoted");
    assert.equal(result.promoted.version, 1);

    // v2 row still exists (soft-deleted), but inactive
    const v2Row = await service.getById(v2.id);
    assert.ok(v2Row, "soft-deleted row must still exist");
    assert.equal(v2Row.isActive, false);
  });

  test("deleteVersion on inactive version physically removes the row", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    // Replace to make v1 inactive
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "GP7", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    // v1 is now inactive — deleteVersion physically removes it
    const result = await service.deleteVersion(v1.id);
    assert.ok(result, "must return a result");
    assert.equal(result.promoted, null, "no promotion for inactive version");

    // Row must be gone from DB
    const v1Row = await service.getById(v1.id);
    assert.equal(v1Row, null, "inactive version must be physically deleted");

    // Active v2 must remain
    const active = await service.listActive(OFFICER_PK);
    assert.equal(active.length, 1, "v2 must still be active");
    assert.equal(active[0].version, 2, "active version is v2");
  });

  test("deleteVersion on non-existent id returns null", async () => {
    const { service } = setup();
    const result = await service.deleteVersion(9999);
    assert.equal(result, null);
  });

  test("deleteVersion: after deleting inactive history, getHistory shrinks", async () => {
    const { service } = setup();
    const v1 = await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "NATIONAL_ID", title: "v1",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "NATIONAL_ID", title: "v2",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });
    await service.upload({
      officerPk: OFFICER_PK, officerId: OFFICER_ID,
      documentType: "NATIONAL_ID", title: "v3",
      bytes: pdfBytes(), mimeType: "application/pdf",
    });

    // History has 3 entries; v1 and v2 are inactive
    const historyBefore = await service.getHistory(OFFICER_PK, "NATIONAL_ID");
    assert.equal(historyBefore.length, 3);

    // Delete v1 (inactive) from history
    await service.deleteVersion(v1.id);

    const historyAfter = await service.getHistory(OFFICER_PK, "NATIONAL_ID");
    assert.equal(historyAfter.length, 2, "history must shrink by one after hard-delete");
    assert.ok(!historyAfter.find((h) => h.id === v1.id), "v1 must be gone from history");
  });
});
