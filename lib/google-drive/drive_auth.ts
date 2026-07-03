/**
 * Google Drive authentication.
 *
 * Loads a Google service account credentials JSON from the environment —
 * never from source code — and builds an authenticated `googleapis` auth
 * client scoped read-only to Drive. This module is the only place in the
 * codebase that touches credential material; `GoogleDriveClient`
 * (google_drive_client.ts) receives an already-authenticated client and
 * never reads environment variables or file paths itself.
 *
 * Supported configuration, checked in this order:
 *   1. `GOOGLE_APPLICATION_CREDENTIALS` — path to a service account JSON
 *      key file (the standard Google Cloud client library convention).
 *   2. `GOOGLE_DRIVE_CREDENTIALS` — the service account JSON itself,
 *      inline (useful for environments where writing a credentials file to
 *      disk is inconvenient).
 */

import fs from "node:fs";
import { google } from "googleapis";
import type { Auth } from "googleapis";

/** Read-only Drive scope only — this phase never creates, updates, or deletes any Drive content. */
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export class DriveAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveAuthConfigError";
  }
}

export interface DriveCredentialsSource {
  env?: NodeJS.ProcessEnv;
}

/**
 * Locates and parses the service account credentials JSON from the
 * environment, per the two supported variables documented above. Throws a
 * `DriveAuthConfigError` with a readable message if neither is set or the
 * content is not valid JSON — never silently falls back to an
 * unauthenticated client.
 */
export function loadServiceAccountCredentials(source: DriveCredentialsSource = {}): Record<string, unknown> {
  const env = source.env ?? process.env;

  const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  const inlineCredentials = env.GOOGLE_DRIVE_CREDENTIALS;

  if (credentialsPath) {
    if (!fs.existsSync(credentialsPath)) {
      throw new DriveAuthConfigError(
        `GOOGLE_APPLICATION_CREDENTIALS is set to "${credentialsPath}", but no file exists at that path.`
      );
    }

    try {
      return JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DriveAuthConfigError(
        `GOOGLE_APPLICATION_CREDENTIALS file at "${credentialsPath}" is not valid JSON: ${message}`
      );
    }
  }

  if (inlineCredentials) {
    try {
      return JSON.parse(inlineCredentials);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DriveAuthConfigError(`GOOGLE_DRIVE_CREDENTIALS is not valid JSON: ${message}`);
    }
  }

  throw new DriveAuthConfigError(
    "No Google Drive credentials configured. Set GOOGLE_APPLICATION_CREDENTIALS to a service " +
      "account JSON key file path, or GOOGLE_DRIVE_CREDENTIALS to the JSON content directly."
  );
}

/**
 * Builds an authenticated, read-only-scoped Google auth client from the
 * environment-sourced service account credentials.
 */
export function createDriveAuthClient(source: DriveCredentialsSource = {}): Auth.GoogleAuth {
  const credentials = loadServiceAccountCredentials(source);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [DRIVE_READONLY_SCOPE],
  });
}
