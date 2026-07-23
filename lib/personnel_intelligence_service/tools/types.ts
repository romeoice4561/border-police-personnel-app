/**
 * Governed Intelligence Tool contracts (Phase 49.6).
 */
import type { IntelligenceCapability, IntelligenceActor } from "@/lib/personnel_intelligence_service/permissions";
import type { PersonnelIntelligenceService } from "@/lib/personnel_intelligence_service/service";
import type { PersonnelIntelligenceServiceContext } from "@/lib/personnel_intelligence_service/context";
import type { IntelligenceToolErrorCode } from "@/lib/personnel_intelligence_service/tools/errors";

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

export type IntelligenceToolCategory =
  | "summary"
  | "personnel_search"
  | "officer_detail"
  | "promotion"
  | "retirement"
  | "documents"
  | "training"
  | "executive_brief"
  | "reports";

/** Tool-facing capability union; maps onto Phase 49.5 IntelligenceCapability. */
export type IntelligenceToolCapability =
  | "intelligence.summary.view"
  | "intelligence.officers.search"
  | "intelligence.officer.view"
  | "intelligence.promotion.view"
  | "intelligence.retirement.view"
  | "intelligence.documents.view"
  | "intelligence.training.view"
  | "intelligence.brief.view"
  | "intelligence.reports.view";

/** Maps tool capabilities onto the Phase 49.5 capability checks. */
export const TOOL_CAPABILITY_TO_SERVICE: Record<IntelligenceToolCapability, IntelligenceCapability> = {
  "intelligence.summary.view": "intelligence.summary.view",
  "intelligence.officers.search": "intelligence.officers.search",
  "intelligence.officer.view": "intelligence.officer.view",
  "intelligence.promotion.view": "intelligence.summary.view",
  "intelligence.retirement.view": "intelligence.summary.view",
  "intelligence.documents.view": "intelligence.summary.view",
  "intelligence.training.view": "intelligence.summary.view",
  "intelligence.brief.view": "intelligence.summary.view",
  "intelligence.reports.view": "intelligence.reports.view",
};

export type ToolRiskLevel = "low" | "moderate";

export type LocalizedText = { th: string; en: string };

export type ToolFieldType = "string" | "number" | "boolean" | "enum" | "object";

export interface ToolInputFieldSchema {
  name: string;
  type: ToolFieldType;
  required?: boolean;
  description: string;
  enumValues?: readonly string[];
  /** Nested object keys when type === "object" (flat allowlist). */
  objectKeys?: readonly string[];
}

export interface ToolInputSchema<TInput = unknown> {
  /** Allowlisted root keys. Unknown keys are rejected. */
  fields: readonly ToolInputFieldSchema[];
  /** Pure validator — returns typed input or throws IntelligenceToolError. */
  parse: (raw: unknown) => TInput;
}

export interface ToolOutputSchema {
  description: string;
}

export interface IntelligenceToolHandlerContext {
  service: PersonnelIntelligenceService;
  context: PersonnelIntelligenceServiceContext;
  actor: IntelligenceActor;
  requestId: string;
}

export type IntelligenceToolHandler<TInput, TOutput> = (
  input: TInput,
  ctx: IntelligenceToolHandlerContext
) => TOutput | Promise<TOutput>;

export interface IntelligenceToolDefinition<
  TName extends IntelligenceToolName = IntelligenceToolName,
  TInput = unknown,
  TOutput = unknown,
> {
  name: TName;
  version: string;
  category: IntelligenceToolCategory;
  title: LocalizedText;
  description: LocalizedText;
  capability: IntelligenceToolCapability;
  riskLevel: ToolRiskLevel;
  readOnly: true;
  inputSchema: ToolInputSchema<TInput>;
  outputSchema?: ToolOutputSchema;
  exampleInputs: TInput[];
  handler: IntelligenceToolHandler<TInput, TOutput>;
}

export interface IntelligenceToolManifestEntry {
  name: IntelligenceToolName;
  version: string;
  category: IntelligenceToolCategory;
  title: LocalizedText;
  description: LocalizedText;
  capability: IntelligenceToolCapability;
  readOnly: true;
  riskLevel: ToolRiskLevel;
  inputDescription: readonly ToolInputFieldSchema[];
  exampleInputs: unknown[];
}

export interface IntelligenceToolExecutionRequest {
  toolName: IntelligenceToolName | string;
  input: unknown;
  actor: IntelligenceActor;
  requestId?: string;
  service?: PersonnelIntelligenceService;
  serviceContext?: PersonnelIntelligenceServiceContext;
  /** Optional injectable audit sink (defaults to no-op). */
  auditSink?: IntelligenceToolAuditSink;
}

export interface IntelligenceToolSuccessResult<TData = unknown> {
  ok: true;
  tool: { name: IntelligenceToolName; version: string };
  data: TData;
  meta: {
    requestId: string;
    contextId: string;
    executedAt: string;
    durationMs: number;
    resultCount?: number;
  };
}

export interface IntelligenceToolFailureResult {
  ok: false;
  tool?: { name?: string; version?: string };
  error: { code: IntelligenceToolErrorCode; message: string };
  meta: {
    requestId: string;
    executedAt: string;
    durationMs: number;
    contextId?: string;
  };
}

export type IntelligenceToolExecutionResult<TData = unknown> =
  | IntelligenceToolSuccessResult<TData>
  | IntelligenceToolFailureResult;

export interface IntelligenceToolAuditEvent {
  requestId: string;
  contextId?: string;
  toolName: IntelligenceToolName | string;
  toolVersion: string;
  actorId?: string;
  actorRole: string;
  capability: IntelligenceToolCapability | "unknown";
  scopeSummary: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  errorCode?: IntelligenceToolErrorCode;
  resultCount?: number;
}

export interface IntelligenceToolAuditSink {
  record(event: IntelligenceToolAuditEvent): void | Promise<void>;
}

/** Phase 49.5 legacy parameter-schema contract (AI readiness listing). */
export interface IntelligenceToolParameterSchema {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  required?: boolean;
  description: string;
  enumValues?: readonly string[];
}

/** Phase 49.5 legacy tool contract entry. */
export interface IntelligenceToolContractDefinition {
  name: IntelligenceToolName;
  description: string;
  parameters: readonly IntelligenceToolParameterSchema[];
}
