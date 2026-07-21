import type { OfficerDocument } from "@/lib/database/query_types";

/** Shared OfficerDocument fixture builder for lib/intelligence tests — mirrors lib/document/__tests__/epf_intelligence.test.ts's doc() helper exactly so fixtures stay consistent across both test suites. */
let nextId = 1;
export function fixtureDoc(ov: Partial<OfficerDocument>): OfficerDocument {
  return {
    id: nextId++,
    officerId: 1,
    documentType: "OTHER",
    title: "Doc",
    description: null,
    storagePath: null,
    fileUrl: null,
    originalFilename: null,
    mimeType: null,
    fileSize: null,
    uploadedAt: null,
    uploadedBy: null,
    verifiedAt: null,
    verifiedBy: null,
    issueDate: null,
    expiryDate: null,
    renewalDate: null,
    version: 1,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...ov,
  } as OfficerDocument;
}
