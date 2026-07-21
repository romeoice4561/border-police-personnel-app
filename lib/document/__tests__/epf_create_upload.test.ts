/**
 * Phase 49A.3 — e-PF Create/Upload mode helpers + category binding.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCreateUploadFormData,
  canSubmitCreateUpload,
  categoryCodeForType,
  createUploadDisabledReason,
  defaultTitleForTypeCode,
  fileTypeLabel,
  formatFileSizeBytes,
  resolveEpfDrawerMode,
  validateSelectedFile,
} from "@/lib/document/epf_create_upload";
import { DOCUMENT_CATEGORIES } from "@/lib/document/document_categories";
import { DocumentUploadService } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";
import type { OfficerDocument } from "@/lib/database/database_types";
import type { DatabaseClient } from "@/lib/database/database_types";
import { translate } from "@/lib/i18n/dictionary";

function fakeFile(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

test("อัปโหลดเอกสารแรก resolves to Create mode, not details-only", () => {
  assert.equal(resolveEpfDrawerMode(false, "create"), "create");
  assert.equal(resolveEpfDrawerMode(false, "details"), "create");
  assert.equal(resolveEpfDrawerMode(true, "details"), "details");
});

test("upload button disabled before file selection; enabled after valid PDF", () => {
  assert.equal(createUploadDisabledReason({ file: null, title: "GP7", busy: false }), "no_file");
  assert.equal(canSubmitCreateUpload({ file: null, title: "GP7", busy: false }), false);

  const pdf = fakeFile("doc.pdf", "application/pdf", 1200);
  assert.equal(createUploadDisabledReason({ file: pdf, title: "GP7", busy: false }), null);
  assert.equal(canSubmitCreateUpload({ file: pdf, title: "GP7", busy: false }), true);
});

test("selected file is retained in FormData with correct type binding", async () => {
  const file = fakeFile("id-card.jpg", "image/jpeg", 2048);
  const form = buildCreateUploadFormData({
    file,
    documentType: "NATIONAL_ID",
    title: "National ID Card",
    description: "optional note",
  });
  assert.equal(form.get("documentType"), "NATIONAL_ID");
  assert.equal(form.get("title"), "National ID Card");
  assert.equal(form.get("description"), "optional note");
  const attached = form.get("file");
  assert.ok(attached instanceof File);
  assert.equal((attached as File).name, "id-card.jpg");
  assert.equal((attached as File).type, "image/jpeg");
});

test("valid PDF / JPG / PNG accepted; unsupported and empty rejected", () => {
  assert.equal(validateSelectedFile(fakeFile("a.pdf", "application/pdf", 100)).ok, true);
  assert.equal(validateSelectedFile(fakeFile("a.jpg", "image/jpeg", 100)).ok, true);
  assert.equal(validateSelectedFile(fakeFile("a.png", "image/png", 100)).ok, true);
  assert.equal(validateSelectedFile(fakeFile("a.gif", "image/gif", 100)).ok, false);
  assert.equal(validateSelectedFile(fakeFile("empty.pdf", "application/pdf", 0)).ok, false);
  const oversized = fakeFile("big.pdf", "application/pdf", 11 * 1024 * 1024);
  assert.equal(validateSelectedFile(oversized).ok, false);
});

test("category binding: upload type maps to the category the user clicked", () => {
  assert.equal(categoryCodeForType("NATIONAL_ID"), "IDENTITY");
  assert.equal(categoryCodeForType("EDUCATION_CERTIFICATE"), "EDUCATION");
  assert.equal(categoryCodeForType("TRAINING_CERTIFICATE"), "TRAINING");
  assert.equal(categoryCodeForType("GP7"), "OFFICIAL_PERSONNEL");
  assert.equal(categoryCodeForType("AWARD"), "AWARDS");
  // Empty-category first type stays inside that category's registry list.
  for (const cat of DOCUMENT_CATEGORIES) {
    const first = cat.typeCodes[0];
    if (!first) continue;
    assert.equal(categoryCodeForType(first), cat.code, `${first} must stay in ${cat.code}`);
  }
});

test("default title and file labels follow registry / MIME", () => {
  assert.equal(defaultTitleForTypeCode("NATIONAL_ID"), "National ID Card");
  assert.equal(fileTypeLabel(fakeFile("x.pdf", "application/pdf", 10)), "PDF");
  assert.equal(formatFileSizeBytes(1536), "1.5 KB");
});

test("Create/Upload TH/EN labels follow active language", () => {
  assert.equal(translate("epf.createUploadTitle", "th"), "อัปโหลดเอกสาร");
  assert.equal(translate("epf.createUploadTitle", "en"), "Upload Document");
  assert.equal(translate("epf.createUploadSubmit", "th"), "อัปโหลดและบันทึก");
  assert.equal(translate("epf.createUploadSelectFile", "th"), "เลือกไฟล์เอกสาร");
  assert.equal(translate("epf.detailTitle", "th"), "รายละเอียดเอกสาร");
});

// ── Upload service: PDF once + correct documentType category ─────────────────

class FakeStorage implements PortraitStorage {
  calls: PutPortraitInput[] = [];
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    this.calls.push(input);
    return {
      storagePath: input.storagePath,
      publicUrl: `https://s.test/${input.storagePath}`,
      thumbnailUrl: `https://s.test/t/${input.storagePath}`,
    };
  }
  async remove(): Promise<void> {}
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
        const matches = Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v);
        if (matches) {
          Object.assign(r, args.data);
          count += 1;
        }
      }
      return { count };
    },
    upsert: async () => {
      throw new Error("not implemented");
    },
    deleteMany: async () => ({ count: 0 }),
    count: async (args) => {
      const w = (args?.where ?? {}) as Record<string, unknown>;
      return this.rows.filter((r) =>
        Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
      ).length;
    },
  } as DatabaseClient["officerDocument"];
}

function setupUploadService() {
  const fakeDb = new FakeDb();
  const storage = new FakeStorage();
  const service = new DocumentUploadService({
    repository: new DocumentRepository(fakeDb as unknown as DatabaseClient),
    storage,
  });
  return { service, storage, fakeDb };
}

test("upload API path: valid PDF persisted once under the requested documentType", async () => {
  const { service, storage } = setupUploadService();
  const bytes = new Uint8Array(64);
  const doc = await service.upload({
    officerPk: 1,
    officerId: "sector-1/1",
    documentType: "EDUCATION_CERTIFICATE",
    title: "Education Certificate",
    description: null,
    bytes,
    mimeType: "application/pdf",
    originalFilename: "edu.pdf",
    uploadedBy: null,
  });
  assert.equal(doc.documentType, "EDUCATION_CERTIFICATE");
  assert.equal(categoryCodeForType(doc.documentType), "EDUCATION");
  assert.equal(storage.calls.length, 1);
  assert.match(storage.calls[0].storagePath, /EDUCATION_CERTIFICATE/);
  assert.notEqual(categoryCodeForType(doc.documentType), "IDENTITY");
});

test("replace mode: second upload for same type increments version (history preserved)", async () => {
  const { service, storage, fakeDb } = setupUploadService();
  const bytes = new Uint8Array(32);
  await service.upload({
    officerPk: 1,
    officerId: "sector-1/1",
    documentType: "GP7",
    title: "GP7",
    bytes,
    mimeType: "application/pdf",
    originalFilename: "v1.pdf",
    uploadedBy: null,
  });
  const v2 = await service.upload({
    officerPk: 1,
    officerId: "sector-1/1",
    documentType: "GP7",
    title: "GP7",
    bytes,
    mimeType: "application/pdf",
    originalFilename: "v2.pdf",
    uploadedBy: null,
  });
  assert.equal(v2.version, 2);
  assert.equal(storage.calls.length, 2);
  assert.equal(fakeDb.rows.filter((r) => r.documentType === "GP7").length, 2);
});
