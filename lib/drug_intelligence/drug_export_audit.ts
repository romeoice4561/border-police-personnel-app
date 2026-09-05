/**
 * Safe export audit. Writes DrugAuditLog only. Never logs rows, phones,
 * IMSI/IMEI, signed URLs, annotation text, or credentials.
 */

import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import type { DatabaseClient } from "@/lib/database/database_types";
import type { DrugExportFormat, DrugExportType } from "@/lib/drug_intelligence/drug_export_types";

const FORBIDDEN_AUDIT = /phone|imsi|iccid|imei|signedUrl|annotationText|SERVICE_ROLE|eyJhbGciOi/i;

export const DRUG_EXPORT_AUDIT_ACTION = "export_created";
export const DRUG_EXPORT_AUDIT_ENTITY = "DrugExport";

export interface DrugExportAuditInput {
  actorId: string;
  actorName: string;
  exportId: string;
  exportType: DrugExportType;
  format: DrugExportFormat;
  locale: "th" | "en";
  recordCount: number;
  contextSummary: Record<string, string | number | boolean | null>;
  filename: string;
}

export function buildExportAuditDetail(input: Omit<DrugExportAuditInput, "actorId" | "actorName" | "exportId">): string {
  const payload = {
    exportType: input.exportType,
    format: input.format,
    locale: input.locale,
    recordCount: input.recordCount,
    contextSummary: input.contextSummary,
    filename: input.filename,
  };
  const json = JSON.stringify(payload);
  if (FORBIDDEN_AUDIT.test(json)) {
    return JSON.stringify({
      exportType: input.exportType,
      format: input.format,
      locale: input.locale,
      recordCount: input.recordCount,
      filename: input.filename,
    });
  }
  return json;
}

export async function recordExportCreated(db: DatabaseClient, input: DrugExportAuditInput): Promise<void> {
  const audit = new DrugAuditLogRepository(db);
  await audit.record({
    entityType: DRUG_EXPORT_AUDIT_ENTITY,
    entityId: input.exportId,
    action: DRUG_EXPORT_AUDIT_ACTION,
    actorId: input.actorId,
    actorName: input.actorName,
    detail: buildExportAuditDetail(input),
  });
}
