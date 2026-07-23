/**
 * Canonical registered intelligence tool definitions (Phase 49.6).
 *
 * Handlers are thin delegates to PersonnelIntelligenceService only.
 */
import type { PersonnelIntelligenceQuery } from "@/lib/personnel_intelligence_service/types";
import {
  COMMON_FILTER_FIELDS,
  parseOfficerIntelligenceInput,
  parsePersonnelQueryInput,
  parseReportProjectionInput,
  SEARCH_FIELDS,
  SCOPE_FIELDS,
  type FlatIntelligenceToolQueryInput,
  type OfficerIntelligenceToolInput,
  type ReportProjectionToolInput,
} from "@/lib/personnel_intelligence_service/tools/schemas";
import type {
  IntelligenceToolDefinition,
  IntelligenceToolName,
  ToolInputFieldSchema,
} from "@/lib/personnel_intelligence_service/tools/types";

const TOOL_VERSION = "1.0.0";

const SUMMARY_FIELDS: readonly ToolInputFieldSchema[] = [
  ...SCOPE_FIELDS,
  { name: "asOf", type: "string", description: "ISO as-of timestamp" },
];

function querySchema(fields: readonly ToolInputFieldSchema[]) {
  return {
    fields,
    parse: (raw: unknown): FlatIntelligenceToolQueryInput => parsePersonnelQueryInput(raw, fields),
  };
}

/** Service coerceQuery accepts flat records; cast keeps call sites typed. */
function asServiceQuery(input: FlatIntelligenceToolQueryInput): PersonnelIntelligenceQuery {
  return input as unknown as PersonnelIntelligenceQuery;
}

/** Preserves handler input typing at definition site, stores as erased registry entry. */
function defineTool<TName extends IntelligenceToolName, TInput, TOutput>(
  def: IntelligenceToolDefinition<TName, TInput, TOutput>
): IntelligenceToolDefinition {
  return def as IntelligenceToolDefinition;
}

export const INTELLIGENCE_TOOL_DEFINITION_LIST: readonly IntelligenceToolDefinition[] = [
  defineTool({
    name: "get_commander_summary",
    version: TOOL_VERSION,
    category: "summary",
    title: { th: "สรุปข่าวกรองผู้บังคับบัญชา", en: "Commander summary" },
    description: {
      th: "สรุปตัวชี้วัดกำลังพลแบบรวมจากชุดข้อมูลผู้บังคับบัญชา",
      en: "Aggregate commander intelligence summary for an authorized organization scope",
    },
    capability: "intelligence.summary.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(SUMMARY_FIELDS),
    exampleInputs: [{}, { regionId: 1 }],
    handler: (input, { service }) => service.getCommanderSummary(asServiceQuery(input)),
  }),
  defineTool({
    name: "search_officers",
    version: TOOL_VERSION,
    category: "personnel_search",
    title: { th: "ค้นหากำลังพล", en: "Search officers" },
    description: {
      th: "ค้นหาและแบ่งหน้าสรุปข่าวกรองกำลังพลอย่างปลอดภัย",
      en: "Search and paginate safe officer intelligence summaries",
    },
    capability: "intelligence.officers.search",
    riskLevel: "moderate",
    readOnly: true,
    inputSchema: querySchema(SEARCH_FIELDS),
    exampleInputs: [{ page: 1, pageSize: 20, priority: "high" }, { readyForPromotion: true }],
    handler: (input, { service }) => service.searchOfficers(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_officer_intelligence",
    version: TOOL_VERSION,
    category: "officer_detail",
    title: { th: "ข่าวกรองรายบุคคล", en: "Officer intelligence" },
    description: {
      th: "โปรไฟล์ข่าวกรองที่ปลอดภัยของกำลังพลหนึ่งนาย",
      en: "Safe intelligence detail for one officer",
    },
    capability: "intelligence.officer.view",
    riskLevel: "moderate",
    readOnly: true,
    inputSchema: {
      fields: [
        { name: "officerId", type: "string", required: true, description: "Business officer id" },
        { name: "asOf", type: "string", description: "ISO as-of timestamp" },
      ],
      parse: parseOfficerIntelligenceInput,
    },
    exampleInputs: [{ officerId: "ภาค4/79" } satisfies OfficerIntelligenceToolInput],
    handler: (input, { service }) => service.getOfficerIntelligence(input.officerId),
  }),
  defineTool({
    name: "get_promotion_summary",
    version: TOOL_VERSION,
    category: "promotion",
    title: { th: "สรุปการเลื่อนตำแหน่ง", en: "Promotion summary" },
    description: {
      th: "สรุปความพร้อมเลื่อนตำแหน่งจากข่าวกรองที่มีอยู่",
      en: "Promotion readiness aggregates from existing promotion intelligence",
    },
    capability: "intelligence.promotion.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(COMMON_FILTER_FIELDS),
    exampleInputs: [{}],
    handler: (input, { service }) => service.getPromotionSummary(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_retirement_summary",
    version: TOOL_VERSION,
    category: "retirement",
    title: { th: "สรุปการเกษียณ", en: "Retirement summary" },
    description: {
      th: "สรุปการเกษียณจากฟิลด์ข่าวกรองที่มีอยู่",
      en: "Retirement forecast aggregates from existing retirement fields",
    },
    capability: "intelligence.retirement.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(COMMON_FILTER_FIELDS),
    exampleInputs: [{ retirementWithin: "within-1-year" }],
    handler: (input, { service }) => service.getRetirementSummary(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_document_summary",
    version: TOOL_VERSION,
    category: "documents",
    title: { th: "สรุปเอกสาร", en: "Document summary" },
    description: {
      th: "สรุปความครบถ้วนและวันหมดอายุของเอกสาร",
      en: "Document completeness/expiry aggregates",
    },
    capability: "intelligence.documents.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(COMMON_FILTER_FIELDS),
    exampleInputs: [{ documentStatus: "expired" }],
    handler: (input, { service }) => service.getDocumentSummary(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_training_summary",
    version: TOOL_VERSION,
    category: "training",
    title: { th: "สรุปการฝึกอบรม", en: "Training summary" },
    description: {
      th: "สรุปความพร้อมด้านหลักสูตรและการฝึกอบรม",
      en: "Training readiness aggregates",
    },
    capability: "intelligence.training.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(COMMON_FILTER_FIELDS),
    exampleInputs: [{ trainingStatus: "MissingRequired" }],
    handler: (input, { service }) => service.getTrainingSummary(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_executive_brief",
    version: TOOL_VERSION,
    category: "executive_brief",
    title: { th: "สรุปผู้บังคับบัญชา", en: "Executive brief" },
    description: {
      th: "สรุปหนึ่งหน้าแบบกำหนดตายตัวพร้อมข้อเสนอแนะ",
      en: "Deterministic one-page commander brief counts and action items",
    },
    capability: "intelligence.brief.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: querySchema(COMMON_FILTER_FIELDS),
    exampleInputs: [{}],
    handler: (input, { service }) => service.getExecutiveBrief(asServiceQuery(input)),
  }),
  defineTool({
    name: "get_report_projection",
    version: TOOL_VERSION,
    category: "reports",
    title: { th: "ฉายภาพรายงานผู้บริหาร", en: "Report projection" },
    description: {
      th: "มอบหมายให้ตัวสร้างรายงานผู้บริหาร Phase 49C",
      en: "Delegates to Phase 49C executive report builder",
    },
    capability: "intelligence.reports.view",
    riskLevel: "low",
    readOnly: true,
    inputSchema: {
      fields: [
        { name: "type", type: "enum", required: true, description: "Executive report type id" },
        { name: "reportType", type: "enum", description: "Alias for type" },
        ...SCOPE_FIELDS,
        { name: "asOf", type: "string", description: "ISO as-of timestamp" },
        { name: "preparedByTh", type: "string", description: "Prepared-by display name" },
        { name: "fiscalYearBe", type: "number", description: "Buddhist-era fiscal year (metadata)" },
      ],
      parse: parseReportProjectionInput,
    },
    exampleInputs: [{ type: "monthlyBrief" } satisfies ReportProjectionToolInput],
    handler: (input, { service }) =>
      service.getReportProjection({
        type: input.type,
        scope: {
          regionId: input.regionId,
          battalionId: input.battalionId,
          companyId: input.companyId,
        },
        asOf: input.asOf,
        preparedByTh: input.preparedByTh,
      }),
  }),
];
