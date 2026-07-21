import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldUseAiFallback, type AiGateInput } from "@/lib/extraction/ai_gate";
import { DEFAULT_AI_USAGE_POLICY } from "@/lib/extraction/budget_policy";

function baseInput(overrides: Partial<AiGateInput> = {}): AiGateInput {
  return {
    ocrConfidence: 0.95,
    documentTypeKnown: true,
    requiredFieldsPresent: ["nationalId"],
    requiredFieldsExpected: ["nationalId"],
    hasValidationFailures: false,
    complexLayoutDetected: false,
    userRequestedAi: false,
    isCacheHit: false,
    isExactDuplicate: false,
    ...overrides,
  };
}

test("governance DISABLED blocks an otherwise-recommended AI call", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "DISABLED" } });
  assert.equal(decision.shouldUseAi, false);
  assert.ok(decision.blockedByGovernance);
});

test("governance DISABLED does not alter a decision that already said no AI", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.95 }), { governancePolicy: { mode: "DISABLED" } });
  assert.equal(decision.shouldUseAi, false);
  assert.equal(decision.blockedByGovernance, undefined, "no need to explain a governance block when the base decision was already NOT_REQUIRED");
});

test("governance AUTOMATIC forces automaticCallAllowed=true for a recommended call", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "AUTOMATIC" } });
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.automaticCallAllowed, true);
});

test("governance AUTOMATIC never invents a recommendation the base decision didn't already make", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.95 }), { governancePolicy: { mode: "AUTOMATIC" } });
  assert.equal(decision.shouldUseAi, false, "AUTOMATIC only relaxes confirmation — it must not call AI for a high-confidence, fully-valid document");
});

test("governance USER_CONFIRMATION_REQUIRED (the default) never forces automaticCallAllowed", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "USER_CONFIRMATION_REQUIRED" } });
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.automaticCallAllowed, false);
});

test("governance DRY_RUN still recommends AI (for review-UI display) but marks isDryRun=true so no real call may follow", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "DRY_RUN" } });
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.isDryRun, true);
  assert.equal(decision.automaticCallAllowed, false, "dry run must never be automatic either");
});

test("governance READ_ONLY blocks AI even when every other condition recommends it", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1, documentTypeKnown: false }), { governancePolicy: { mode: "READ_ONLY" } });
  assert.equal(decision.shouldUseAi, false);
  assert.ok(decision.blockedByGovernance);
});

test("governance ADMINISTRATOR_OVERRIDE behaves exactly like USER_CONFIRMATION_REQUIRED today (no bypass without a real auth system)", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "ADMINISTRATOR_OVERRIDE" } });
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.automaticCallAllowed, false, "ADMINISTRATOR_OVERRIDE must not silently grant automatic bypass");
});

test("omitting governancePolicy defaults to USER_CONFIRMATION_REQUIRED behavior (Phase 48A backward compatibility)", () => {
  const withDefault = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }));
  const withExplicit = shouldUseAiFallback(baseInput({ ocrConfidence: 0.1 }), { governancePolicy: { mode: "USER_CONFIRMATION_REQUIRED" } });
  assert.deepEqual(withDefault, withExplicit);
});

test("cache hit never calls AI, regardless of confidence or anything else", () => {
  const decision = shouldUseAiFallback(baseInput({ isCacheHit: true, ocrConfidence: 0.1, documentTypeKnown: false }));
  assert.equal(decision.shouldUseAi, false);
  assert.equal(decision.reason, "NOT_REQUIRED");
});

test("exact duplicate never calls AI when duplicateReprocessingAllowed is false (the default)", () => {
  const decision = shouldUseAiFallback(baseInput({ isExactDuplicate: true, ocrConfidence: 0.1 }));
  assert.equal(decision.shouldUseAi, false);
});

test("high confidence, everything valid -> no AI, NOT_REQUIRED", () => {
  const decision = shouldUseAiFallback(baseInput());
  assert.equal(decision.shouldUseAi, false);
  assert.equal(decision.reason, "NOT_REQUIRED");
  assert.equal(decision.confidenceLevel, "high");
  assert.equal(decision.automaticCallAllowed, false);
});

test("medium confidence -> no automatic AI, but recommends nothing proactively (UI offers the optional button separately)", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.8 }));
  assert.equal(decision.shouldUseAi, false);
  assert.equal(decision.confidenceLevel, "medium");
  assert.equal(decision.automaticCallAllowed, false);
});

test("low confidence -> recommends AI (shouldUseAi=true) but never automatic by default", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.5 }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "LOW_OCR_CONFIDENCE");
  assert.equal(decision.automaticCallAllowed, false);
});

test("unknown confidence (null) -> recommends AI, never automatic", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: null }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.confidenceLevel, "unknown");
  assert.equal(decision.automaticCallAllowed, false);
});

test("unknown document type -> AI recommended even at high OCR confidence", () => {
  const decision = shouldUseAiFallback(baseInput({ documentTypeKnown: false }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "UNKNOWN_DOCUMENT_TYPE");
});

test("missing required fields -> AI recommended even at high confidence", () => {
  const decision = shouldUseAiFallback(baseInput({ requiredFieldsPresent: [], requiredFieldsExpected: ["nationalId", "thaiName"] }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "REQUIRED_FIELDS_MISSING");
});

test("validation failure -> AI recommended", () => {
  const decision = shouldUseAiFallback(baseInput({ hasValidationFailures: true }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "VALIDATION_FAILED");
});

test("complex layout detected -> AI recommended", () => {
  const decision = shouldUseAiFallback(baseInput({ complexLayoutDetected: true }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "COMPLEX_LAYOUT");
});

test("explicit user request always wins, even at high confidence with everything valid", () => {
  const decision = shouldUseAiFallback(baseInput({ userRequestedAi: true }));
  assert.equal(decision.shouldUseAi, true);
  assert.equal(decision.reason, "USER_REQUESTED");
});

test("priority order: unknown type is reported before missing-fields when both apply", () => {
  const decision = shouldUseAiFallback(baseInput({ documentTypeKnown: false, requiredFieldsPresent: [] }));
  assert.equal(decision.reason, "UNKNOWN_DOCUMENT_TYPE");
});

test("budget: maxAiCallsPerDocument already reached blocks the call even when a reason applies", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.5 }), {
    usagePolicy: DEFAULT_AI_USAGE_POLICY,
    callHistory: { callsForThisDocument: 1, callsToday: 0, callsThisMonth: 0, callsTodayForThisUser: 0 },
  });
  assert.equal(decision.shouldUseAi, false);
  assert.ok(decision.blockedByBudget);
});

test("budget: aiFallbackEnabled=false blocks even a USER_REQUESTED call", () => {
  const decision = shouldUseAiFallback(baseInput({ userRequestedAi: true }), {
    usagePolicy: { ...DEFAULT_AI_USAGE_POLICY, aiFallbackEnabled: false },
    callHistory: { callsForThisDocument: 0, callsToday: 0, callsThisMonth: 0, callsTodayForThisUser: 0 },
  });
  assert.equal(decision.shouldUseAi, false);
  assert.ok(decision.blockedByBudget);
});

test("automaticCallAllowed is true ONLY when the policy explicitly enables it AND does not require confirmation", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.5 }), {
    usagePolicy: { ...DEFAULT_AI_USAGE_POLICY, automaticFallbackAllowed: true, requireUserConfirmation: false },
  });
  assert.equal(decision.automaticCallAllowed, true);
});

test("automaticCallAllowed stays false when automaticFallbackAllowed=true but requireUserConfirmation is still true", () => {
  const decision = shouldUseAiFallback(baseInput({ ocrConfidence: 0.5 }), {
    usagePolicy: { ...DEFAULT_AI_USAGE_POLICY, automaticFallbackAllowed: true, requireUserConfirmation: true },
  });
  assert.equal(decision.automaticCallAllowed, false);
});

test("default policy never allows automatic AI at all, at any confidence level", () => {
  for (const confidence of [null, 0, 0.3, 0.5, 0.65]) {
    const decision = shouldUseAiFallback(baseInput({ ocrConfidence: confidence }));
    assert.equal(decision.automaticCallAllowed, false, `confidence=${confidence} should never allow automatic AI`);
  }
});
