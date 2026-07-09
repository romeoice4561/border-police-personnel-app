/**
 * Unit tests for PortraitUploadService (Phase 24B-1) over in-memory fakes —
 * no live database, no network/Storage.
 *
 * Run with:
 *   npx tsx --test lib/portrait/__tests__/portrait_upload_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PortraitUploadService,
  PortraitUploadError,
  type PortraitPhotoClient,
  type PortraitRow,
} from "@/lib/portrait/portrait_upload_service";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";

/** A PNG byte blob with real IHDR dimensions, for a valid upload. */
function pngBytes(width = 100, height = 100): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

class FakeStorage implements PortraitStorage {
  puts: PutPortraitInput[] = [];
  removed: string[] = [];
  failPut = false;
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    if (this.failPut) throw new Error("storage down");
    this.puts.push(input);
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

class FakePortraitDb implements PortraitPhotoClient {
  rows: PortraitRow[] = [];
  private nextId = 1;
  failCreate = false;
  readonly profilePhoto: PortraitPhotoClient["profilePhoto"];

  constructor() {
    const rows = this.rows;
    this.profilePhoto = {
      findMany: async (args) => {
        const where = args?.where ?? {};
        let out = rows.filter((r) => matches(r, where));
        const orderBy = Array.isArray(args?.orderBy) ? args?.orderBy[0] : args?.orderBy;
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0];
          out = [...out].sort((a, b) => {
            const av = String((a as unknown as Record<string, unknown>)[field] ?? "");
            const bv = String((b as unknown as Record<string, unknown>)[field] ?? "");
            return (av > bv ? 1 : av < bv ? -1 : 0) * (dir === "asc" ? 1 : -1);
          });
        }
        return out.map((r) => ({ ...r }));
      },
      create: async (args) => {
        if (this.failCreate) throw new Error("db insert failed");
        const row = { id: this.nextId++, updatedAt: new Date(), ...(args.data as object) } as PortraitRow;
        rows.push(row);
        return { ...row };
      },
      update: async (args) => {
        const row = rows.find((r) => matches(r, args.where));
        if (!row) throw new Error("not found");
        Object.assign(row, args.data, { updatedAt: new Date() });
        return { ...row };
      },
      updateMany: async (args) => {
        let count = 0;
        for (const row of rows) {
          if (matches(row, args.where)) {
            Object.assign(row, args.data, { updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    };
  }
}

/** Minimal where-matcher supporting equality + a single NOT:{id} clause. */
function matches(row: PortraitRow, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "NOT") {
      const not = cond as Record<string, unknown>;
      if (Object.entries(not).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v)) return false;
      continue;
    }
    if ((row as unknown as Record<string, unknown>)[key] !== cond) return false;
  }
  return true;
}

function service(db: FakePortraitDb, storage: FakeStorage) {
  return new PortraitUploadService({ db, storage });
}

test("upload stores bytes, persists metadata, links the officer, and marks isProfile=true", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  const portrait = await service(db, storage).upload({
    officerId: "ภาค1/5",
    bytes: pngBytes(120, 120),
    mimeType: "image/png",
    uploadedBy: "staff-1",
  });

  assert.equal(storage.puts.length, 1);
  assert.equal(portrait.officerId, "ภาค1/5");
  assert.equal(portrait.isProfile, true);
  assert.equal(portrait.mimeType, "image/png");
  assert.deepEqual([portrait.width, portrait.height], [120, 120]);
  assert.equal(portrait.uploadedBy, "staff-1");

  const row = db.rows[0];
  assert.equal(row.matchStatus, "MANUAL_MATCHED");
  assert.equal(row.sourceType, "UPLOAD");
  assert.ok(row.driveFileId.startsWith("upload:"));
});

test("replacing a portrait keeps the old one (history) and flips isProfile", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  const svc = service(db, storage);

  const first = await svc.upload({ officerId: "off-1", bytes: pngBytes(), mimeType: "image/png" });
  const second = await svc.upload({ officerId: "off-1", bytes: pngBytes(), mimeType: "image/png" });

  assert.equal(db.rows.length, 2, "old portrait row is preserved, not deleted");
  const old = db.rows.find((r) => r.id === first.id)!;
  const current = db.rows.find((r) => r.id === second.id)!;
  assert.equal(old.isProfile, false, "old portrait demoted");
  assert.equal(current.isProfile, true, "new portrait is current");

  const resolved = await svc.getCurrentPortrait("off-1");
  assert.equal(resolved?.id, second.id);
});

test("a DB failure after storing rolls back the stored object (no orphan)", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  db.failCreate = true;

  await assert.rejects(
    () => service(db, storage).upload({ officerId: "off-1", bytes: pngBytes(), mimeType: "image/png" }),
    (e: unknown) => e instanceof PortraitUploadError && e.code === "STORAGE"
  );
  assert.equal(storage.puts.length, 1, "object was stored");
  assert.equal(storage.removed.length, 1, "stored object was rolled back");
});

test("upload rejects an invalid type before touching storage", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  await assert.rejects(
    () => service(db, storage).upload({ officerId: "off-1", bytes: pngBytes(), mimeType: "image/gif" }),
    (e: unknown) => e instanceof PortraitUploadError && e.code === "UNSUPPORTED_TYPE"
  );
  assert.equal(storage.puts.length, 0);
});

test("removeCurrent demotes the current portrait without deleting rows", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  const svc = service(db, storage);
  await svc.upload({ officerId: "off-1", bytes: pngBytes(), mimeType: "image/png" });

  const after = await svc.removeCurrent("off-1");
  assert.equal(after, null, "no current portrait after removal");
  assert.equal(db.rows.length, 1, "history row preserved");
  assert.equal(db.rows[0].isProfile, false);
});

test("getCurrentPortrait returns null when the officer has no portrait", async () => {
  const db = new FakePortraitDb();
  const storage = new FakeStorage();
  assert.equal(await service(db, storage).getCurrentPortrait("nobody"), null);
});
