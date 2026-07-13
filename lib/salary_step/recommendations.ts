import type { SalaryStepEvaluationResult } from "@/lib/salary_step/types";

export function salaryStepSuggestedAction(result: SalaryStepEvaluationResult): string {
  if (result.mustSkip) return "Skip salary-step consideration for this cycle pending commander review.";
  if (result.manualReview) return "Route to commander review before annual salary-step decision.";
  if (result.eligibleDoubleStep) return "Consider for double-step review under configured policy.";
  if (result.missingHistory) return "Complete salary-step history before evaluation.";
  return "Proceed with standard salary-step consideration.";
}

export function salaryStepCommanderNotes(result: SalaryStepEvaluationResult): string[] {
  return [
    salaryStepSuggestedAction(result),
    ...result.commanderNotes,
    ...result.warnings,
  ].filter((note, index, all) => note.trim().length > 0 && all.indexOf(note) === index);
}
