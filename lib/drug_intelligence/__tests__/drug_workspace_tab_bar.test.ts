/**
 * Workspace tab bar overflow navigation contracts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("Person Detail keeps all workspace tabs including follow-up tasks", () => {
  const page = read("app/drug-intelligence/persons/[id]/page.tsx");
  assert.match(page, /DrugWorkspaceTabBar/);
  assert.match(page, /\{ key: "overview"/);
  assert.match(page, /\{ key: "cases"/);
  assert.match(page, /\{ key: "network-roles"/);
  assert.match(page, /\{ key: "phones"/);
  assert.match(page, /\{ key: "devices"/);
  assert.match(page, /\{ key: "vehicles"/);
  assert.match(page, /\{ key: "locations"/);
  assert.match(page, /\{ key: "identity"/);
  assert.match(page, /\{ key: "review"/);
  assert.match(page, /\{ key: "analyst-notes"/);
  assert.match(page, /\{ key: "investigation-tasks"/);
  assert.match(page, /di\.tasks\.tab/);
  assert.doesNotMatch(page, /label: "งาน"/);
  assert.doesNotMatch(page, /tab\.label\.slice/);
});

test("overflow tab bar exposes prev/next controls and active scroll-into-view", () => {
  const tabBar = read("components/drug_intelligence/drug_workspace_tab_bar.tsx");
  assert.match(tabBar, /export function DrugWorkspaceTabBar/);
  assert.match(tabBar, /scrollTabIntoView/);
  assert.match(tabBar, /scrollByPage/);
  assert.match(tabBar, /hasOverflow/);
  assert.match(tabBar, /canScrollLeft/);
  assert.match(tabBar, /canScrollRight/);
  assert.match(tabBar, /\$\{testId\}-prev/);
  assert.match(tabBar, /\$\{testId\}-next/);
  assert.match(tabBar, /di\.workspace\.tabsScrollPrev/);
  assert.match(tabBar, /di\.workspace\.tabsScrollNext/);
  assert.match(tabBar, /onFocus=\{\(\) => scrollTabIntoView\(tab\.key\)\}/);
  assert.match(tabBar, /role="tablist"/);
  assert.match(tabBar, /role="tab"/);
  assert.match(tabBar, /aria-selected/);
  assert.match(tabBar, /clientWidth \* 0\.7/);
  assert.doesNotMatch(tabBar, /window\.confirm/);
});

test("Case workspace reuses the same overflow-safe tab bar without redesigning content", () => {
  const page = read("app/drug-intelligence/cases/[id]/page.tsx");
  assert.match(page, /DrugWorkspaceTabBar/);
  assert.match(page, /testId="case-workspace-tabs"/);
  assert.match(page, /DrugCaseIdentityHeader/);
  assert.match(page, /DrugCaseIntelligenceSummary/);
});
