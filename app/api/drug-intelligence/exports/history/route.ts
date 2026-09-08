/**
 * GET /api/drug-intelligence/exports/history — current-actor recent export_created rows.
 * Requires drug.read + drug.export. Safe projection only. No report bodies.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugExportHistory } from "@/lib/drug_intelligence/drug_export_history_api_handlers";

export async function GET(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { db } = await getDrugIntelligenceContainer();
    return handleDrugExportHistory(db, request.nextUrl.searchParams, request);
  });
}
