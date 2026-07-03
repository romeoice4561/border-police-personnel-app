/**
 * Typed error classes for the Google Drive layer, per project error
 * handling policy (docs/PROJECT_RULES.md): typed error classes per domain
 * rather than throwing raw strings/Error instances.
 */

export class DriveProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "DriveProviderError";
  }
}
