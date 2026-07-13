/**
 * Pluggable eligibility framework.
 *
 * This intentionally does not encode promotion/award/training policy yet.
 * Future modules register rules against this pure evaluator.
 */

import type { EligibilityContext, EligibilityModule, EligibilityResult, EligibilityRule } from "@/lib/personnel_calendar/types";

export function emptyEligibilityResult(module: EligibilityModule, reason = "No rule registered."): EligibilityResult {
  return {
    module,
    status: "not_applicable",
    reasons: [reason],
    effectiveDate: null,
  };
}

export function evaluateEligibility(
  context: EligibilityContext,
  rules: readonly EligibilityRule[],
  modules: readonly EligibilityModule[] = ["PROMOTION", "AWARDS", "TRAINING", "RETIREMENT"]
): EligibilityResult[] {
  return modules.map((module) => {
    const moduleRules = rules.filter((rule) => rule.module === module);
    if (moduleRules.length === 0) return emptyEligibilityResult(module);

    const results = moduleRules.map((rule) => rule.evaluate(context));
    if (results.some((result) => result.status === "not_eligible")) {
      return mergeResults(module, "not_eligible", results);
    }
    if (results.some((result) => result.status === "needs_review")) {
      return mergeResults(module, "needs_review", results);
    }
    if (results.every((result) => result.status === "eligible")) {
      return mergeResults(module, "eligible", results);
    }
    return mergeResults(module, "not_applicable", results);
  });
}

function mergeResults(
  module: EligibilityModule,
  status: EligibilityResult["status"],
  results: readonly EligibilityResult[]
): EligibilityResult {
  return {
    module,
    status,
    reasons: results.flatMap((result) => result.reasons),
    effectiveDate: results.find((result) => result.effectiveDate)?.effectiveDate ?? null,
  };
}
