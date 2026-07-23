/**
 * Phase 50 AI tool contract definitions (Phase 49.5 readiness only).
 *
 * Typed tool names + parameter schemas for future AI tool calling.
 * No execution runtime, no LLM, no prompts.
 */
import type { ExecutiveReportType } from "@/lib/commander_reports/types";

export const INTELLIGENCE_TOOL_NAMES = [
  "get_commander_summary",
  "search_officers",
  "get_officer_intelligence",
  "get_promotion_summary",
  "get_retirement_summary",
  "get_document_summary",
  "get_training_summary",
  "get_executive_brief",
  "get_report_projection",
] as const;

export type IntelligenceToolName = (typeof INTELLIGENCE_TOOL_NAMES)[number];

export interface IntelligenceToolParameterSchema {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  required?: boolean;
  description: string;
  enumValues?: readonly string[];
}

export interface IntelligenceToolDefinition {
  name: IntelligenceToolName;
  description: string;
  parameters: readonly IntelligenceToolParameterSchema[];
}

const COMMON_FILTER_PARAMS: readonly IntelligenceToolParameterSchema[] = [
  { name: "regionId", type: "number", description: "Organization region id" },
  { name: "battalionId", type: "number", description: "Battalion id" },
  { name: "companyId", type: "number", description: "Company id" },
  { name: "rank", type: "string", description: "Exact rank label" },
  { name: "priority", type: "enum", enumValues: ["low", "medium", "high", "critical"], description: "Officer priority" },
  { name: "asOf", type: "string", description: "ISO as-of timestamp" },
];

export const INTELLIGENCE_TOOL_DEFINITIONS: readonly IntelligenceToolDefinition[] = [
  {
    name: "get_commander_summary",
    description: "Aggregate commander intelligence summary for an authorized organization scope",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "search_officers",
    description: "Search and paginate safe officer intelligence summaries",
    parameters: [
      ...COMMON_FILTER_PARAMS,
      { name: "page", type: "number", description: "1-based page" },
      { name: "pageSize", type: "number", description: `Max ${100}` },
      { name: "sort", type: "string", description: "Allowed sort field" },
      { name: "order", type: "enum", enumValues: ["asc", "desc"], description: "Sort order" },
      { name: "searchText", type: "string", description: "Name/unit contains text" },
    ],
  },
  {
    name: "get_officer_intelligence",
    description: "Safe intelligence detail for one officer",
    parameters: [{ name: "officerId", type: "string", required: true, description: "Business officer id" }],
  },
  {
    name: "get_promotion_summary",
    description: "Promotion readiness aggregates from existing promotion intelligence",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "get_retirement_summary",
    description: "Retirement forecast aggregates from existing retirement fields",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "get_document_summary",
    description: "Document completeness/expiry aggregates",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "get_training_summary",
    description: "Training readiness aggregates",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "get_executive_brief",
    description: "Deterministic one-page commander brief counts and action items",
    parameters: COMMON_FILTER_PARAMS,
  },
  {
    name: "get_report_projection",
    description: "Delegates to Phase 49C executive report builder",
    parameters: [
      {
        name: "type",
        type: "enum",
        required: true,
        enumValues: [
          "personnelSummary",
          "promotionReadiness",
          "retirementForecast",
          "documentCompleteness",
          "documentExpiry",
          "trainingReadiness",
          "highPriority",
          "criticalAction",
          "birthday",
          "monthlyBrief",
        ] satisfies ExecutiveReportType[],
        description: "Executive report type id",
      },
      ...COMMON_FILTER_PARAMS,
    ],
  },
];

export function getIntelligenceToolDefinition(name: IntelligenceToolName): IntelligenceToolDefinition {
  const def = INTELLIGENCE_TOOL_DEFINITIONS.find((d) => d.name === name);
  if (!def) throw new Error(`Unknown intelligence tool: ${name}`);
  return def;
}
