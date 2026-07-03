import path from "node:path";
import fs from "node:fs";
import { extractPersonnelFromImage } from "@/lib/ai/vision_extractor";

async function main() {
  const imagePath = process.argv[2] ?? path.join(__dirname, "sample_output", "sample_profile.jpg");

  console.log(`Loading image: ${imagePath}`);
  console.log("(Prototype uses a mock vision provider — no external API keys required.)\n");

  const result = await extractPersonnelFromImage(imagePath);

  console.log("Extracted JSON:");
  console.log(JSON.stringify(result.data, null, 2));

  console.log("\nValidation:");
  console.log(JSON.stringify(result.validation, null, 2));

  const outputPath = path.join(__dirname, "sample_output", "last_import_result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nSaved result to: ${outputPath}`);
}

main().catch((error) => {
  console.error("test_import failed:", error);
  process.exitCode = 1;
});
