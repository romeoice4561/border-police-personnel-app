/**
 * POST /api/drug-intelligence/exports — framework-agnostic handler.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk } from "@/lib/api/api_response";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { drugExportRequestSchema } from "@/lib/drug_intelligence/drug_export_api_schemas";
import { requireDrugExport } from "@/lib/drug_intelligence/drug_export_auth";
import { resolveDrugExportContext } from "@/lib/drug_intelligence/drug_export_context";
import { resolveExportMaskingMode } from "@/lib/drug_intelligence/drug_export_masking";
import { exportDownloadResponse } from "@/lib/drug_intelligence/drug_export_response";
import {
  DrugExportCaseNotFoundError,
  DrugExportInvalidCaseError,
  DrugExportInvalidColumnsError,
  DrugExportInvalidFormatError,
  DrugExportNotImplementedError,
  DrugExportService,
  DrugExportTooManyRowsError,
} from "@/lib/drug_intelligence/drug_export_service";
import { translate, type Language } from "@/lib/i18n/dictionary";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export async function handleDrugExportCreate(service: DrugExportService, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = drugExportRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid export request", zodDetails(parsed.error));

  const actorId = parsed.data.actorId;
  const locale: Language = parsed.data.context.locale;

  if (AUTH_ENFORCED) {
    const session = cookieValue(request, SESSION_COOKIE_NAME);
    if (!session) return jsonError("UNAUTHENTICATED", "Authentication required", 401);
  }

  const deniedRead = await assertDrugIntelligencePermission(request, actorId, "drug.read");
  if (deniedRead) return deniedRead;
  const deniedExport = await assertDrugIntelligencePermission(request, actorId, "drug.export");
  if (deniedExport) return deniedExport;

  const user = await getAuthUserById(actorId);
  if (!user || !user.isActive) return jsonError("UNAUTHENTICATED", "Invalid actor", 401);
  const access = requireDrugExport(user.permissions);
  if (!access) return jsonError("FORBIDDEN", translate("di.export.forbidden", locale), 403);

  const masking = resolveExportMaskingMode(parsed.data.masking, user.permissions);
  if (!masking.allowed) return jsonError("FORBIDDEN", translate("di.export.forbiddenFull", locale), 403);

  const context = resolveDrugExportContext(parsed.data.context, user.id);

  try {
    if (parsed.data.intent === "PREVIEW") {
      const preview = await service.preview({
        exportType: parsed.data.exportType,
        format: parsed.data.format,
        context,
        preset: parsed.data.preset,
        columns: parsed.data.columns,
        maskingMode: masking.mode,
      });
      return jsonOk(preview);
    }

    const generated = await service.generate({
      actorName: user.displayName,
      exportType: parsed.data.exportType,
      format: parsed.data.format,
      context,
      preset: parsed.data.preset,
      columns: parsed.data.columns,
      maskingMode: masking.mode,
    });
    return exportDownloadResponse(generated.body, generated.filename, parsed.data.format);
  } catch (error) {
    if (error instanceof DrugExportInvalidColumnsError) {
      return jsonError("INVALID_COLUMNS", translate("di.export.invalidColumns", locale), 400);
    }
    if (error instanceof DrugExportInvalidFormatError) {
      return jsonError("INVALID_FORMAT", translate("di.export.invalidFormat", locale), 400);
    }
    if (error instanceof DrugExportTooManyRowsError) {
      return jsonError("TOO_MANY_ROWS", translate("di.export.tooManyRows", locale), 400);
    }
    if (error instanceof DrugExportNotImplementedError) {
      return jsonError("NOT_IMPLEMENTED_FOR_TYPE", translate("di.export.notImplemented", locale), 501);
    }
    if (error instanceof DrugExportInvalidCaseError) {
      return jsonError("INVALID_CONTEXT", translate("di.export.invalidContext", locale), 400);
    }
    if (error instanceof DrugExportCaseNotFoundError) {
      return jsonError("NOT_FOUND", translate("di.export.reportUnavailable", locale), 404);
    }
    throw error;
  }
}
