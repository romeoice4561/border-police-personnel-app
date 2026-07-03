/**
 * NormalizationEngine
 *
 * Phase 7.5. Sits strictly between Validation and the Career Engine:
 *
 *   Validation -> Normalization Engine -> Career Engine
 *
 * Applies, in order, to every extracted field:
 *   Rule 1  - Thai numeral -> Arabic numeral conversion (recursive across
 *             every string field).
 *   Rule 2  - whitespace cleanup.
 *   Rule 3  - dash character normalization.
 *   Rule 4  - duplicated/mixed punctuation cleanup.
 *   Rule 5  - phone number normalization.
 *   Rule 6  - year normalization (bare numeral `year` + optional
 *             `display_year`).
 *   Rule 7  - timeline sorted newest -> oldest.
 *   Rule 8  - duplicate timeline rows removed.
 *   Rule 9  - unit cleanup (whitespace only; never invented).
 *   Rule 10 - never hallucinate: missing/blank fields are left as-is, not
 *             guessed at, anywhere in this engine.
 *   Rule 11 - every stage (and this engine as a whole) is pure: takes an
 *             input object, returns a new output object, never mutates
 *             its argument.
 *
 * Every collaborator (Thai numeral converter, text cleaner, phone
 * normalizer, timeline normalizer) is constructor-injected, so this engine
 * can be composed/tested independently of any concrete implementation
 * (interface-first, SOLID: this class's only responsibility is
 * orchestrating field-level normalizers, not implementing any rule
 * itself).
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { NormalizationEngine, NormalizedPersonnelExtraction } from "@/lib/normalize/normalization_types";
import type { ThaiNumberConverterEngine } from "@/lib/normalize/thai_number_converter";
import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";
import type { TextCleanerEngine } from "@/lib/normalize/text_cleaner";
import { TextCleaner } from "@/lib/normalize/text_cleaner";
import type { PhoneNormalizerEngine } from "@/lib/normalize/phone_normalizer";
import { PhoneNormalizer } from "@/lib/normalize/phone_normalizer";
import type { TimelineNormalizerEngine } from "@/lib/normalize/timeline_normalizer";
import { TimelineNormalizer } from "@/lib/normalize/timeline_normalizer";

export interface PersonnelNormalizationEngineDependencies {
  thaiNumberConverter?: ThaiNumberConverterEngine;
  textCleaner?: TextCleanerEngine;
  phoneNormalizer?: PhoneNormalizerEngine;
  timelineNormalizer?: TimelineNormalizerEngine;
}

/**
 * Default normalization engine for `PersonnelExtraction` records.
 *
 * Scalar text fields (`rank`, `first_name`, `last_name`, `position`,
 * `unit`, `notes`) go through Thai-numeral conversion followed by text
 * cleanup uniformly — no field-specific special casing, so the same rules
 * apply consistently across every region/template (a requirement for
 * scaling to 10,000+ records from multiple regions). `phone` additionally
 * goes through phone-specific reformatting after the shared cleanup.
 * `timeline` is delegated entirely to `TimelineNormalizer`, which applies
 * the same shared field cleanup per-entry plus year/sort/dedup rules.
 */
export class PersonnelNormalizationEngine implements NormalizationEngine {
  private readonly thaiNumberConverter: ThaiNumberConverterEngine;
  private readonly textCleaner: TextCleanerEngine;
  private readonly phoneNormalizer: PhoneNormalizerEngine;
  private readonly timelineNormalizer: TimelineNormalizerEngine;

  constructor(dependencies: PersonnelNormalizationEngineDependencies = {}) {
    this.thaiNumberConverter = dependencies.thaiNumberConverter ?? new ThaiNumberConverter();
    this.textCleaner = dependencies.textCleaner ?? new TextCleaner();
    this.phoneNormalizer = dependencies.phoneNormalizer ?? new PhoneNormalizer();
    this.timelineNormalizer = dependencies.timelineNormalizer ?? new TimelineNormalizer();
  }

  normalize(extraction: PersonnelExtraction): NormalizedPersonnelExtraction {
    return {
      rank: this.cleanText(extraction.rank),
      first_name: this.cleanText(extraction.first_name),
      last_name: this.cleanText(extraction.last_name),
      position: this.cleanText(extraction.position),
      unit: this.cleanText(extraction.unit),
      phone: this.normalizePhone(extraction.phone),
      timeline: this.timelineNormalizer.normalize(extraction.timeline),
      notes: this.cleanText(extraction.notes),
      confidence: extraction.confidence,
    };
  }

  /** Rules 1-4: Thai numeral conversion, then whitespace/dash/punctuation cleanup. Rule 10: empty stays empty, never guessed. */
  private cleanText(value: string): string {
    if (!value) return value;
    return this.textCleaner.normalize(this.thaiNumberConverter.normalize(value));
  }

  /** Rule 5, applied after the same shared cleanup every other text field receives. */
  private normalizePhone(value: string): string {
    const cleaned = this.cleanText(value);
    if (!cleaned) return cleaned;
    return this.phoneNormalizer.normalize(cleaned);
  }
}
