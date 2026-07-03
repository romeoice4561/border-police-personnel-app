/**
 * Personnel extraction validation.
 *
 * Split into three stages, each with a narrow, single responsibility
 * (SOLID: separate structural/required/quality concerns rather than one
 * monolithic pass), so future rules can be added to the right stage
 * without touching the others:
 *
 *   validateStructure()      -> malformed shape (wrong types, timeline not
 *                                an array): always fatal.
 *   validateRequiredFields()  -> fields that MUST be present for a record to
 *                                be usable at all: fatal.
 *   validateQuality()         -> fields that are commonly, legitimately
 *                                absent in real-world source records (e.g.
 *                                timeline[].unit): non-fatal, surfaced as
 *                                warnings so data quality stays visible
 *                                without blocking import.
 *
 * This exists because real official personnel records (see
 * docs/VALIDATION_ENGINE.md) routinely omit `unit` for some historical
 * timeline entries — that is correct OCR behavior (the AI should not
 * hallucinate a value that isn't on the source document), not a defect,
 * and must not fail validation.
 */

import type {
  PersonnelExtraction,
  TimelineEntry,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "@/lib/types/vision";

/** Fields that must be present and non-empty for the record to be usable at all. */
const REQUIRED_STRING_FIELDS: Array<keyof PersonnelExtraction> = [
  "rank",
  "first_name",
  "last_name",
  "position",
  "unit",
];

/** Per-timeline-entry fields that must be present and non-empty. `unit` is deliberately excluded — see module docstring. */
const REQUIRED_TIMELINE_FIELDS: Array<keyof Pick<TimelineEntry, "year" | "position">> = ["year", "position"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Contract for a single validation stage. Allows composing/reordering/extending stages independently. */
export interface ValidationStage {
  run(data: Partial<PersonnelExtraction>): ValidationError[];
}

/** Contract for a quality (non-fatal) validation stage. */
export interface QualityValidationStage {
  run(data: Partial<PersonnelExtraction>): ValidationWarning[];
}

/**
 * Structural validation: is the shape of the data even well-formed enough
 * to inspect further (correct types, timeline is an array)? These are
 * always fatal — no amount of "real-world data is messy" tolerance applies
 * to a response that isn't shaped like a PersonnelExtraction at all.
 */
export class StructureValidationStage implements ValidationStage {
  run(data: Partial<PersonnelExtraction>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (data.phone !== undefined && data.phone !== null && typeof data.phone !== "string") {
      errors.push({ field: "phone", message: "phone must be a string" });
    }

    if (data.notes !== undefined && data.notes !== null && typeof data.notes !== "string") {
      errors.push({ field: "notes", message: "notes must be a string" });
    }

    if (data.timeline === undefined) {
      errors.push({ field: "timeline", message: "timeline is required and must be an array" });
    } else if (!Array.isArray(data.timeline)) {
      errors.push({ field: "timeline", message: "timeline must be an array" });
    } else {
      data.timeline.forEach((entry, index) => {
        if (entry === null || typeof entry !== "object") {
          errors.push({ field: `timeline[${index}]`, message: "timeline entry must be an object" });
          return;
        }
        if (entry.unit !== undefined && entry.unit !== null && typeof entry.unit !== "string") {
          errors.push({ field: `timeline[${index}].unit`, message: "unit must be a string, null, or omitted" });
        }
      });
    }

    if (
      data.confidence !== undefined &&
      (typeof data.confidence !== "number" ||
        Number.isNaN(data.confidence) ||
        data.confidence < 0 ||
        data.confidence > 100)
    ) {
      errors.push({ field: "confidence", message: "confidence must be a number between 0 and 100" });
    }

    return errors;
  }
}

/**
 * Required-field validation: fields without which the record cannot be
 * considered a usable personnel extraction. Assumes `StructureValidationStage`
 * has already confirmed `timeline` is an array of objects — this stage only
 * checks presence/non-emptiness, not shape.
 */
export class RequiredFieldsValidationStage implements ValidationStage {
  run(data: Partial<PersonnelExtraction>): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const field of REQUIRED_STRING_FIELDS) {
      if (!isNonEmptyString(data[field])) {
        errors.push({ field, message: `${field} is required and must be a non-empty string` });
      }
    }

    if (data.confidence === undefined) {
      errors.push({ field: "confidence", message: "confidence is required and must be a number between 0 and 100" });
    }

    if (Array.isArray(data.timeline)) {
      data.timeline.forEach((entry, index) => {
        if (entry === null || typeof entry !== "object") return; // reported by StructureValidationStage

        for (const field of REQUIRED_TIMELINE_FIELDS) {
          if (!isNonEmptyString(entry[field])) {
            errors.push({
              field: `timeline[${index}].${field}`,
              message: `${field} is required and must be a non-empty string`,
            });
          }
        }
      });
    }

    return errors;
  }
}

/**
 * Quality validation: fields that are legitimately, commonly absent in
 * real source records and must never invalidate the extraction, but are
 * still worth surfacing as a data-quality signal (e.g. for review UIs or
 * batch-import reporting across 10,000+ records — see
 * docs/VALIDATION_ENGINE.md, "Future confidence rules").
 *
 * No hardcoded per-record special cases: this checks the same rule
 * (unit presence) uniformly across every timeline entry and record.
 */
export class QualityValidationStageImpl implements QualityValidationStage {
  run(data: Partial<PersonnelExtraction>): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!isNonEmptyString(data.phone)) {
      warnings.push({ field: "phone", message: "phone is missing" });
    }

    if (!isNonEmptyString(data.notes)) {
      warnings.push({ field: "notes", message: "notes is missing" });
    }

    if (Array.isArray(data.timeline)) {
      data.timeline.forEach((entry, index) => {
        if (entry === null || typeof entry !== "object") return; // reported by StructureValidationStage

        if (!isNonEmptyString(entry.unit)) {
          warnings.push({ field: `timeline[${index}].unit`, message: "unit is missing" });
        }
      });
    }

    return warnings;
  }
}

export interface PersonnelValidatorDependencies {
  structureStage?: ValidationStage;
  requiredFieldsStage?: ValidationStage;
  qualityStage?: QualityValidationStage;
}

/**
 * Runs all three stages and combines their results. Structural errors
 * short-circuit required-field checks on the same malformed section only
 * where noted above (e.g. a non-object timeline entry isn't re-checked for
 * required fields); otherwise all stages run and their findings are
 * merged, since a record can have multiple independent issues.
 */
export class PersonnelValidator {
  private readonly structureStage: ValidationStage;
  private readonly requiredFieldsStage: ValidationStage;
  private readonly qualityStage: QualityValidationStage;

  constructor(dependencies: PersonnelValidatorDependencies = {}) {
    this.structureStage = dependencies.structureStage ?? new StructureValidationStage();
    this.requiredFieldsStage = dependencies.requiredFieldsStage ?? new RequiredFieldsValidationStage();
    this.qualityStage = dependencies.qualityStage ?? new QualityValidationStageImpl();
  }

  validate(data: Partial<PersonnelExtraction>): ValidationResult {
    const structureErrors = this.structureStage.run(data);
    const requiredFieldErrors = this.requiredFieldsStage.run(data);
    const warnings = this.qualityStage.run(data);

    const errors = [...structureErrors, ...requiredFieldErrors];

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Backwards-compatible function form, matching the pre-existing call
 * signature used by vision_extractor.ts and any other caller. Delegates to
 * `PersonnelValidator` with default stages.
 */
export function validatePersonnelExtraction(data: Partial<PersonnelExtraction>): ValidationResult {
  return new PersonnelValidator().validate(data);
}
