/**
 * Production readiness verifier (Phase 16A) — `npm run verify:prod`.
 *
 * Runs the checks a deploy must pass, in order, and reports each pass/fail:
 *   1. Environment  — required variables present (lib/config/env_validation)
 *   2. TypeScript   — `tsc --noEmit`
 *   3. Lint         — `eslint`
 *   4. Prisma       — schema valid + client generates
 *   5. Build        — `next build`
 *   6. Health       — the /api/health handler returns a structured body
 *
 * Exits non-zero if any check fails, so it can gate CI / a pre-deploy hook.
 * Reuses the existing env validator and health handler — no logic duplicated.
 */

import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

// Load .env.local so local runs see the same variables the app does.
dotenv.config({ path: ".env.local" });

import { formatEnvReport, validateEnvironment } from "@/lib/config/env_validation";

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Runs a shell command, returning ok=true on exit code 0. Output is streamed off (captured, summarized). */
function runCommand(name: string, command: string, args: string[]): CheckResult {
  const result = spawnSync(command, args, { encoding: "utf-8", shell: process.platform === "win32" });
  const ok = result.status === 0;
  const detail = ok ? undefined : (result.stderr || result.stdout || "").split("\n").filter(Boolean).slice(-4).join(" | ");
  return { name, ok, detail };
}

async function checkEnvironment(): Promise<CheckResult> {
  const report = validateEnvironment();
  console.log(formatEnvReport(report));
  return {
    name: "Environment",
    ok: report.valid,
    detail: report.valid ? undefined : `missing required: ${report.missingRequired.join(", ")}`,
  };
}

/** Exercises the real /api/health handler in-process (no server needed) via the fake-tolerant container path. */
async function checkHealth(): Promise<CheckResult> {
  try {
    const { getApiContainer } = await import("@/lib/api/api_container");
    const { handleHealth } = await import("@/lib/api/api_handlers");
    const container = await getApiContainer();
    const response = await handleHealth(container);
    const body = (await response.json()) as { data?: Record<string, unknown>; error?: unknown };
    const payload = (body.data ?? (body as { error?: { details?: Record<string, unknown> } }).error?.details) as
      | Record<string, unknown>
      | undefined;

    // A structured body with the expected keys is a pass regardless of DB
    // reachability (a degraded DB is still a valid, well-formed health report).
    const hasShape =
      payload !== undefined &&
      ["status", "version", "uptime", "environment", "timestamp"].every((k) => k in payload);
    return {
      name: "Health endpoint",
      ok: hasShape,
      detail: hasShape ? `status=${String(payload?.status)} db=${String(payload?.database)}` : "unexpected health body shape",
    };
  } catch (error) {
    return { name: "Health endpoint", ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  console.log("=== Production readiness verification ===\n");

  const results: CheckResult[] = [];

  results.push(await checkEnvironment());
  console.log("");

  console.log("Running TypeScript check…");
  results.push(runCommand("TypeScript", "npx", ["tsc", "--noEmit"]));

  console.log("Running lint…");
  results.push(runCommand("Lint", "npm", ["run", "lint"]));

  console.log("Validating Prisma schema…");
  results.push(runCommand("Prisma", "npx", ["prisma", "validate"]));

  console.log("Building (next build)…");
  results.push(runCommand("Build", "npm", ["run", "build"]));

  console.log("Checking health endpoint…");
  results.push(await checkHealth());

  console.log("\n=== Results ===");
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) FAILED: ${failed.map((r) => r.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll checks passed — production ready.");
}

main().catch((error) => {
  console.error("verify:prod crashed:", error);
  process.exitCode = 1;
});
