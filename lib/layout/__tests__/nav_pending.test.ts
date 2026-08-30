/**
 * DI-9.4.3A — pending sidebar highlight helper.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNavItemHighlighted } from "@/lib/layout/nav_pending";

test("highlights exact pathname match when nothing is pending", () => {
  assert.equal(isNavItemHighlighted("/drug-intelligence/cases", "/drug-intelligence/cases", null), true);
});

test("highlights nested pathname under href when nothing is pending", () => {
  assert.equal(isNavItemHighlighted("/drug-intelligence/cases/new", "/drug-intelligence/cases", null), true);
});

test("does not highlight unrelated pathname when nothing is pending", () => {
  assert.equal(isNavItemHighlighted("/drug-intelligence/persons", "/drug-intelligence/cases", null), false);
});

test("highlights pending destination immediately even if pathname has not changed yet", () => {
  assert.equal(
    isNavItemHighlighted("/drug-intelligence/cases", "/drug-intelligence/persons", "/drug-intelligence/persons"),
    true
  );
});

test("pending href does not highlight a different nav item", () => {
  assert.equal(
    isNavItemHighlighted("/drug-intelligence/cases", "/drug-intelligence/search", "/drug-intelligence/persons"),
    false
  );
});

test("current page stays highlighted while a different item is pending", () => {
  assert.equal(
    isNavItemHighlighted("/drug-intelligence/cases", "/drug-intelligence/cases", "/drug-intelligence/persons"),
    true
  );
});
