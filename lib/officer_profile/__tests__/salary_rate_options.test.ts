/**
 * Salary rate candidate-dataset tests (Phase 45.1 refinement pass, Parts
 * 4-7). Covers the closed level/step option lists, the step->candidate
 * lookup (deliberately NOT a level->step->amount mapping — see
 * salary_rate_options.ts's doc comment for why), and the display/parse
 * helpers the editor's Combobox wiring depends on.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SALARY_LEVEL_OPTIONS,
  SALARY_STEP_SCALE_OPTIONS,
  isKnownSalaryLevel,
  isKnownSalaryStep,
  formatSalaryStepScale,
  SALARY_STEP_RATE_OPTIONS,
  candidateSalariesForStep,
  stepDisplayToKey,
  looksLikeFormattedMoney,
  parseFormattedMoneyDigits,
} from "@/lib/officer_profile/salary_rate_options";

// ── Part 4: salary level options ─────────────────────────────────────────

test("SALARY_LEVEL_OPTIONS contains exactly the approved 12 levels, in order", () => {
  assert.deepEqual([...SALARY_LEVEL_OPTIONS], ["พ.1", "ป.1", "ป.2", "ป.3", "ส.1", "ส.2", "ส.3", "ส.4", "ส.5", "ส.6", "ส.7", "ส.8"]);
});

test("isKnownSalaryLevel recognizes an approved level and rejects an arbitrary/legacy string (which the Combobox still allows as free text)", () => {
  assert.equal(isKnownSalaryLevel("ส.5"), true);
  assert.equal(isKnownSalaryLevel("legacy-value"), false);
});

// ── Part 5: salary step scale ─────────────────────────────────────────────

test("SALARY_STEP_SCALE_OPTIONS spans 1.0 through 43.5 in 0.5 increments, sorted DESCENDING", () => {
  assert.equal(SALARY_STEP_SCALE_OPTIONS[0], 43.5);
  assert.equal(SALARY_STEP_SCALE_OPTIONS[SALARY_STEP_SCALE_OPTIONS.length - 1], 1.0);
  assert.equal(SALARY_STEP_SCALE_OPTIONS.length, 86);
  for (let i = 1; i < SALARY_STEP_SCALE_OPTIONS.length; i++) {
    assert.ok(SALARY_STEP_SCALE_OPTIONS[i - 1] > SALARY_STEP_SCALE_OPTIONS[i], "must be strictly descending");
  }
});

test("isKnownSalaryStep recognizes an approved step and rejects an out-of-range value", () => {
  assert.equal(isKnownSalaryStep(32.0), true);
  assert.equal(isKnownSalaryStep(43.5), true);
  assert.equal(isKnownSalaryStep(1.0), true);
  assert.equal(isKnownSalaryStep(44.0), false);
  assert.equal(isKnownSalaryStep(0.5), false);
});

test("formatSalaryStepScale renders 'ขั้น 43.5' — always one decimal place", () => {
  assert.equal(formatSalaryStepScale(43.5), "ขั้น 43.5");
  assert.equal(formatSalaryStepScale(32), "ขั้น 32.0");
  assert.equal(formatSalaryStepScale(1), "ขั้น 1.0");
});

// ── Part 3/7: candidate amounts — NEVER a level->step->amount mapping ────

test("candidateSalariesForStep('32.0') returns exactly the 4 source-supplied candidates, in source order (never sorted/deduped/guessed)", () => {
  assert.deepEqual(candidateSalariesForStep("32.0"), [37580, 40560, 50640, 70360]);
});

test("bug fix: candidateSalariesForStep('25.5') returns the 8 source-supplied candidates, including 48,200 — regression test for the reported ระดับเงินเดือน ส.3 / ขั้นเงินเดือน 25.5 bug (Task 2)", () => {
  assert.deepEqual(candidateSalariesForStep("25.5"), [20180, 27890, 30220, 33000, 40560, 48200, 56610, 66960]);
  assert.ok(candidateSalariesForStep("25.5").includes(48200));
});

test("candidateSalariesForStep returns an EMPTY array for a step with no known candidates — never fabricates an amount", () => {
  assert.deepEqual(candidateSalariesForStep("15.0"), []);
  assert.deepEqual(candidateSalariesForStep("not-a-step"), []);
});

test("SALARY_STEP_RATE_OPTIONS never claims a (level, step) -> single-amount mapping — its shape is step -> candidateSalaries[] only, structurally incapable of expressing a level", () => {
  for (const row of SALARY_STEP_RATE_OPTIONS) {
    assert.equal(typeof row.step, "string");
    assert.ok(Array.isArray(row.candidateSalaries));
    assert.ok(!("level" in row), "a row must never carry a level field — that would imply a mapping this dataset cannot honestly make");
  }
});

// ── Editor helper functions ───────────────────────────────────────────────

test("stepDisplayToKey strips the 'ขั้น ' prefix so a formatted step matches SALARY_STEP_RATE_OPTIONS's key", () => {
  assert.equal(stepDisplayToKey("ขั้น 32.0"), "32.0");
  assert.equal(stepDisplayToKey("32.0"), "32.0");
  assert.equal(stepDisplayToKey(""), "");
});

test("looksLikeFormattedMoney recognizes exactly the formatMoneyTh output shape", () => {
  assert.equal(looksLikeFormattedMoney("40,560 บาท"), true);
  assert.equal(looksLikeFormattedMoney("40560"), false);
  assert.equal(looksLikeFormattedMoney("40560 บาท ต่อเดือน"), false);
});

test("parseFormattedMoneyDigits recovers the raw numeric string from a formatted candidate", () => {
  assert.equal(parseFormattedMoneyDigits("40,560 บาท"), "40560");
  assert.equal(parseFormattedMoneyDigits("70,360 บาท"), "70360");
});

test("looksLikeFormattedMoney + parseFormattedMoneyDigits round-trip every step-32.0 candidate correctly", () => {
  for (const amount of candidateSalariesForStep("32.0")) {
    const formatted = `${amount.toLocaleString("th-TH")} บาท`;
    assert.equal(looksLikeFormattedMoney(formatted), true);
    assert.equal(parseFormattedMoneyDigits(formatted), String(amount));
  }
});

// ── Bug fix regression: manual typing must never be auto-reformatted ────
//
// Root cause of the reported bug: an earlier version of the editor derived
// the Combobox's bound `value` by reformatting ANY all-digit string as
// "N บาท" on every render (`/^\d+$/.test(...)` matched partial in-progress
// typing, not just committed values). That corrupted the controlled
// input's text after a single keystroke. The fix keeps the bound value as
// the raw typed string at all times — looksLikeFormattedMoney must
// therefore reject every plain digit string typed one character at a
// time, so onCurrentSalaryChange never mistakes in-progress typing for a
// selected candidate and never reformats it out from under the user.
test("bug fix: looksLikeFormattedMoney rejects every intermediate state of typing '48200' one digit at a time — in-progress typing must never be mistaken for a selected/formatted candidate", () => {
  const target = "48200";
  for (let i = 1; i <= target.length; i++) {
    const partial = target.slice(0, i);
    assert.equal(looksLikeFormattedMoney(partial), false, `"${partial}" must not look like formatted money`);
  }
});
