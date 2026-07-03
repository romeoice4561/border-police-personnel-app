import { buildVisionPrompt } from "@/lib/ai/prompt_builder";
import { validatePersonnelExtraction } from "@/lib/ai/json_validator";
import { scoreExtraction } from "@/lib/ai/confidence_score";
import type { PersonnelExtraction, VisionExtractionResult } from "@/lib/types/vision";

export interface VisionProvider {
  extract(imagePath: string, prompt: string): Promise<string>;
}

/**
 * Placeholder provider so the prototype runs with no external API keys.
 * Swap for a real GPT Vision (or equivalent) client in a later phase.
 */
export class MockVisionProvider implements VisionProvider {
  async extract(): Promise<string> {
    const mockResponse: PersonnelExtraction = {
      rank: "Sergeant",
      first_name: "John",
      last_name: "Doe",
      position: "Field Supervisor",
      unit: "Southern Border Division",
      phone: "555-123-4567",
      timeline: [
        { year: "2018", position: "Officer", unit: "Southern Border Division" },
        { year: "2021", position: "Field Supervisor", unit: "Southern Border Division" },
      ],
      notes: "Extracted from mock provider for prototype testing.",
      confidence: 92,
    };

    return JSON.stringify(mockResponse);
  }
}

function parseModelOutput(raw: string): Partial<PersonnelExtraction> {
  try {
    return JSON.parse(raw) as Partial<PersonnelExtraction>;
  } catch {
    throw new Error("Vision provider returned invalid JSON");
  }
}

export async function extractPersonnelFromImage(
  imagePath: string,
  provider: VisionProvider = new MockVisionProvider()
): Promise<VisionExtractionResult> {
  const prompt = buildVisionPrompt();
  const rawOutput = await provider.extract(imagePath, prompt);
  const parsed = parseModelOutput(rawOutput);

  const validation = validatePersonnelExtraction(parsed);
  const confidence = scoreExtraction(parsed);

  const data: PersonnelExtraction = {
    rank: parsed.rank ?? "",
    first_name: parsed.first_name ?? "",
    last_name: parsed.last_name ?? "",
    position: parsed.position ?? "",
    unit: parsed.unit ?? "",
    phone: parsed.phone ?? "",
    timeline: parsed.timeline ?? [],
    notes: parsed.notes ?? "",
    confidence: confidence.overall,
  };

  return { data, validation };
}
