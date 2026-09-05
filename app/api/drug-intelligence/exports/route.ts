/**
 * POST /api/drug-intelligence/exports — unified DI export shell (DI-10B).
 * Requires drug.read + drug.export. Generates OPERATIONAL_CASES CSV only.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { getDrugIntelligenceContainer } from "@/lib/drug_intelligence/drug_intelligence_container";
import { handleDrugExportCreate } from "@/lib/drug_intelligence/drug_export_api_handlers";
import { DrugExportService } from "@/lib/drug_intelligence/drug_export_service";

export async function POST(request: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { db } = await getDrugIntelligenceContainer();
    return handleDrugExportCreate(new DrugExportService(db), request);
  });
}
