/**
 * Typed error classes for the Vision Adapter layer, per project error
 * handling policy (docs/PROJECT_RULES.md): typed error classes per domain
 * rather than throwing raw strings/Error instances.
 */

export class VisionTimeout extends Error {
  constructor(message = "Vision request timed out") {
    super(message);
    this.name = "VisionTimeout";
  }
}

export class VisionRateLimit extends Error {
  public readonly statusCode = 429;

  constructor(
    message = "Vision request was rate limited",
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "VisionRateLimit";
  }
}

export class VisionParseError extends Error {
  constructor(
    message = "Vision response could not be parsed as JSON",
    public readonly rawContent?: string
  ) {
    super(message);
    this.name = "VisionParseError";
  }
}

export class VisionValidationError extends Error {
  constructor(
    message = "Vision response failed schema validation",
    public readonly errors: string[] = []
  ) {
    super(message);
    this.name = "VisionValidationError";
  }
}

/**
 * Thrown when the model's response was truncated because the completion
 * token budget was exhausted (`finish_reason: "length"`) — most commonly
 * because a reasoning-capable model spent the entire budget on internal
 * reasoning and had none left for visible output. Distinct from
 * `VisionParseError` (which means content *was* returned but wasn't valid
 * JSON): here, there is little or no content to parse in the first place,
 * so treating it as a parse failure would hide the real cause and the fix
 * (raise the token budget) from the caller.
 */
export class VisionTokenLimitError extends Error {
  constructor(
    message: string,
    public readonly completionTokens?: number,
    public readonly reasoningTokens?: number
  ) {
    super(message);
    this.name = "VisionTokenLimitError";
  }
}

/** Non-retryable transport/provider failure not covered by the above (e.g. 401, 400). */
export class VisionProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "VisionProviderError";
  }
}
