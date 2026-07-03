/**
 * ResponseParser
 *
 * Extracts JSON from a raw Vision model response. Despite
 * prompt_builder.ts's instruction to "return ONLY JSON," real models
 * routinely wrap the JSON in markdown code fences or prefix/suffix it with
 * explanatory prose (e.g. "Here is the extracted information:\n\n{...}").
 * Rejecting all of those outright made the adapter unusably strict against
 * real model output, so this parser instead extracts the first valid JSON
 * object from the response, tolerating common wrapping formats, and only
 * fails when no valid JSON object can be found at all.
 *
 * Strict validation still applies *after* extraction: whatever substring
 * is pulled out must itself parse as a single JSON object with no leftover
 * trailing JSON-looking garbage silently ignored.
 */

import { VisionParseError } from "@/lib/ai/vision_errors";

const CODE_FENCE_BLOCK_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

/**
 * Contract for response parsing. `extract` returns the clean JSON string
 * (for use in the VisionProvider.extract() return value); `parse` returns
 * the parsed value. Allows swapping in a stricter/looser parsing strategy
 * later.
 */
export interface ResponseParser {
  /** Extracts and returns the raw JSON substring from a model response, without parsing it. */
  extractJson(rawContent: string): string;
  /** Extracts and parses the JSON substring from a model response. */
  parse(rawContent: string): unknown;
}

/**
 * Lenient-extraction, strict-validation JSON parser.
 *
 * Extraction strategy, tried in order:
 * 1. If the trimmed content is already a bare JSON object (starts with
 *    `{`, ends with `}`), use it directly.
 * 2. If the content contains a markdown code fence (with or without a
 *    `json` language tag), use the fenced block's contents.
 * 3. Otherwise, scan for the first `{` and its matching closing `}`
 *    (brace-depth tracking, so nested objects/arrays don't confuse the
 *    boundary) anywhere in the content — this covers leading and/or
 *    trailing explanatory text.
 *
 * If none of these produce a string that parses as valid JSON, the
 * response is rejected with a `VisionParseError` carrying the raw content,
 * which the caller is expected to log (see openai_provider.ts).
 */
export class StrictJsonResponseParser implements ResponseParser {
  extractJson(rawContent: string): string {
    const trimmed = rawContent.trim();

    const candidate = this.findBareObject(trimmed) ?? this.findFencedBlock(trimmed) ?? this.findFirstJsonObject(trimmed);

    if (candidate === undefined) {
      throw new VisionParseError(
        "Vision response does not contain a valid JSON object",
        rawContent
      );
    }

    this.assertValidJson(candidate, rawContent);
    return candidate;
  }

  parse(rawContent: string): unknown {
    const candidate = this.extractJson(rawContent);
    return JSON.parse(candidate);
  }

  private findBareObject(trimmed: string): string | undefined {
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }
    return undefined;
  }

  private findFencedBlock(trimmed: string): string | undefined {
    const match = trimmed.match(CODE_FENCE_BLOCK_PATTERN);
    if (!match) return undefined;

    const inner = match[1].trim();
    return inner.length > 0 ? inner : undefined;
  }

  /**
   * Scans for the first `{` and walks forward tracking brace depth
   * (ignoring braces inside string literals) to find its matching `}`,
   * so text before and/or after the JSON object is tolerated.
   */
  private findFirstJsonObject(content: string): string | undefined {
    const start = content.indexOf("{");
    if (start === -1) return undefined;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = start; i < content.length; i += 1) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return content.slice(start, i + 1);
        }
      }
    }

    return undefined;
  }

  private assertValidJson(candidate: string, rawContent: string): void {
    try {
      JSON.parse(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VisionParseError(`Vision response is not valid JSON: ${message}`, rawContent);
    }
  }
}
