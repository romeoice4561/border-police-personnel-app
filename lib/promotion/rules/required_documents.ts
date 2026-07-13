import type { PromotionRule } from "@/lib/promotion/types";

export interface RequiredDocumentsRuleConfig {
  id?: string;
  requiredDocumentTypes: readonly string[];
  requireVerified?: boolean;
  score?: number;
}

export function createRequiredDocumentsRule(config: RequiredDocumentsRuleConfig): PromotionRule {
  const score = config.score ?? 15;

  return {
    id: config.id ?? "required-documents",
    label: "Required documents",
    maxScore: score,
    evaluate(context) {
      const documents = context.documents ?? [];
      const missing = config.requiredDocumentTypes.filter((typeCode) => {
        return !documents.some((doc) => {
          if (doc.typeCode !== typeCode || doc.isActive === false) return false;
          return config.requireVerified ? Boolean(doc.verifiedAt) : true;
        });
      });
      const passed = missing.length === 0;

      return {
        ruleId: config.id ?? "required-documents",
        passed,
        score: passed ? score : 0,
        maxScore: score,
        severity: "blocking",
        reasons: passed ? ["All configured document requirements are present."] : ["Required promotion documents are missing."],
        missingRequirements: missing.map((typeCode) => ({
          code: `DOCUMENT_${typeCode}`,
          label: config.requireVerified ? "Required verified document" : "Required document",
          detail: typeCode,
        })),
        warnings: [],
        suggestedNextSteps: missing.map((typeCode) => ({ code: `UPLOAD_${typeCode}`, label: "Complete required document.", detail: typeCode })),
      };
    },
  };
}
