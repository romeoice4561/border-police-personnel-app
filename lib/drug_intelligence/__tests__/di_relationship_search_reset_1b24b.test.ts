/**
 * Phase 1B.2.4B — ล้างทั้งหมด / ค้นหาใหม่ must clear the entire Relationship Search session.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearSourceQueryContext, saveSourceQueryContext } from "@/lib/drug_intelligence/drug_relationship_search_context";

const ROOT = process.cwd();
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const resultsSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
const visualSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_entity_visual.tsx"), "utf8");
const answerFirstSrc = readFileSync(
  join(ROOT, "lib/drug_intelligence/__tests__/di_relationship_search_answer_first_1b24.test.ts"),
  "utf8"
);

describe("Phase 1B.2.4B canonical full session reset", () => {
  test("resetAll uses a clean Relationship Search href (no leftover rel* params)", () => {
    assert.match(panelSrc, /export const RELATIONSHIP_SEARCH_CLEAN_HREF = "\/drug-intelligence\/search\?mode=relationship"/);
    assert.match(panelSrc, /function resetAll/);
    assert.match(panelSrc, /router\.replace\(RELATIONSHIP_SEARCH_CLEAN_HREF\)/);
    const resetBody = panelSrc.match(/function resetAll\(\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
    assert.ok(resetBody.includes("router.replace(RELATIONSHIP_SEARCH_CLEAN_HREF)"));
    assert.ok(!resetBody.includes("pushRelationshipParams"));
  });

  test("reset clears drafts, sessionStorage context, expand continuity, and query cache", () => {
    assert.match(panelSrc, /function resetAll[\s\S]*setDraftSource\(null\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setDraftRelationId\(""\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setDraftTarget\(null\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setDraftTargetType\(""\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setDraftPresetId\(""\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setSourceQueryContext\(null\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*clearSourceQueryContext\(\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*setPreviousResultReturn\(null\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*removeQueries\(\{\s*queryKey:\s*\["drug-relationship-search"\]/);
  });

  test("reset immediately suppresses answer-first results UI (no URL lag flash)", () => {
    assert.match(panelSrc, /sessionSuppressed/);
    assert.match(panelSrc, /setSessionSuppressed\(true\)/);
    assert.match(panelSrc, /const showAnswerFirst = Boolean\(run && query\) && !sessionSuppressed/);
    assert.match(panelSrc, /if \(!run && sessionSuppressed\) setSessionSuppressed\(false\)/);
  });

  test("ค้นหาใหม่ reuses the same resetAll primitive", () => {
    assert.match(panelSrc, /function startNewSearch\(\) \{\s*resetAll\(\);\s*focusStep1Soon\(\);/);
    assert.match(panelSrc, /data-testid="rel-new-search"/);
    assert.match(panelSrc, /onClick=\{startNewSearch\}/);
  });

  test("sessionStorage helper clearSourceQueryContext removes the key", () => {
    // jsdom-less unit: functions no-op without window; still assert export presence via import
    assert.equal(typeof clearSourceQueryContext, "function");
    assert.equal(typeof saveSourceQueryContext, "function");
    assert.match(
      readFileSync(join(ROOT, "lib/drug_intelligence/drug_relationship_search_context.ts"), "utf8"),
      /sessionStorage\.removeItem\(SESSION_KEY\)/
    );
  });

  test("answer-first + visual entity language remain wired", () => {
    assert.match(panelSrc, /\{showAnswerFirst \? \(\s*<>\s*\{resultsSection\}\s*\{postResultFooter\}/);
    assert.match(panelSrc, /DrugEntityIconMark/);
    assert.match(resultsSrc, /relationship-search-context/);
    assert.match(visualSrc, /DRUG_ENTITY_ICON/);
    assert.match(answerFirstSrc, /Quick Search is not rendered/);
  });

  test("returnTo continuity still depends on relRun URL state (not destroyed by reset primitive)", () => {
    assert.match(panelSrc, /relRun/);
    assert.match(panelSrc, /#relationship-results/);
    assert.match(panelSrc, /const returnPath =/);
    assert.match(resultsSrc, /withReturnTo/);
  });
});
