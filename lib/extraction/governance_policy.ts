/**
 * AI governance policy (Phase 48B — spec §3).
 *
 * A centralized policy-MODE layer that sits above budget_policy.ts's
 * numeric limits. Where AiUsagePolicy answers "how many calls are we
 * allowed," GovernancePolicy answers "is AI allowed to run at all, and
 * under what operating mode" — e.g. an operator can flip the whole app to
 * Disabled or Dry Run without touching any numeric budget field.
 *
 * Six modes are defined as first-class types (spec's full list), but only
 * four are wired into live enforcement in ai_gate.ts this phase:
 *   - AUTOMATIC                (maps to existing automaticFallbackAllowed)
 *   - DISABLED                 (blocks all AI, mirrors aiFallbackEnabled=false)
 *   - USER_CONFIRMATION_REQUIRED (the existing default behavior)
 *   - DRY_RUN                  (gate still recommends, never actually calls)
 *
 * ADMINISTRATOR_OVERRIDE and READ_ONLY are interface-ready only: fully
 * typed, validated, and documented, but NOT enforced — this application has
 * no role/permission or authentication-backed admin system yet, and
 * inventing one here would be out of scope and unsafe (a fake "admin" flag
 * that any caller could set would be worse than no override at all). When a
 * real authorization layer exists, wiring these two modes into
 * shouldUseAiFallback() should be a small, additive change (see the
 * `enforced` flag below, which documents exactly this).
 *
 * Pure — no I/O, no React, no auth system.
 */

export type GovernanceMode =
  | "AUTOMATIC"
  | "DISABLED"
  | "USER_CONFIRMATION_REQUIRED"
  | "ADMINISTRATOR_OVERRIDE"
  | "READ_ONLY"
  | "DRY_RUN";

export interface GovernanceModeDescriptor {
  mode: GovernanceMode;
  label: string;
  description: string;
  /** True when this mode is actually enforced by ai_gate.ts today. False = interface-ready only, documented but inert. */
  enforced: boolean;
  /** What must exist before an interface-ready mode can be safely enforced. Empty for already-enforced modes. */
  requiresFutureCapability: string | null;
}

export const GOVERNANCE_MODE_DESCRIPTORS: readonly GovernanceModeDescriptor[] = [
  {
    mode: "AUTOMATIC",
    label: "Automatic",
    description: "AI may run without an explicit per-document click, still subject to every budget/confidence rule.",
    enforced: true,
    requiresFutureCapability: null,
  },
  {
    mode: "DISABLED",
    label: "Disabled",
    description: "AI fallback is unavailable entirely, even with explicit user confirmation.",
    enforced: true,
    requiresFutureCapability: null,
  },
  {
    mode: "USER_CONFIRMATION_REQUIRED",
    label: "User Confirmation Required",
    description: "AI is recommended when warranted but never called without an explicit user confirmation. Default mode.",
    enforced: true,
    requiresFutureCapability: null,
  },
  {
    mode: "DRY_RUN",
    label: "Dry Run",
    description: "The gate evaluates and records what it WOULD recommend, but no AI call is ever actually made, confirmed or not.",
    enforced: true,
    requiresFutureCapability: null,
  },
  {
    mode: "ADMINISTRATOR_OVERRIDE",
    label: "Administrator Override",
    description: "Intended to let an authenticated administrator bypass user-confirmation for a specific document or session.",
    enforced: false,
    requiresFutureCapability: "A real authenticated role/permission system to identify and verify an 'administrator' caller. No such system exists in this app yet.",
  },
  {
    mode: "READ_ONLY",
    label: "Read Only",
    description: "Intended to let an operator view extraction/cost data without any processing (OCR or AI) being triggerable at all.",
    enforced: false,
    requiresFutureCapability: "A route/permission-level enforcement point distinguishing read vs. write callers. No such distinction exists in the current API surface.",
  },
];

export function getGovernanceModeDescriptor(mode: GovernanceMode): GovernanceModeDescriptor {
  const found = GOVERNANCE_MODE_DESCRIPTORS.find((d) => d.mode === mode);
  if (!found) throw new Error(`Unknown governance mode: ${mode}`);
  return found;
}

export interface GovernancePolicy {
  mode: GovernanceMode;
}

export const DEFAULT_GOVERNANCE_POLICY: GovernancePolicy = {
  mode: "USER_CONFIRMATION_REQUIRED",
};

/**
 * Validates that a mode is one of the known, typed values — used at
 * configuration-load boundaries (settings.ts) so an invalid/unrecognized
 * mode string never silently falls through as if it were a real mode.
 */
export function isValidGovernanceMode(value: string): value is GovernanceMode {
  return GOVERNANCE_MODE_DESCRIPTORS.some((d) => d.mode === value);
}

export interface GovernanceEvaluation {
  /** Whether processing may proceed to recommend/call AI at all under this mode. */
  aiPermitted: boolean;
  /** True when the mode forces automaticCallAllowed regardless of confirmation policy (AUTOMATIC only). */
  forcesAutomatic: boolean;
  /** True when a recommendation should be computed and recorded, but any actual provider call must be suppressed (DRY_RUN). */
  suppressActualCall: boolean;
  reason: string;
}

/**
 * Translates a GovernanceMode into the flags ai_gate.ts / the API route
 * layer need. This is the ONE place governance mode is interpreted — mirrors
 * ai_gate.ts's own "one centralized decision function" principle.
 */
export function evaluateGovernanceMode(mode: GovernanceMode): GovernanceEvaluation {
  switch (mode) {
    case "AUTOMATIC":
      return { aiPermitted: true, forcesAutomatic: true, suppressActualCall: false, reason: "Automatic mode: AI may run without per-call confirmation." };
    case "DISABLED":
      return { aiPermitted: false, forcesAutomatic: false, suppressActualCall: true, reason: "AI governance mode is DISABLED." };
    case "USER_CONFIRMATION_REQUIRED":
      return { aiPermitted: true, forcesAutomatic: false, suppressActualCall: false, reason: "AI requires explicit user confirmation." };
    case "DRY_RUN":
      return { aiPermitted: true, forcesAutomatic: false, suppressActualCall: true, reason: "Dry run mode: recommendations are computed, no AI call is made." };
    case "ADMINISTRATOR_OVERRIDE":
      // Not enforced yet — falls back to the safest real behavior
      // (confirmation required) rather than silently granting a bypass no
      // authorization system actually verified.
      return {
        aiPermitted: true,
        forcesAutomatic: false,
        suppressActualCall: false,
        reason: "ADMINISTRATOR_OVERRIDE is not enforced in this application yet (no role/permission system) — falling back to USER_CONFIRMATION_REQUIRED behavior.",
      };
    case "READ_ONLY":
      // Not enforced at this layer yet — falls back to blocking AI, the
      // conservative choice, rather than allowing calls a real read-only
      // enforcement point hasn't verified.
      return {
        aiPermitted: false,
        forcesAutomatic: false,
        suppressActualCall: true,
        reason: "READ_ONLY is not enforced in this application yet (no read/write permission distinction) — conservatively blocking AI as if disabled.",
      };
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unhandled governance mode: ${exhaustive}`);
    }
  }
}
