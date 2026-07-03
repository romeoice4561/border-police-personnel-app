/**
 * Smoke test for OpenAIVisionProvider.
 *
 * Loads one image (path via argv, or an env default), calls the real
 * OpenAI API through extractPersonnelFromImage, and prints the resulting
 * JSON. Requires OPENAI_API_KEY to be set; exits early with instructions
 * if it is not, rather than silently falling back to a mock (this test
 * exists specifically to exercise the real adapter).
 */

import { extractPersonnelFromImage } from "@/lib/ai/vision_extractor";
import { createOpenAIVisionProviderFromEnv } from "@/lib/ai/openai_provider";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set.");
    console.error("Set it in your environment or a .env.local file, then re-run:");
    console.error("  OPENAI_API_KEY=sk-... npx tsx scripts/test_openai_vision.ts [image-path-or-url]");
    process.exitCode = 1;
    return;
  }

  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: npx tsx scripts/test_openai_vision.ts <image-path-or-url>");
    console.error("The image must be a publicly reachable URL or a base64 data: URI.");
    process.exitCode = 1;
    return;
  }

  const provider = createOpenAIVisionProviderFromEnv();

  console.log(`Calling OpenAI (model: ${process.env.OPENAI_MODEL ?? "gpt-5.5"}) for image: ${imagePath}`);

  const result = await extractPersonnelFromImage(imagePath, provider);

  console.log("\nExtracted JSON:");
  console.log(JSON.stringify(result.data, null, 2));

  console.log("\nValidation:");
  console.log(JSON.stringify(result.validation, null, 2));
}

main().catch((error) => {
  console.error("test_openai_vision failed:", error);
  process.exitCode = 1;
});
