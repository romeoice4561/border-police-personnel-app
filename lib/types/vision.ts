export interface TimelineEntry {
  year: string;
  position: string;
  /**
   * Optional: many official personnel records genuinely omit the unit for
   * a given historical position (see docs/VALIDATION_ENGINE.md). A missing
   * unit is a data-quality signal (see ValidationWarning), not a fatal
   * validation error.
   */
  unit?: string | null;
}

export interface PersonnelExtraction {
  rank: string;
  first_name: string;
  last_name: string;
  position: string;
  unit: string;
  phone: string;
  timeline: TimelineEntry[];
  notes: string;
  confidence: number;
}

export interface FieldConfidence {
  name: number;
  phone: number;
  timeline: number;
  overall: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * A non-fatal data-quality observation (e.g. a genuinely-missing optional
 * field). Warnings never affect `ValidationResult.valid` — see
 * docs/VALIDATION_ENGINE.md for the fatal-vs-quality validation split.
 */
export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Always present (defaults to `[]`); additive field, safe for existing `validation.valid`/`validation.errors` consumers to ignore. */
  warnings: ValidationWarning[];
}

export interface VisionExtractionResult {
  data: PersonnelExtraction;
  validation: ValidationResult;
}
