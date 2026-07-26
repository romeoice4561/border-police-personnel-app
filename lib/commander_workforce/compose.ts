/**
 * composeCommanderWorkforceViewModel — pure, deterministic composition (Phase 52.1).
 */

import type { ComposeCommanderWorkforceInput } from "@/lib/commander_workforce/contracts";
import { buildActionCenterSection } from "@/lib/commander_workforce/action_center";
import { buildDataQualitySection } from "@/lib/commander_workforce/data_quality";
import { buildDocumentSection } from "@/lib/commander_workforce/documents";
import {
  applyWorkforceFilters,
  buildAvailableFilters,
  normalizeWorkforceFilters,
} from "@/lib/commander_workforce/filters";
import { buildOverviewSection } from "@/lib/commander_workforce/overview";
import { orgPublicCodesAvailable } from "@/lib/commander_workforce/org";
import { buildPromotionSection } from "@/lib/commander_workforce/promotion";
import { buildReadinessSection } from "@/lib/commander_workforce/readiness";
import { buildRetirementSection } from "@/lib/commander_workforce/retirement";
import { buildTrainingSection } from "@/lib/commander_workforce/training";
import type {
  CommanderWorkforceViewModel,
  WorkforceDrilldownDescriptor,
} from "@/lib/commander_workforce/types";

function parseAsOf(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("composeCommanderWorkforceViewModel: invalid asOfDate");
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compose the canonical Commander Workforce ViewModel.
 * Never mutates input officers. Same inputs → same output.
 */
export function composeCommanderWorkforceViewModel(
  input: ComposeCommanderWorkforceInput
): CommanderWorkforceViewModel {
  const asOf = parseAsOf(input.asOfDate);
  const asOfDate = toIsoDate(asOf);
  const generatedAt = input.now ? input.now.toISOString() : `${asOfDate}T00:00:00.000Z`;

  const filters = normalizeWorkforceFilters(input.filters);
  const orgPublicIndex = input.orgPublicIndex;
  const source = input.officers;
  const filtered = applyWorkforceFilters(source, filters, orgPublicIndex, asOf);

  const overview = buildOverviewSection(filtered, orgPublicIndex);
  const promotion = buildPromotionSection(filtered);
  const retirement = buildRetirementSection(filtered, asOf);
  const training = buildTrainingSection(filtered);
  const documents = buildDocumentSection(filtered);
  const dataQuality = buildDataQualitySection(filtered);
  const readiness = buildReadinessSection({
    promotion,
    retirement,
    training,
    documents,
    dataQuality,
    totalOfficers: filtered.length,
  });
  const actionCenter = buildActionCenterSection({
    promotion,
    retirement,
    training,
    documents,
    dataQuality,
    totalOfficers: filtered.length,
  });

  const availableFilters = buildAvailableFilters(source, orgPublicIndex, asOf);

  const drilldowns: WorkforceDrilldownDescriptor[] = [
    ...promotion.byStatus.map((s) => s.drilldown),
    ...retirement.buckets.map((b) => b.drilldown),
    ...actionCenter.items.map((i) => i.drilldown),
  ];

  const scopeLabel =
    input.scope?.labelTh?.trim() ||
    [
      input.scope?.companyPublicCode && `ร้อย ${input.scope.companyPublicCode}`,
      input.scope?.divisionPublicCode && `กก ${input.scope.divisionPublicCode}`,
      input.scope?.regionPublicCode && `ภาค ${input.scope.regionPublicCode}`,
    ]
      .filter(Boolean)
      .join(" / ") ||
    "กำลังพลทั้งหมดในชุดข้อมูล";

  return {
    generatedAt,
    asOfDate,
    scope: {
      labelTh: scopeLabel,
      regionPublicCode: input.scope?.regionPublicCode ?? filters.regionPublicCode,
      divisionPublicCode: input.scope?.divisionPublicCode ?? filters.divisionPublicCode,
      companyPublicCode: input.scope?.companyPublicCode ?? filters.companyPublicCode,
      officerCount: filtered.length,
      publicCodesAvailable: orgPublicCodesAvailable(orgPublicIndex),
    },
    filters,
    availableFilters,
    overview,
    promotion,
    retirement,
    training,
    documents,
    dataQuality,
    readiness,
    actionCenter,
    drilldowns,
    metadata: {
      schemaVersion: 1,
      composer: "commander_workforce",
      officerSourceCount: source.length,
      filteredOfficerCount: filtered.length,
      // Timing is measured in tests/fixtures — never wall-clock inside the VM (determinism).
      compositionDurationMs: null,
      notesTh: [
        "ประกอบจาก CommanderQueryOfficer / PromotionSummary / TrainingSummary / documentIntelligence ที่มีอยู่",
        "ไม่คำนวณสิทธิ์เลื่อนตำแหน่งหรือสูตรเกษียณใหม่",
        Object.values(filters).every((v) => v == null)
          ? "ไม่มีตัวกรองที่ใช้งาน"
          : "ผลลัพธ์ผ่านตัวกรองร่วมชุดเดียวทั้งทุก section",
      ],
    },
  };
}
