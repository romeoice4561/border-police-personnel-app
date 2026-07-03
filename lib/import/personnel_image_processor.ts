/**
 * PersonnelImageProcessor
 *
 * Single-image processing pipeline, extracted from Phase 7's
 * `scripts/run_real_import.ts` so both the single-image script and the
 * Phase 9A batch runner (`scripts/run_batch_import.ts`) call the exact
 * same code path — no duplicated pipeline logic between them.
 *
 * Pipeline: Local Image -> Layout Detector -> Prompt Builder -> Vision
 * Extractor -> Validator -> Normalizer -> Career Engine -> PersonnelResult.
 *
 * Every collaborator is injected via `PersonnelImageProcessorDependencies`
 * with the same defaults `run_real_import.ts` used, so behavior is
 * unchanged; this module only relocates the logic, it does not alter it.
 */

import fs from "node:fs";
import path from "node:path";

import { buildVisionPrompt } from "@/lib/ai/prompt_builder";
import { extractPersonnelFromImage, type VisionProvider } from "@/lib/ai/vision_extractor";
import { createOpenAIVisionProviderFromEnv, DEFAULT_OPENAI_MODEL } from "@/lib/ai/openai_provider";
import { HeuristicTokenEstimator, type TokenEstimator } from "@/lib/ai/token_estimator";
import { DefaultCostEstimator, type CostEstimator } from "@/lib/ai/cost_estimator";
import { TemplateDetector } from "@/lib/layout/template_detector";
import type { LayoutDetectorStage } from "@/lib/import/import_pipeline";
import { DefaultCareerEngine, type CareerEngine, type CareerIntelligence } from "@/lib/career/career_engine";
import type { PersonnelExtraction, ValidationResult } from "@/lib/types/vision";

export interface ProcessingMetadata {
  image: string;
  processing_time_ms: number;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  template: string;
  confidence: number;
}

export interface PersonnelResult {
  original_extraction: PersonnelExtraction;
  normalized_extraction: PersonnelExtraction;
  career_intelligence: CareerIntelligence;
  validation: ValidationResult;
  confidence: number;
  processing_metadata: ProcessingMetadata;
}

/** Loads a local image file and encodes it as a base64 data URI for the Vision API. */
export function loadImageAsDataUri(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export interface PersonnelImageProcessorDependencies {
  layoutDetector?: LayoutDetectorStage;
  visionProvider?: VisionProvider;
  careerEngine?: CareerEngine;
  tokenEstimator?: TokenEstimator;
  costEstimator?: CostEstimator;
}

/**
 * Processes exactly one local image through the full pipeline and returns
 * the assembled PersonnelResult. Throws on any pipeline failure (image
 * read error, Vision API error, etc.) — callers (single-image script,
 * batch runner) decide how to handle/report that, matching each script's
 * own error-handling needs rather than baking file-writing into this
 * module.
 *
 * Does NOT check `validation.valid` itself — that decision (e.g. whether
 * an invalid record still gets written, or is instead reported as
 * "failed") is left to the caller, since Phase 7's single-image script and
 * the Phase 9A batch runner want the same validation data but slightly
 * different handling around it.
 */
export async function processPersonnelImage(
  imagePath: string,
  dependencies: PersonnelImageProcessorDependencies = {}
): Promise<PersonnelResult> {
  const startedAt = Date.now();

  const layoutDetector = dependencies.layoutDetector ?? new TemplateDetector();
  const careerEngine = dependencies.careerEngine ?? new DefaultCareerEngine();
  const tokenEstimator = dependencies.tokenEstimator ?? new HeuristicTokenEstimator();
  const costEstimator = dependencies.costEstimator ?? new DefaultCostEstimator();

  const dataUri = loadImageAsDataUri(imagePath);

  const detection = await layoutDetector.detect({ source: imagePath });

  const provider = dependencies.visionProvider ?? createOpenAIVisionProviderFromEnv();
  const prompt = buildVisionPrompt();

  const { data: originalExtraction, validation } = await extractPersonnelFromImage(dataUri, provider);

  // Normalizer stage: identity, matching Phase 3's IdentityNormalizer default.
  const normalizedExtraction: PersonnelExtraction = { ...originalExtraction };

  const careerIntelligence = careerEngine.analyze(normalizedExtraction);

  const tokens = tokenEstimator.estimate(prompt, 1, JSON.stringify(originalExtraction));
  const cost = costEstimator.estimate(1, tokens);

  const processingTimeMs = Date.now() - startedAt;

  return {
    original_extraction: originalExtraction,
    normalized_extraction: normalizedExtraction,
    career_intelligence: careerIntelligence,
    validation,
    confidence: normalizedExtraction.confidence,
    processing_metadata: {
      image: path.basename(imagePath),
      processing_time_ms: processingTimeMs,
      model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      prompt_tokens: tokens.promptTokens,
      completion_tokens: tokens.responseTokens,
      estimated_cost_usd: cost.estimatedCostUsd,
      template: detection.template_id,
      confidence: normalizedExtraction.confidence,
    },
  };
}
