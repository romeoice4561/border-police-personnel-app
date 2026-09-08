/**
 * GET /api/drug-intelligence/exports/history — actor-scoped recent export_created rows.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk } from "@/lib/api/api_response";
import { AUTH_ENFORCED, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { getAuthUserById } from "@/lib/auth/mock_auth_backend";
import { DrugAuditLogRepository } from "@/lib/database/repositories/drug_audit_log_repository";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import { requireDrugExport } from "@/lib/drug_intelligence/drug_export_auth";
import {
  clampExportHistoryTake,
  projectExportHistoryItems,
} from "@/lib/drug_intelligence/drug_export_history";
import { translate, type Language } from "@/lib/i18n/dictionary";
import type { DatabaseClient } from "@/lib/database/database_types";

const historyQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  take: z.coerce.number().int().optional(),
  locale: z.enum(["th", "en"]).optional(),
});

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export async function handleDrugExportHistory(
  db: DatabaseClient,
  searchParams: URLSearchParams,
  request: Request
): Promise<Response> {
  const parsed = historyQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return badRequest(
      "Invalid export history query",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  const locale: Language = parsed.data.locale ?? "th";
  const actorId = parsed.data.actorId;

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

  const take = clampExportHistoryTake(parsed.data.take);
  const rows = await new DrugAuditLogRepository(db).recentExportsForActor({
    actorId: user.id,
    take,
  });
  return jsonOk({ items: projectExportHistoryItems(rows) });
}
