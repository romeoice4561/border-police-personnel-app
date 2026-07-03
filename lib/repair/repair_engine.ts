/**
 * RepairEngine (Phase 10C).
 *
 * The new stage inserted between OpenAI extraction and Validation:
 *   OpenAI -> RepairEngine -> Validation -> Normalization -> Career Engine
 *
 * It applies the declarative repair rules (repair_rules.ts) — which only ever
 * normalize/reformat/convert/trim/dedup/remove-invalid/blank→null, never
 * invent — then RE-VALIDATES the repaired extraction using the EXISTING,
 * UNMODIFIED PersonnelValidator, so the report captures validation before vs.
 * after. The Validation Engine's rules are not weakened or changed in any way;
 * repair simply cleans the model's own output so a record that was failing on
 * formatting/placeholder issues can now pass legitimately.
 *
 * Pure and injectable: rules and validator are injected; no globals, no I/O.
 */

import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";
import { PersonnelValidator } from "@/lib/ai/json_validator";
import type { RepairAction, RepairEngine, RepairOutcome } from "@/lib/repair/repair_types";
import { createDefaultRepairRules, type RepairRule } from "@/lib/repair/repair_rules";

export interface DefaultRepairEngineDependencies {
  rules?: RepairRule[];
  /** The existing validator, reused to compute the after-repair result. Never modified. */
  validator?: PersonnelValidator;
}

export class DefaultRepairEngine implements RepairEngine {
  private readonly rules: RepairRule[];
  private readonly validator: PersonnelValidator;

  constructor(dependencies: DefaultRepairEngineDependencies = {}) {
    this.rules = dependencies.rules ?? createDefaultRepairRules();
    this.validator = dependencies.validator ?? new PersonnelValidator();
  }

  repair(extraction: PersonnelExtraction, beforeValidation: ValidationResult): RepairOutcome {
    const actions: RepairAction[] = [];

    // Apply each rule to a running copy; rules return patches, never mutate.
    let current: PersonnelExtraction = { ...extraction };
    for (const rule of this.rules) {
      const { patch, actions: ruleActions } = rule.apply(current);
      current = { ...current, ...patch };
      actions.push(...ruleActions);
    }

    const afterValidation = this.validator.validate(current);

    const warnings = afterValidation.warnings.map((w) => `${w.field}: ${w.message}`);

    return {
      repaired: current,
      report: {
        repairsApplied: actions,
        beforeValidation,
        afterValidation,
        warnings,
      },
    };
  }
}
