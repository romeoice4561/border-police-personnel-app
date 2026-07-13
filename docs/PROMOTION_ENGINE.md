# Promotion Eligibility Engine

The Promotion Eligibility Engine is a pure TypeScript rule framework for promotion readiness. It does not implement final promotion policy yet. It is designed so policy can be loaded later through configuration and registered rules.

No React, database access, API calls, OCR, AI, or media logic exists in this engine.

## Architecture

- `lib/promotion/context.ts`  
  Defines `PromotionEvaluationContext` and `buildPromotionContext()`. The builder consumes the Personnel Calendar Engine to derive age, government service duration, retirement date, and remaining time until retirement.

- `lib/promotion/engine.ts`  
  Executes registered rules and returns one aggregated promotion result.

- `lib/promotion/result.ts`  
  Aggregates pass/fail outcomes, score, missing requirements, warnings, and next steps.

- `lib/promotion/types.ts`  
  Shared domain types for rules and evaluation results.

- `lib/promotion/rules/registry.ts`  
  Rule registry. Future phases add a rule file, register it, and run the same engine.

- `lib/promotion/rules/*`  
  Configuration-driven sample rule factories. These are examples of rule shape, not final promotion policy.

## Evaluation Flow

1. Build a `PromotionEvaluationContext`.
2. Register one or more independent `PromotionRule` objects.
3. Run `PromotionEngine.evaluate(context)`.
4. The engine executes every rule.
5. The result includes:
   - `eligible`
   - `score`
   - `maxScore`
   - `passedRules`
   - `failedRules`
   - `missingRequirements`
   - `warnings`
   - `suggestedNextSteps`

The engine never stops at the first failure. Commanders need a full readiness picture.

## Rule Lifecycle

A rule is independent and owns only one decision.

Example lifecycle:

1. Create a new file in `lib/promotion/rules/`.
2. Export a `createXRule(config)` factory.
3. The rule reads `PromotionEvaluationContext`.
4. The rule returns a `PromotionRuleOutcome`.
5. Register it through `PromotionRuleRegistry`.

The engine does not need modification when new rules are added.

## Policy Configuration

Promotion policies are not hardcoded into the engine. Rule factories accept configuration such as:

- Minimum service duration
- Accepted ranks
- Required training codes
- Required document types
- Retirement review window

Future regulation files can load policy data and create rules from that policy.

## Personnel Calendar Integration

`buildPromotionContext()` uses the Personnel Calendar Engine for:

- Current age
- Government service duration
- Retirement date
- Remaining time until retirement

This keeps calendar math centralized and prevents duplicate retirement/service calculations.

## Current Rule Examples

The current rule factories are framework examples:

- `createMinimumServiceRule`
- `createMinimumRankRule`
- `createRequiredTrainingRule`
- `createRetirementWindowRule`
- `createRequiredDocumentsRule`

These are not final Thai promotion policy.

## Extension Guide

To add a future promotion rule:

```ts
import type { PromotionRule } from "@/lib/promotion";

export function createExampleRule(config: ExampleConfig): PromotionRule {
  return {
    id: "example-rule",
    label: "Example rule",
    evaluate(context) {
      const passed = Boolean(context.extensions?.example);
      return {
        ruleId: "example-rule",
        passed,
        score: passed ? 10 : 0,
        maxScore: 10,
        severity: "blocking",
        reasons: passed ? ["Requirement met."] : ["Requirement missing."],
        missingRequirements: passed ? [] : [{ code: "EXAMPLE", label: "Example requirement" }],
        warnings: [],
        suggestedNextSteps: passed ? [] : [{ code: "COMPLETE_EXAMPLE", label: "Complete example requirement." }],
      };
    },
  };
}
```

Then register it:

```ts
const registry = createPromotionRuleRegistry().register(createExampleRule(policy.example));
const result = evaluatePromotionEligibility(context, registry.list());
```
