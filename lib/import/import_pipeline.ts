/**
 * ImportPipeline
 *
 * Runs a single ImportJob through the full stage sequence:
 * Layout Detector -> Vision Extractor -> Validator -> Normalizer -> JSON.
 *
 * (Scanner, Queue, and Scheduler stages happen before a job reaches the
 * pipeline; see import_queue.ts / import_scheduler.ts / import_worker.ts.)
 *
 * Every stage is injected via an interface so real implementations (a real
 * Google Drive-backed scanner upstream, a real Vision API client, etc.) can
 * be swapped in later without touching orchestration logic. This phase only
 * wires together the Phase 2 (lib/ai) and Phase 2.5 (lib/layout) modules —
 * no new Vision or Drive implementation is added here.
 */

import type { ImageInput, TemplateDetectionResult } from "@/lib/layout/layout_types";
import { TemplateDetector } from "@/lib/layout/template_detector";
import { extractPersonnelFromImage, MockVisionProvider, type VisionProvider } from "@/lib/ai/vision_extractor";
import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";
import type { ImportJob, ImportJobResult } from "@/types/import";
import { transitionJob } from "@/lib/import/import_job";
import { failureResult, successResult } from "@/lib/import/job_result";

/** Contract for the layout detection stage. */
export interface LayoutDetectorStage {
  detect(image: ImageInput): Promise<TemplateDetectionResult>;
}

/** Contract for the vision extraction stage. */
export interface VisionExtractorStage {
  extract(imagePath: string): Promise<{ data: PersonnelExtraction; validation: ValidationResult }>;
}

/**
 * Contract for a normalization stage: reshapes/cleans validated extraction
 * data into the final JSON shape persisted downstream. Identity by default;
 * a future phase may add trimming, casing, phone formatting, etc.
 */
export interface NormalizerStage {
  normalize(data: PersonnelExtraction): PersonnelExtraction;
}

export class IdentityNormalizer implements NormalizerStage {
  normalize(data: PersonnelExtraction): PersonnelExtraction {
    return data;
  }
}

/** Default vision stage adapter over the Phase 2 extractor function. */
export class DefaultVisionExtractorStage implements VisionExtractorStage {
  constructor(private readonly provider: VisionProvider = new MockVisionProvider()) {}

  async extract(imagePath: string) {
    return extractPersonnelFromImage(imagePath, this.provider);
  }
}

/** Default layout stage adapter over the Phase 2.5 TemplateDetector. */
export class DefaultLayoutDetectorStage implements LayoutDetectorStage {
  constructor(private readonly detector: TemplateDetector = new TemplateDetector()) {}

  async detect(image: ImageInput) {
    return this.detector.detect(image);
  }
}

export interface ImportPipelineDependencies {
  layoutDetector?: LayoutDetectorStage;
  visionExtractor?: VisionExtractorStage;
  normalizer?: NormalizerStage;
}

/**
 * Orchestrates a single job through all pipeline stages, advancing its
 * status at each transition per docs/IMPORT_STATE_MACHINE.md.
 */
export class ImportPipeline {
  private readonly layoutDetector: LayoutDetectorStage;
  private readonly visionExtractor: VisionExtractorStage;
  private readonly normalizer: NormalizerStage;

  constructor(dependencies: ImportPipelineDependencies = {}) {
    this.layoutDetector = dependencies.layoutDetector ?? new DefaultLayoutDetectorStage();
    this.visionExtractor = dependencies.visionExtractor ?? new DefaultVisionExtractorStage();
    this.normalizer = dependencies.normalizer ?? new IdentityNormalizer();
  }

  /**
   * Runs the full stage sequence for one job. Returns a discriminated
   * ImportJobResult rather than throwing, so callers (the worker) can
   * decide retry/failure handling uniformly.
   */
  async run(job: ImportJob, image: ImageInput): Promise<ImportJobResult> {
    let current = job;

    try {
      current = transitionJob(current, "Processing");

      const detection = await this.layoutDetector.detect(image);
      current = { ...current, template: detection.template_id };

      current = transitionJob(current, "Vision");
      const { data, validation: visionValidation } = await this.visionExtractor.extract(image.source);

      current = transitionJob(current, "Parsing");
      const normalized = this.normalizer.normalize(data);

      current = transitionJob(current, "Validating");

      if (!visionValidation.valid) {
        current = { ...current, confidence: normalized.confidence, last_error: "Validation failed" };
        current = transitionJob(current, "Failed");
        return failureResult(current, "Validation failed", "Validating");
      }

      current = { ...current, confidence: normalized.confidence };
      current = transitionJob(current, "Completed");

      return successResult({
        job: current,
        detection,
        extraction: normalized,
        validation: visionValidation,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = { ...current, last_error: message };
      const finalJob = canTransitionToFailed(failed.status) ? transitionJob(failed, "Failed") : failed;
      return failureResult(finalJob, message, current.status);
    }
  }
}

function canTransitionToFailed(status: ImportJob["status"]): boolean {
  return status !== "Completed" && status !== "Failed" && status !== "Cancelled";
}
