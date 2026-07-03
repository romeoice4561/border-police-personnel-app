/**
 * Unit tests for Google Drive credential loading. No real credentials or
 * network calls are used — these only exercise the environment-variable
 * resolution and error paths.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DriveAuthConfigError, loadServiceAccountCredentials } from "@/lib/google-drive/drive_auth";

const FAKE_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "test-project",
  private_key: "fake-key",
  client_email: "test@test-project.iam.gserviceaccount.com",
};

/** Builds a fake env for tests: real process.env as a base (so it structurally satisfies NodeJS.ProcessEnv), with the two Drive credential variables explicitly cleared and overridden. */
function fakeEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: undefined,
    GOOGLE_DRIVE_CREDENTIALS: undefined,
    ...overrides,
  };
}

test("throws a DriveAuthConfigError when neither credentials variable is set", () => {
  assert.throws(() => loadServiceAccountCredentials({ env: fakeEnv({}) }), DriveAuthConfigError);
});

test("loads credentials from GOOGLE_DRIVE_CREDENTIALS inline JSON", () => {
  const env = fakeEnv({ GOOGLE_DRIVE_CREDENTIALS: JSON.stringify(FAKE_SERVICE_ACCOUNT) });
  const credentials = loadServiceAccountCredentials({ env });

  assert.deepEqual(credentials, FAKE_SERVICE_ACCOUNT);
});

test("throws a readable error when GOOGLE_DRIVE_CREDENTIALS is not valid JSON", () => {
  const env = fakeEnv({ GOOGLE_DRIVE_CREDENTIALS: "not json" });
  assert.throws(() => loadServiceAccountCredentials({ env }), (error: unknown) => {
    assert.ok(error instanceof DriveAuthConfigError);
    assert.match((error as Error).message, /not valid JSON/);
    return true;
  });
});

test("loads credentials from a GOOGLE_APPLICATION_CREDENTIALS file path", () => {
  const tmpFile = path.join(os.tmpdir(), `drive-auth-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(FAKE_SERVICE_ACCOUNT));

  try {
    const env = fakeEnv({ GOOGLE_APPLICATION_CREDENTIALS: tmpFile });
    const credentials = loadServiceAccountCredentials({ env });
    assert.deepEqual(credentials, FAKE_SERVICE_ACCOUNT);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test("throws a readable error when GOOGLE_APPLICATION_CREDENTIALS points to a missing file", () => {
  const env = fakeEnv({ GOOGLE_APPLICATION_CREDENTIALS: path.join(os.tmpdir(), "does-not-exist-12345.json") });
  assert.throws(() => loadServiceAccountCredentials({ env }), (error: unknown) => {
    assert.ok(error instanceof DriveAuthConfigError);
    assert.match((error as Error).message, /no file exists/);
    return true;
  });
});

test("GOOGLE_APPLICATION_CREDENTIALS takes priority over GOOGLE_DRIVE_CREDENTIALS when both are set", () => {
  const tmpFile = path.join(os.tmpdir(), `drive-auth-test-priority-${Date.now()}.json`);
  const fileCredentials = { ...FAKE_SERVICE_ACCOUNT, client_email: "from-file@test.iam.gserviceaccount.com" };
  fs.writeFileSync(tmpFile, JSON.stringify(fileCredentials));

  try {
    const env = fakeEnv({
      GOOGLE_APPLICATION_CREDENTIALS: tmpFile,
      GOOGLE_DRIVE_CREDENTIALS: JSON.stringify(FAKE_SERVICE_ACCOUNT),
    });
    const credentials = loadServiceAccountCredentials({ env });
    assert.equal((credentials as typeof fileCredentials).client_email, "from-file@test.iam.gserviceaccount.com");
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
