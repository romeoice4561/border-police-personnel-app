/**
 * Phase 49A.3 — end-to-end Officer Document Vault verification for every
 * category / document type in DOCUMENT_CATEGORIES.
 *
 * Covers: Create/Upload binding, file select gate, metadata, upload,
 * immediate list presence, preview URL, download info, replace, history,
 * AI-ready badge contract (persisted-only), readiness recalculation.
 *
 * Run: npx tsx --test lib/document/__tests__/epf_vault_e2e_all_categories.test.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { DOCUMENT_CATEGORIES, categoryForTypeCode } from "@/lib/document/document_categories";
import {
  buildCreateUploadFormData,
  canSubmitCreateUpload,
  createUploadDisabledReason,
  defaultTitleForTypeCode,
  resolveEpfDrawerMode,
  validateSelectedFile,
} from "@/lib/document/epf_create_upload";
import { DocumentUploadService } from "@/lib/document/document_upload_service";
import { DocumentRepository } from "@/lib/database/repositories/document_repository";
import type { PortraitStorage, PutPortraitInput, StoredPortrait } from "@/lib/portrait/portrait_storage";
import type { OfficerDocument } from "@/lib/database/database_types";
import type { DatabaseClient } from "@/lib/database/database_types";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { findDocumentType } from "@/lib/document/document_types";

const ROOT = path.resolve(process.cwd());

function readSource(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function fakeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

class WorkingStorage implements PortraitStorage {
  objects = new Map<string, Uint8Array>();
  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    this.objects.set(input.storagePath, input.bytes);
    return {
      storagePath: input.storagePath,
      publicUrl: `https://storage.test/${input.storagePath}`,
      thumbnailUrl: `https://storage.test/thumb/${input.storagePath}`,
    };
  }
  async remove(storagePath: string): Promise<void> {
    this.objects.delete(storagePath);
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
        const [field, dir] = Object.entries(orderBy)[0] ?? [];
        if (field && dir) {
          result.sort((a, b) => {
            const av = (a as unknown as Record<string, unknown>)[field];
            const bv = (b as unknown as Record<string, unknown>)[field];
            if (typeof av === "number" && typeof bv === "number") {
              return dir === "asc" ? av - bv : bv - av;
            }
            return 0;
          });
        }
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

function setup() {
  const db = new FakeDb();
  const storage = new WorkingStorage();
  const service = new DocumentUploadService({
    repository: new DocumentRepository(db as unknown as DatabaseClient),
    storage,
  });
  return { db, storage, service };
}

const ALL_TYPE_CODES = DOCUMENT_CATEGORIES.flatMap((c) => [...c.typeCodes]);

test("UI wiring: empty-category อัปโหลดเอกสารแรก opens Create Upload per type (not details-only)", () => {
  const section = readSource("components/officer/epf/epf_section.tsx");
  const group = readSource("components/officer/epf/epf_category_group.tsx");
  const drawer = readSource("components/officer/epf/epf_create_upload_drawer.tsx");
  const card = readSource("components/officer/epf/epf_document_card.tsx");

  assert.match(section, /EpfCreateUploadDrawer/);
  assert.match(section, /onUploadFirst=\{openCreateUpload\}/);
  assert.match(section, /setCreateTypeCode/);
  assert.doesNotMatch(group, /onOpenDetails\(rows\[0\]\.code\)/);
  assert.match(group, /onUploadFirst\(row\.code\)/);
  assert.match(group, /epf-upload-first-\$\{row\.code\}/);
  assert.match(drawer, /epf-create-dropzone/);
  assert.match(drawer, /type="file"/);
  assert.match(drawer, /epf\.createUploadSubmit/);
  assert.match(card, /onOpenCreateUpload/);
  assert.match(card, /else onOpenCreateUpload\(\)/);
});

test("every category type: Create mode + file picker gate + metadata FormData", () => {
  for (const typeCode of ALL_TYPE_CODES) {
    assert.equal(resolveEpfDrawerMode(false, "create"), "create", typeCode);
    assert.equal(createUploadDisabledReason({ file: null, title: defaultTitleForTypeCode(typeCode), busy: false }), "no_file", typeCode);

    const pdf = fakeFile(`${typeCode}.pdf`, "application/pdf", 512);
    assert.equal(validateSelectedFile(pdf).ok, true, typeCode);
    assert.equal(canSubmitCreateUpload({ file: pdf, title: defaultTitleForTypeCode(typeCode), busy: false }), true, typeCode);

    const form = buildCreateUploadFormData({
      file: pdf,
      documentType: typeCode,
      title: defaultTitleForTypeCode(typeCode),
      description: `meta-${typeCode}`,
    });
    assert.equal(form.get("documentType"), typeCode);
    assert.equal(form.get("description"), `meta-${typeCode}`);
    assert.ok(findDocumentType(typeCode), `registry must include ${typeCode}`);
    assert.equal(categoryForTypeCode(typeCode).code, DOCUMENT_CATEGORIES.find((c) => c.typeCodes.includes(typeCode))!.code);
  }
});

test("every category type: upload → appears → preview URL → download info → replace → history → readiness → AI contract", async () => {
  const { service, db } = setup();
  const officerId = "vault-e2e/1";
  const officerPk = 9001;
  const uploaded: OfficerDocument[] = [];

  const before = composeOfficerDocumentIntelligence({ officerId, officerPk, documents: [] });
  assert.equal(before.readinessLevel, "INCOMPLETE");
  assert.ok(before.missingRequiredCount > 0);

  for (const typeCode of ALL_TYPE_CODES) {
    const bytes = new Uint8Array(64);
    bytes[0] = 0x25; // %PDF-ish marker for uniqueness only
    const doc = await service.upload({
      officerPk,
      officerId,
      documentType: typeCode,
      title: defaultTitleForTypeCode(typeCode),
      description: `desc-${typeCode}`,
      bytes,
      mimeType: "application/pdf",
      originalFilename: `${typeCode}.pdf`,
      uploadedBy: "e2e",
    });

    // Immediate presence in active list
    const active = await service.listActive(officerPk);
    assert.ok(active.some((d) => d.id === doc.id && d.documentType === typeCode), `${typeCode} must appear immediately`);
    assert.equal(categoryForTypeCode(doc.documentType).code, categoryForTypeCode(typeCode).code);

    // Preview works when fileUrl present (card/detail use fileUrl)
    assert.ok(doc.fileUrl, `${typeCode} preview requires fileUrl`);
    assert.match(doc.fileUrl, /^https:\/\/storage\.test\//);

    // Download info (handler proxies this URL)
    const download = await service.getDownloadInfo(doc.id);
    assert.ok(download, `${typeCode} download info`);
    assert.equal(download.fileUrl, doc.fileUrl);
    assert.ok(download.filename);

    // Metadata edit
    const patched = await service.updateMetadata(doc.id, {
      title: `${defaultTitleForTypeCode(typeCode)} edited`,
      description: `edited-${typeCode}`,
    });
    assert.ok(patched);
    assert.equal(patched.title, `${defaultTitleForTypeCode(typeCode)} edited`);

    // Replace upload
    const replaced = await service.upload({
      officerPk,
      officerId,
      documentType: typeCode,
      title: patched.title,
      description: patched.description,
      bytes: new Uint8Array(80),
      mimeType: "image/jpeg",
      originalFilename: `${typeCode}-v2.jpg`,
      uploadedBy: "e2e",
    });
    assert.equal(replaced.version, 2, typeCode);
    assert.equal(replaced.isActive, true);
    assert.equal(replaced.mimeType, "image/jpeg");

    // History opens with both versions
    const history = await service.getHistory(officerPk, typeCode);
    assert.equal(history.length, 2, `${typeCode} history must list both versions`);
    assert.ok(history.every((h) => h.documentType === typeCode));
    assert.ok(history.some((h) => h.version === 1 && h.isActive === false));
    assert.ok(history.some((h) => h.version === 2 && h.isActive === true));

    // AI status contract (Phase 49A): without session OCR map, readiness must
    // not invent AI_REVIEW_PENDING / format-unsupported from thin air. Schema-
    // derived pending (e.g. not manually approved) may still count > 0.
    const activeDocs = await service.listActive(officerPk);
    const intel = composeOfficerDocumentIntelligence({
      officerId,
      officerPk,
      documents: activeDocs,
    });
    const readiness = (await import("@/lib/intelligence/document_readiness")).computeDocumentReadiness({
      documents: activeDocs,
    });
    assert.equal(
      readiness.reasons.some((r) => r.code === "AI_REVIEW_PENDING" || r.code === "FORMAT_UNSUPPORTED" || r.code === "VALIDATION_FAILED"),
      false,
      `${typeCode}: must not fabricate OCR/AI failure reasons without session status`
    );
    assert.ok(typeof intel.pendingReviewCount === "number");
    // Card/detail show the foundation "AI Ready" label from dictionary — not a live model call.
    assert.equal((await import("@/lib/i18n/dictionary")).translate("epf.cardAiReady", "th"), "พร้อมสำหรับ AI");

    uploaded.push(replaced);
  }

  assert.equal(uploaded.length, ALL_TYPE_CODES.length);
  assert.equal(new Set(uploaded.map((d) => d.documentType)).size, ALL_TYPE_CODES.length);

  // Cross-category isolation: no type leaked into another category path segment
  for (const doc of uploaded) {
    const cat = categoryForTypeCode(doc.documentType);
    for (const other of DOCUMENT_CATEGORIES) {
      if (other.code === cat.code) continue;
      assert.ok(!other.typeCodes.includes(doc.documentType));
    }
  }

  const after = composeOfficerDocumentIntelligence({
    officerId,
    officerPk,
    documents: await service.listActive(officerPk),
  });
  assert.ok(after.completenessScore > before.completenessScore, "readiness/completeness must recalculate upward after uploads");
  assert.ok(after.missingRequiredCount < before.missingRequiredCount || after.readinessLevel !== "INCOMPLETE" || after.completenessScore >= 50);

  // DB retained history rows (active + inactive)
  assert.ok(db.rows.length >= ALL_TYPE_CODES.length * 2);
});

test("registry coverage: every DOCUMENT_CATEGORIES type is registered and uniquely categorized", () => {
  const seen = new Set<string>();
  for (const cat of DOCUMENT_CATEGORIES) {
    assert.ok(cat.typeCodes.length > 0, cat.code);
    for (const code of cat.typeCodes) {
      assert.ok(findDocumentType(code), `${code} must be registered`);
      assert.equal(categoryForTypeCode(code).code, cat.code, `${code} category binding`);
      assert.equal(seen.has(code), false, `${code} must not appear in two categories`);
      seen.add(code);
    }
  }
  assert.equal(seen.size, ALL_TYPE_CODES.length);
  assert.equal(ALL_TYPE_CODES.length, 18);
});
