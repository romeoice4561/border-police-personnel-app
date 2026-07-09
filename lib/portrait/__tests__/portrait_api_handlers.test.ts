/**
 * Unit tests for the portrait API handlers (Phase 24B-1) over a real
 * PortraitUploadService backed by in-memory fakes — no running server.
 *
 * Run with:
 *   npx tsx --test lib/portrait/__tests__/portrait_api_handlers.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  handlePortraitUpload,
  handleGetCurrentPortrait,
  handlePortraitRemove,
} from "@/lib/portrait/portrait_api_handlers";
import { PortraitUploadService, type PortraitPhotoClient, type PortraitRow } from "@/lib/portrait/portrait_upload_service";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";

function pngBytes(): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  new DataView(b.buffer).setUint32(16, 64);
  new DataView(b.buffer).setUint32(20, 64);
  return b;
}

class FakeStorage implements PortraitStorage {
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    return {
      storagePath: input.storagePath,
      publicUrl: `https://s.test/${input.storagePath}`,
      thumbnailUrl: `https://s.test/t/${input.storagePath}`,
    };
  }
  async remove(): Promise<void> {}
}

class FakeDb implements PortraitPhotoClient {
  rows: PortraitRow[] = [];
  private nextId = 1;
  readonly profilePhoto: PortraitPhotoClient["profilePhoto"];

  constructor() {
    const rows = this.rows;
    this.profilePhoto = {
      findMany: async (args) => {
        const w = args?.where ?? {};
        return rows.filter((r) => Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
      },
      create: async (args) => {
        const row = { id: this.nextId++, updatedAt: new Date(), ...(args.data as object) } as PortraitRow;
        rows.push(row);
        return { ...row };
      },
      update: async (args) => {
        const row = rows.find((r) => r.id === (args.where as { id: number }).id)!;
        Object.assign(row, args.data);
        return { ...row };
      },
      updateMany: async (args) => {
        let count = 0;
        for (const r of rows) {
          const w = args.where;
          const not = w.NOT as { id?: number } | undefined;
          const ok = Object.entries(w).every(([k, v]) => k === "NOT" || (r as unknown as Record<string, unknown>)[k] === v) && (!not || r.id !== not.id);
          if (ok) {
            Object.assign(r, args.data);
            count += 1;
          }
        }
        return { count };
      },
    };
  }
}

function service() {
  return new PortraitUploadService({ db: new FakeDb(), storage: new FakeStorage() });
}

function uploadRequest(bytes: Uint8Array, type: string): Request {
  const form = new FormData();
  // Copy into a fresh ArrayBuffer so the Blob part type is unambiguous.
  const buf = bytes.slice().buffer;
  form.append("file", new Blob([buf], { type }), "portrait.png");
  return new Request("http://localhost/api/officers/x/portrait", { method: "POST", body: form });
}

test("POST uploads a valid portrait and returns 201 with the current portrait", async () => {
  const res = await handlePortraitUpload(service(), "ภาค1/5", uploadRequest(pngBytes(), "image/png"));
  assert.equal(res.status, 201);
  const json = (await res.json()) as { data: { officerId: string; isProfile: boolean } };
  assert.equal(json.data.officerId, "ภาค1/5");
  assert.equal(json.data.isProfile, true);
});

test("POST returns 400 for an unsupported type", async () => {
  const res = await handlePortraitUpload(service(), "ภาค1/5", uploadRequest(pngBytes(), "image/gif"));
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, "UNSUPPORTED_TYPE");
});

test("POST returns 400 when no file field is present", async () => {
  const req = new Request("http://localhost/api/officers/x/portrait", { method: "POST", body: new FormData() });
  const res = await handlePortraitUpload(service(), "ภาค1/5", req);
  assert.equal(res.status, 400);
});

test("GET returns 404 when the officer has no portrait", async () => {
  const res = await handleGetCurrentPortrait(service(), "ภาค1/5");
  assert.equal(res.status, 404);
});

test("upload then GET returns the current portrait", async () => {
  const svc = service();
  await handlePortraitUpload(svc, "ภาค1/5", uploadRequest(pngBytes(), "image/png"));
  const res = await handleGetCurrentPortrait(svc, "ภาค1/5");
  assert.equal(res.status, 200);
});

test("DELETE removes the current portrait and returns 200", async () => {
  const svc = service();
  await handlePortraitUpload(svc, "ภาค1/5", uploadRequest(pngBytes(), "image/png"));
  const res = await handlePortraitRemove(svc, "ภาค1/5");
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { current: unknown } };
  assert.equal(json.data.current, null);
});
