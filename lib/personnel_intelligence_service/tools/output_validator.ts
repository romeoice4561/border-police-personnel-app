/**
 * Defense-in-depth output validation for tool results (Phase 49.6).
 * Reuses Phase 49.5 FORBIDDEN_INTELLIGENCE_KEYS — no second denylist.
 */
import { FORBIDDEN_INTELLIGENCE_KEYS } from "@/lib/personnel_intelligence_service/serializers";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";

const FORBIDDEN_LOWER = FORBIDDEN_INTELLIGENCE_KEYS.map((k) => k.toLowerCase());

function fail(message: string): never {
  throw new IntelligenceToolError("OUTPUT_VALIDATION_FAILED", message);
}

function walk(value: unknown, seen: WeakSet<object>, path: string): void {
  if (value === null || value === undefined) return;

  const t = typeof value;
  if (t === "function" || t === "symbol" || t === "bigint") {
    fail(`Non-serializable value at ${path || "root"}`);
  }
  if (t !== "object") return;

  if (value instanceof Date) {
    fail(`Date object at ${path || "root"} — use ISO strings`);
  }

  if (seen.has(value as object)) {
    fail(`Circular reference at ${path || "root"}`);
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, seen, `${path}[${i}]`));
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_LOWER.some((f) => lower === f || lower.includes(f))) {
      fail(`Forbidden key '${key}' at ${path || "root"}`);
    }
    // Internal engine markers that must never leak
    if (key === "promotionIntelligence" || key === "documentIntelligence" || key === "trainingIntelligence") {
      fail(`Internal engine object '${key}' at ${path || "root"}`);
    }
    if (key === "_prisma" || key === "$prisma" || key === "Prisma") {
      fail(`Prisma metadata at ${path || "root"}`);
    }
    walk(child, seen, path ? `${path}.${key}` : key);
  }
}

/** Returns true when data is safe; false otherwise (does not throw). */
export function validateIntelligenceToolOutput(data: unknown): boolean {
  try {
    assertSafeIntelligenceToolOutput(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts tool output is JSON-serializable and free of sensitive/internal keys.
 * Throws OUTPUT_VALIDATION_FAILED — callers must not return the unsafe data.
 */
export function assertSafeIntelligenceToolOutput(data: unknown): void {
  walk(data, new WeakSet(), "");
  // Round-trip JSON to catch non-enumerable / exotic values
  try {
    JSON.stringify(data);
  } catch {
    fail("Output is not JSON serializable");
  }
}
