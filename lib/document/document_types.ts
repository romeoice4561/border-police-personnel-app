/**
 * Officer Document Type Registry (Phase 29A — Officer Document Vault Foundation).
 *
 * Defines the extensible list of document categories. The spec requires that
 * document types are NEVER hardcoded into UI or DB enums — every module must
 * drive from this registry so new types can be added by calling
 * `registerDocumentType` at startup, without a schema migration.
 *
 * Built-in types correspond to the initial set from the spec. The registry
 * is ordered; UI renders rows in registry order.
 */

export interface DocumentTypeDefinition {
  /** Stable uppercase code — stored in the DB `documentType` column. Never changes once set. */
  code: string;
  /** Primary Thai label. */
  labelTh: string;
  /** English label shown alongside Thai. */
  labelEn: string;
}

/** Initial built-in document categories (spec §DOCUMENT TYPES). */
export const BUILT_IN_DOCUMENT_TYPES: readonly DocumentTypeDefinition[] = [
  { code: "NATIONAL_ID",        labelTh: "บัตรประชาชน",                    labelEn: "National ID Card" },
  { code: "OFFICER_CARD",       labelTh: "บัตรประจำตัวข้าราชการ",          labelEn: "Government Officer Card" },
  { code: "DRIVER_LICENSE",     labelTh: "ใบอนุญาตขับขี่",                 labelEn: "Driver License" },
  { code: "HOUSE_REGISTRATION", labelTh: "ทะเบียนบ้าน",                    labelEn: "House Registration" },
  { code: "MILITARY_RECORD",    labelTh: "ป.4",                            labelEn: "Military Record (ป.4)" },
  { code: "GP7",                labelTh: "ก.พ.7",                          labelEn: "ก.พ.7" },
  { code: "APPOINTMENT_ORDER",  labelTh: "คำสั่งแต่งตั้ง",                 labelEn: "Appointment Order" },
  { code: "CERTIFICATE",        labelTh: "ประกาศนียบัตร",                  labelEn: "Certificate" },
  { code: "PASSPORT",           labelTh: "หนังสือเดินทาง",                 labelEn: "Passport" },
  { code: "OTHER",              labelTh: "เอกสารอื่น",                     labelEn: "Other" },
] as const;

// Mutable registry starts with the built-in types. Modules can extend via registerDocumentType.
let _registry: DocumentTypeDefinition[] = [...BUILT_IN_DOCUMENT_TYPES];

/** Returns the current ordered list of document types. */
export function getDocumentTypes(): readonly DocumentTypeDefinition[] {
  return _registry;
}

/**
 * Adds a new document type to the registry. Idempotent — if the code is
 * already registered, the call is silently ignored. New types are appended
 * after the built-in list so their order is stable across restarts.
 */
export function registerDocumentType(def: DocumentTypeDefinition): void {
  if (!_registry.find((d) => d.code === def.code)) {
    _registry = [..._registry, def];
  }
}

/**
 * Resolves the English label for a given code. Falls back to the raw code
 * when the code is not in the registry (unknown/future types show their code
 * rather than crashing).
 */
export function getDocumentTypeLabel(code: string): string {
  const def = _registry.find((d) => d.code === code);
  return def ? def.labelEn : code;
}

/** Returns the full definition for a code, or null when not found. */
export function findDocumentType(code: string): DocumentTypeDefinition | null {
  return _registry.find((d) => d.code === code) ?? null;
}

/** True if the code exists in the registry (built-in or registered extension). */
export function isKnownDocumentType(code: string): boolean {
  return _registry.some((d) => d.code === code);
}
