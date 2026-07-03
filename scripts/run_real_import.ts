/**
 * Vertical Slice 001 — real image, real AI, real JSON.
 *
 * Runs one local image through the full pipeline:
 * Local Image -> Layout Detector -> Prompt Builder -> OpenAI GPT-5.5 Vision
 * -> Response Parser -> Validator -> Normalizer -> Career Engine -> JSON File.
 *
 * No database, no Supabase, no UI. Output is a single JSON file under
 * scripts/sample_output/ (or an error.json on failure).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/run_real_import.ts <path-to-local-image>
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables before any project modules read process.env.
// tsx does not load .env files on its own (unlike Next.js's runtime), so
// this script loads them explicitly. .env.local takes precedence over
// .env; neither overrides variables already set in the shell environment.
const ENV_FILES = [".env.local", ".env"];
let loadedEnvFile: string | undefined;

for (const envFile of ENV_FILES) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    loadedEnvFile = loadedEnvFile ?? envFile;
  }
}

if (!loadedEnvFile) {
  console.warn(
    `Warning: no .env.local or .env file found in ${process.cwd()}. ` +
      "If OPENAI_API_KEY is not already set in your shell environment, set it in one of these files."
  );
}

import { processPersonnelImage, type PersonnelResult } from "@/lib/import/personnel_image_processor";

const SAMPLE_OUTPUT_DIR = path.join(__dirname, "sample_output");

function printSummary(imageName: string, result: PersonnelResult, outputPath: string): void {
  const rows: Array<[string, string]> = [
    ["Image", imageName],
    ["Template", result.processing_metadata.template],
    ["Confidence", `${result.confidence}%`],
    ["Career Years", String(result.career_intelligence.careerYears)],
    ["Units", String(result.career_intelligence.unitCount)],
    ["Timeline Entries", String(result.career_intelligence.timelineEntryCount)],
    ["Estimated Cost", `$${result.processing_metadata.estimated_cost_usd.toFixed(3)}`],
  ];

  for (const [label, value] of rows) {
    console.log(label);
    console.log(value);
    console.log("---------------------------------");
  }

  console.log("Saved");
  console.log(path.relative(process.cwd(), outputPath));
}

function writeJson(filename: string, data: unknown): string {
  fs.mkdirSync(SAMPLE_OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(SAMPLE_OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  return outputPath;
}

async function main() {
  const imageArg = process.argv[2];

  if (!imageArg) {
    console.error("Usage: npx tsx scripts/run_real_import.ts <path-to-local-image>");
    process.exitCode = 1;
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Export it or add it to .env.local, then re-run.");
    process.exitCode = 1;
    return;
  }

  const imagePath = path.resolve(imageArg);
  const imageName = path.basename(imagePath);

  if (!fs.existsSync(imagePath)) {
    const errorPath = writeJson("error.json", {
      image: imageName,
      error: `Image file not found: ${imagePath}`,
    });
    console.error(`Image not found: ${imagePath}`);
    console.error(`Error details saved to ${errorPath}`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await processPersonnelImage(imagePath);

    if (!result.validation.valid) {
      const errorPath = writeJson("error.json", {
        image: imageName,
        error: "Validation failed",
        validation: result.validation,
        original_extraction: result.original_extraction,
      });
      console.error("Extraction failed validation.");
      console.error(`Error details saved to ${errorPath}`);
      process.exitCode = 1;
      return;
    }

    const outputPath = writeJson("personnel_result.json", result);
    printSummary(imageName, result, outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorPath = writeJson("error.json", {
      image: imageName,
      error: message,
    });
    console.error(`Import failed: ${message}`);
    console.error(`Error details saved to ${errorPath}`);
    process.exitCode = 1;
  }
}

main();
