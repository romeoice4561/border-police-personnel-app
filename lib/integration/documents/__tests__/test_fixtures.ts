import type { OfficerDocument } from "@/lib/database/query_types";

/** Shared OfficerDocument fixture builder for lib/integration/documents tests — mirrors lib/intelligence/__tests__/test_fixtures.ts's fixtureDoc() exactly so fixtures stay consistent across every test suite that touches OfficerDocument. */
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

/** A full set of the recommended checklist documents (see epf_intelligence.ts's RECOMMENDED_CHECKLIST_CODES, minus OFFICIAL_PORTRAIT) — all approved and non-expiring, for building a genuine READY fixture. */
export function fullChecklistDocs(overrides: { verifiedAt?: Date | null; expiryDate?: Date | null } = {}): OfficerDocument[] {
  const verifiedAt = overrides.verifiedAt === undefined ? new Date("2026-01-01") : overrides.verifiedAt;
  const codes = [
    "GP7",
    "NATIONAL_ID",
    "HOUSE_REGISTRATION",
    "EDUCATION_CERTIFICATE",
    "TRAINING_CERTIFICATE",
    "AWARD",
    "MEDICAL_DOCUMENT",
    "SALARY_DOCUMENT",
    "ANNUAL_EVALUATION",
    "FIREARMS_QUALIFICATION",
  ];
  return codes.map((documentType) => fixtureDoc({ documentType, verifiedAt, expiryDate: overrides.expiryDate ?? null }));
}
