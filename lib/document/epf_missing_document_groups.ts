/**
 * e-PF Missing Document Panel Groups (Phase 46C — Executive Layout &
 * Information Hierarchy Refinement).
 *
 * A fixed, presentation-only classification of the 11 recommended-checklist
 * codes (lib/document/epf_intelligence.ts's RECOMMENDED_CHECKLIST_CODES)
 * into Required / Professional / Optional sections for the Missing
 * Documents panel — nothing else. This is NOT a business rule, NOT
 * persisted anywhere, NOT used by any completeness/intelligence
 * calculation, and NOT exposed through any API. It exists purely to
 * organize how already-missing items are grouped visually.
 *
 * If a future phase introduces configurable document policies or
 * organization-specific requirements, this static mapping should be the
 * first thing replaced with a policy-driven implementation — kept as a
 * single small constant precisely so that swap is easy.
 */

export type MissingDocumentGroupKey = "required" | "professional" | "optional";

/** Checklist code → panel group. Every RECOMMENDED_CHECKLIST_CODES entry must appear here exactly once (enforced by a test). */
export const MISSING_DOCUMENT_GROUP: Record<string, MissingDocumentGroupKey> = {
  GP7: "required",
  OFFICIAL_PORTRAIT: "required",
  NATIONAL_ID: "required",
  HOUSE_REGISTRATION: "required",

  EDUCATION_CERTIFICATE: "professional",
  TRAINING_CERTIFICATE: "professional",
  AWARD: "professional",
  MEDICAL_DOCUMENT: "professional",
  ANNUAL_EVALUATION: "professional",
  FIREARMS_QUALIFICATION: "professional",

  SALARY_DOCUMENT: "optional",
};

export const MISSING_DOCUMENT_GROUP_ORDER: readonly MissingDocumentGroupKey[] = ["required", "professional", "optional"];
