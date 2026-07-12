/**
 * Unit tests for DocumentRepository (Phase 29A — Officer Document Vault Foundation).
 *
 * Uses a minimal in-memory fake DatabaseClient — no running database or network.
 *
 * Run with:
 *   npx tsx --test lib/document/__tests__/document_repository.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { OfficerDocument } from "@/lib/database/database_types";
import type { DatabaseClient } from "@/lib/database/database_types";

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
      const orderBy = (args as { orderBy?: Record<string, "asc" | "desc"> })?.orderBy;
      if (orderBy) {
        const [field, dir] = Object.entries(orderBy)[0];
        result.sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field] as number;
          const bv = (b as unknown as Record<string, unknown>)[field] as number;
          return dir === "asc" ? av - bv : bv - av;
        });
      }
      return result;
    },
    create: async (args) => {
      const row = { id: this.nextId++, ...args.data } as unknown as OfficerDocument;
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

function makeRepo() {
  const fakeDb = new FakeDb();
  const repo = new DocumentRepository(fakeDb as unknown as DatabaseClient);
  return { repo, db: fakeDb };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("findAllForOfficer returns empty array when no rows", async () => {
  const { repo } = makeRepo();
  const rows = await repo.findAllForOfficer(10);
  assert.deepEqual(rows, []);
});

test("create then findById returns the row", async () => {
  const { repo } = makeRepo();
  const created = await repo.create(10, {
    documentType: "GP7",
    title: "ก.พ.7",
    description: null,
    storagePath: "path/to/file.pdf",
    fileUrl: "https://s.test/file.pdf",
    originalFilename: "gp7.pdf",
    mimeType: "application/pdf",
    fileSize: 2048,
    uploadedAt: new Date(),
    uploadedBy: null,
    version: 1,
  });
  const found = await repo.findById(created.id);
  assert.ok(found);
  assert.equal(found.documentType, "GP7");
  assert.equal(found.isActive, true);
  assert.equal(found.version, 1);
});

test("findActiveForOfficer excludes inactive rows", async () => {
  const { repo } = makeRepo();
  await repo.create(10, {
    documentType: "GP7", title: "ก.พ.7", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  // Manually create an inactive row by creating then soft-deleting.
  const row2 = await repo.create(10, {
    documentType: "PASSPORT", title: "Passport", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  await repo.softDelete(row2.id);

  const active = await repo.findActiveForOfficer(10);
  assert.equal(active.length, 1);
  assert.equal(active[0].documentType, "GP7");
});

test("demoteActiveForType sets isActive=false on all matching rows", async () => {
  const { repo } = makeRepo();
  await repo.create(10, {
    documentType: "GP7", title: "ก.พ.7", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  await repo.create(10, {
    documentType: "GP7", title: "ก.พ.7 v2", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 2,
  });

  const count = await repo.demoteActiveForType(10, "GP7");
  assert.equal(count, 2);

  const active = await repo.findActiveForOfficer(10);
  assert.equal(active.length, 0);
});

test("maxVersionForType returns 0 when no rows exist", async () => {
  const { repo } = makeRepo();
  const max = await repo.maxVersionForType(10, "GP7");
  assert.equal(max, 0);
});

test("maxVersionForType returns the highest version", async () => {
  const { repo } = makeRepo();
  await repo.create(10, {
    documentType: "GP7", title: "v1", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  await repo.create(10, {
    documentType: "GP7", title: "v3", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 3,
  });
  const max = await repo.maxVersionForType(10, "GP7");
  assert.equal(max, 3);
});

test("softDelete sets isActive=false", async () => {
  const { repo } = makeRepo();
  const row = await repo.create(10, {
    documentType: "GP7", title: "ก.พ.7", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  const deleted = await repo.softDelete(row.id);
  assert.ok(deleted);
  assert.equal(deleted.isActive, false);
});

test("softDelete returns null for already-inactive row", async () => {
  const { repo } = makeRepo();
  const row = await repo.create(10, {
    documentType: "GP7", title: "ก.พ.7", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  await repo.softDelete(row.id);
  const again = await repo.softDelete(row.id);
  assert.equal(again, null);
});

test("countForOfficer counts all rows regardless of isActive", async () => {
  const { repo } = makeRepo();
  await repo.create(10, {
    documentType: "GP7", title: "v1", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 1,
  });
  const row2 = await repo.create(10, {
    documentType: "GP7", title: "v2", description: null,
    storagePath: null, fileUrl: null, originalFilename: null,
    mimeType: null, fileSize: null, uploadedAt: null, uploadedBy: null, version: 2,
  });
  await repo.softDelete(row2.id);
  const count = await repo.countForOfficer(10);
  assert.equal(count, 2);
});
