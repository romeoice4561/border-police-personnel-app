# AI Vision Import Prototype

Phase 2 prototype for the personnel import pipeline. This validates the
extraction -> validation -> confidence scoring flow end-to-end using a mock
vision provider. **No external API keys, no Supabase, no UI, no SQL.**

## What This Is

A standalone script and set of `lib/ai` modules that take one image path and
return a standardized JSON personnel record with a confidence score, without
touching a database or any real AI vision API.

## Files

- `lib/ai/prompt_builder.ts` — builds the instruction prompt for a GPT
  Vision-style model, telling it to extract rank, name, position, unit,
  phone, and career timeline, and to return only JSON.
- `lib/ai/vision_extractor.ts` — orchestrates the extraction: builds the
  prompt, calls a `VisionProvider`, parses the JSON response, validates it,
  and scores its confidence. Ships with a `MockVisionProvider` so the
  prototype runs without any API key.
- `lib/ai/json_validator.ts` — checks that all required fields are present
  and well-formed; returns a list of validation errors instead of throwing.
- `lib/ai/confidence_score.ts` — computes per-field confidence (name, phone,
  timeline) and an overall score from the extracted data.
- `lib/types/vision.ts` — shared TypeScript types for the extraction result,
  timeline entries, confidence, and validation output.
- `scripts/test_import.ts` — CLI entry point: loads an image path, runs the
  extractor, prints the resulting JSON and validation result, and writes the
  output to `scripts/sample_output/last_import_result.json`.
- `scripts/sample_output/example_extraction_result.json` — a checked-in
  example of what a full extraction result looks like.

## Running the Prototype

```bash
npx tsx scripts/test_import.ts [optional-image-path]
```

If no image path is given, it defaults to a placeholder path under
`scripts/sample_output/`. Since the vision provider is mocked, the script
does not actually need a real image to exist on disk yet — the mock
provider ignores the file contents and returns a fixed sample record. This
keeps the prototype runnable with zero external dependencies.

## Output Shape

```json
{
  "rank": "",
  "first_name": "",
  "last_name": "",
  "position": "",
  "unit": "",
  "phone": "",
  "timeline": [
    { "year": "", "position": "", "unit": "" }
  ],
  "notes": "",
  "confidence": 95
}
```

## Swapping in a Real Vision Provider

`extractPersonnelFromImage` accepts any object implementing the
`VisionProvider` interface (`extract(imagePath, prompt): Promise<string>`).
To integrate a real model later, implement that interface against the real
API and pass it in — no changes needed to the validator, scorer, or prompt
builder.

## Explicitly Out of Scope (this phase)

- No Supabase integration.
- No UI.
- No authentication.
- No SQL or database writes.
- No real external AI API calls — vision responses are mocked.
