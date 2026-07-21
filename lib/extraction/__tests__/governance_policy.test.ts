import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GOVERNANCE_MODE_DESCRIPTORS,
  getGovernanceModeDescriptor,
  isValidGovernanceMode,
  evaluateGovernanceMode,
  DEFAULT_GOVERNANCE_POLICY,
} from "@/lib/extraction/governance_policy";

test("default governance policy is USER_CONFIRMATION_REQUIRED", () => {
  assert.equal(DEFAULT_GOVERNANCE_POLICY.mode, "USER_CONFIRMATION_REQUIRED");
});

test("all 6 governance modes are described exactly once", () => {
  const modes = GOVERNANCE_MODE_DESCRIPTORS.map((d) => d.mode);
  assert.equal(modes.length, 6);
  assert.equal(new Set(modes).size, 6);
});

test("AUTOMATIC, DISABLED, USER_CONFIRMATION_REQUIRED, DRY_RUN are marked enforced", () => {
  for (const mode of ["AUTOMATIC", "DISABLED", "USER_CONFIRMATION_REQUIRED", "DRY_RUN"] as const) {
    assert.equal(getGovernanceModeDescriptor(mode).enforced, true, `${mode} should be enforced`);
    assert.equal(getGovernanceModeDescriptor(mode).requiresFutureCapability, null);
  }
});

test("ADMINISTRATOR_OVERRIDE and READ_ONLY are marked interface-ready only, with a stated future requirement", () => {
  for (const mode of ["ADMINISTRATOR_OVERRIDE", "READ_ONLY"] as const) {
    const d = getGovernanceModeDescriptor(mode);
    assert.equal(d.enforced, false, `${mode} should not be enforced yet`);
    assert.ok(d.requiresFutureCapability && d.requiresFutureCapability.length > 0);
  }
});

test("isValidGovernanceMode rejects unknown strings", () => {
  assert.equal(isValidGovernanceMode("AUTOMATIC"), true);
  assert.equal(isValidGovernanceMode("NOT_A_MODE"), false);
  assert.equal(isValidGovernanceMode(""), false);
});

test("getGovernanceModeDescriptor throws for an invalid mode", () => {
  assert.throws(() => getGovernanceModeDescriptor("BOGUS" as never));
});

test("evaluateGovernanceMode(DISABLED) blocks AI and suppresses calls", () => {
  const e = evaluateGovernanceMode("DISABLED");
  assert.equal(e.aiPermitted, false);
  assert.equal(e.suppressActualCall, true);
});

test("evaluateGovernanceMode(AUTOMATIC) permits AI and forces automatic", () => {
  const e = evaluateGovernanceMode("AUTOMATIC");
  assert.equal(e.aiPermitted, true);
  assert.equal(e.forcesAutomatic, true);
  assert.equal(e.suppressActualCall, false);
});

test("evaluateGovernanceMode(USER_CONFIRMATION_REQUIRED) permits AI without forcing automatic", () => {
  const e = evaluateGovernanceMode("USER_CONFIRMATION_REQUIRED");
  assert.equal(e.aiPermitted, true);
  assert.equal(e.forcesAutomatic, false);
  assert.equal(e.suppressActualCall, false);
});

test("evaluateGovernanceMode(DRY_RUN) permits evaluation but suppresses the actual call", () => {
  const e = evaluateGovernanceMode("DRY_RUN");
  assert.equal(e.aiPermitted, true);
  assert.equal(e.suppressActualCall, true);
});

test("evaluateGovernanceMode(ADMINISTRATOR_OVERRIDE) conservatively falls back to confirmation-required behavior, never a silent bypass", () => {
  const e = evaluateGovernanceMode("ADMINISTRATOR_OVERRIDE");
  assert.equal(e.aiPermitted, true);
  assert.equal(e.forcesAutomatic, false, "must not grant automatic bypass without a real authorization system");
  assert.equal(e.suppressActualCall, false);
});

test("evaluateGovernanceMode(READ_ONLY) conservatively blocks AI rather than allowing it unchecked", () => {
  const e = evaluateGovernanceMode("READ_ONLY");
  assert.equal(e.aiPermitted, false);
});
