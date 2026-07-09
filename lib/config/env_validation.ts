/**
 * Production environment validation (Phase 16A).
 *
 * Declares the environment variables the deployed system needs, split by the
 * capability they enable, and validates them into a readable report. Used both
 * by the /api/health endpoint (to surface environment status) and by
 * `npm run verify:prod` (to fail a deploy early with a clear message). Pure —
 * it reads an injected env object (default process.env), performs no I/O, and
 * never logs secret values.
 *
 * Requirement levels:
 *   - "required": the app cannot serve its core (DB-backed) features without it.
 *   - "feature": enables a specific pipeline capability (OCR/Vision/Drive);
 *     absent → that feature is unavailable, but the web app still runs.
 */

export type EnvRequirement = "required" | "feature";

export interface EnvVarSpec {
  name: string;
  requirement: EnvRequirement;
  /** What the variable enables, for the readable report. Never the value. */
  description: string;
  /** Optional default note (e.g. OPENAI_MODEL has a code default). */
  optionalWithDefault?: boolean;
}

/** The variables the production system reads. */
export const ENV_SPECS: EnvVarSpec[] = [
  { name: "DATABASE_URL", requirement: "required", description: "PostgreSQL/Supabase connection string (runtime + migrations)." },
  { name: "DIRECT_URL", requirement: "required", description: "Direct (non-pooled) Postgres connection for migrations." },
  { name: "NEXT_PUBLIC_SUPABASE_URL", requirement: "required", description: "Supabase project URL exposed to the client." },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", requirement: "required", description: "Supabase anon key exposed to the client." },
  { name: "OPENAI_API_KEY", requirement: "feature", description: "OpenAI Vision extraction (import pipeline)." },
  { name: "GOOGLE_APPLICATION_CREDENTIALS", requirement: "feature", description: "Google service-account credentials for Drive scanning." },
  { name: "GOOGLE_DRIVE_ROOT_FOLDER", requirement: "feature", description: "Root Drive folder id to scan." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", requirement: "feature", description: "Supabase service-role key for server-side Storage uploads (Officer Portrait Upload)." },
  { name: "SUPABASE_PORTRAIT_BUCKET", requirement: "feature", description: "Supabase Storage bucket name for officer portraits (defaults to 'portraits').", optionalWithDefault: true },
  {
    name: "OPENAI_MODEL",
    requirement: "feature",
    description: "OpenAI model id (defaults in code if unset).",
    optionalWithDefault: true,
  },
];

export interface EnvVarStatus {
  name: string;
  requirement: EnvRequirement;
  present: boolean;
  description: string;
  optionalWithDefault: boolean;
}

export interface EnvValidationReport {
  /** true when every REQUIRED variable is present. */
  valid: boolean;
  /** Coarse environment name: "production" | "development" | "test" | "unknown". */
  environment: string;
  statuses: EnvVarStatus[];
  missingRequired: string[];
  missingFeature: string[];
}

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Resolves the coarse environment name from NODE_ENV. */
export function resolveEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === "production" || nodeEnv === "development" || nodeEnv === "test") return nodeEnv;
  return "unknown";
}

/** Validates the environment against ENV_SPECS. Never reads or returns secret values. */
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): EnvValidationReport {
  const statuses: EnvVarStatus[] = ENV_SPECS.map((spec) => ({
    name: spec.name,
    requirement: spec.requirement,
    present: isPresent(env[spec.name]),
    description: spec.description,
    optionalWithDefault: Boolean(spec.optionalWithDefault),
  }));

  const missingRequired = statuses.filter((s) => s.requirement === "required" && !s.present).map((s) => s.name);
  const missingFeature = statuses
    .filter((s) => s.requirement === "feature" && !s.present && !s.optionalWithDefault)
    .map((s) => s.name);

  return {
    valid: missingRequired.length === 0,
    environment: resolveEnvironment(env),
    statuses,
    missingRequired,
    missingFeature,
  };
}

/**
 * Renders a readable multi-line startup report. Marks each variable ✓/✗ and,
 * when required variables are missing, ends with an actionable error line.
 * Contains no secret values — only presence.
 */
export function formatEnvReport(report: EnvValidationReport): string {
  const lines: string[] = [];
  lines.push(`Environment: ${report.environment}`);
  lines.push("Environment variable check:");

  for (const status of report.statuses) {
    const mark = status.present ? "✓" : status.requirement === "required" ? "✗" : "○";
    const tag = status.requirement === "required" ? "required" : status.optionalWithDefault ? "optional" : "feature";
    lines.push(`  ${mark} ${status.name} [${tag}] — ${status.description}`);
  }

  if (report.missingRequired.length > 0) {
    lines.push("");
    lines.push(`ERROR: ${report.missingRequired.length} required variable(s) missing: ${report.missingRequired.join(", ")}.`);
    lines.push("Set them in your Netlify site environment (or .env.local for local runs), then redeploy.");
  } else if (report.missingFeature.length > 0) {
    lines.push("");
    lines.push(`Note: optional feature variable(s) unset: ${report.missingFeature.join(", ")} — related pipeline features are disabled.`);
  } else {
    lines.push("");
    lines.push("All required variables present.");
  }

  return lines.join("\n");
}
