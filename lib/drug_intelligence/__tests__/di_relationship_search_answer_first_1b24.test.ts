/**
 * Phase 1B.2.4 — Keep Quick Search out of the completed Relationship Search answer flow.
 * Source-string / contract regression tests (no browser execution).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const resultsSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/search/page.tsx"), "utf8");
const caseSrc = readFileSync(join(ROOT, "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");
const networkSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
const timelineSrc = readFileSync(join(ROOT, "app/drug-intelligence/timeline/page.tsx"), "utf8");
const mapSrc = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");
const catalogSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_relationship_query_catalog.ts"), "utf8");

describe("Phase 1B.2.4 Quick Search visibility by search state", () => {
  test("A. Quick Search remains in the pre-search branch", () => {
    assert.match(panelSrc, /data-testid="relationship-quick-search"/);
    assert.match(
      panelSrc,
      /showAnswerFirst \? \([\s\S]*?\) : \(\s*<>\s*\{quickSearchSection\}/
    );
    assert.match(panelSrc, /di\.rel\.presetsLabel/);
    for (const id of [
      "preset_phone_cases",
      "preset_person_phones",
      "preset_vehicle_cases",
      "preset_device_cases",
      "preset_sim_cases",
      "preset_person_path",
    ]) {
      assert.match(panelSrc, new RegExp(id));
      assert.match(catalogSrc, new RegExp(id));
    }
  });

  test("B/C. Quick Search is not rendered in the completed-result branch", () => {
    assert.match(panelSrc, /const showAnswerFirst = Boolean\(run && query\)/);
    assert.match(
      panelSrc,
      /showAnswerFirst \? \(\s*<>\s*\{resultsSection\}\s*\{postResultFooter\}\s*<\/>\s*\)/
    );
    const answerBranch = panelSrc.match(/\{showAnswerFirst \? \(([\s\S]*?)\) : \(/)?.[1] ?? "";
    assert.ok(answerBranch.includes("{resultsSection}"));
    assert.ok(answerBranch.includes("{postResultFooter}"));
    assert.ok(!answerBranch.includes("{quickSearchSection}"));
  });

  test("presets stay configure-only (no auto-run)", () => {
    assert.match(panelSrc, /function applyPreset/);
    assert.doesNotMatch(panelSrc, /applyPreset\([\s\S]{0,250}run:\s*true/);
    assert.match(panelSrc, /relRun: undefined/);
  });
});

describe("Phase 1B.2.4 answer order + post-result actions", () => {
  test("D/E/F. Search Context + Summary remain ahead of cards", () => {
    assert.match(resultsSrc, /data-testid="relationship-search-context"/);
    assert.match(resultsSrc, /data-testid="relationship-result-summary"/);
    const ctxIdx = resultsSrc.indexOf('data-testid="relationship-search-context"');
    const sumIdx = resultsSrc.indexOf('data-testid="relationship-result-summary"');
    const cardIdx = resultsSrc.indexOf("relationship-result-card");
    assert.ok(ctxIdx >= 0 && sumIdx >= 0);
    assert.ok(ctxIdx < sumIdx, "Search Context before Result Summary");
    if (cardIdx >= 0) assert.ok(sumIdx < cardIdx, "Result Summary before cards");
  });

  test("G/H. ค้นหาใหม่ clears completed state and restores Quick Search path", () => {
    assert.match(panelSrc, /function startNewSearch/);
    assert.match(panelSrc, /function startNewSearch\(\) \{\s*resetAll\(\);\s*focusStep1Soon\(\);/);
    assert.match(panelSrc, /data-testid="rel-new-search"/);
    assert.match(panelSrc, /function resetAll[\s\S]*clearSourceQueryContext/);
    assert.match(panelSrc, /function resetAll[\s\S]*relRun: undefined/);
    assert.match(dictSrc, /di\.rel\.newSearch":\s*tr\("ค้นหาใหม่"/);
    assert.match(dictSrc, /di\.rel\.postResultPrompt"/);
  });

  test("zero/error settled state offers edit conditions without Quick Search", () => {
    assert.match(panelSrc, /showZeroOrErrorActions/);
    assert.match(panelSrc, /function editConditions/);
    assert.match(panelSrc, /data-testid="rel-edit-conditions"/);
    assert.match(dictSrc, /di\.rel\.editConditions"/);
    assert.match(panelSrc, /postResultFooter/);
    assert.doesNotMatch(
      panelSrc,
      /searchSettled[\s\S]{0,80}\{quickSearchSection\}/
    );
  });

  test("QUERY governance notice remains after results as compact footer", () => {
    assert.match(panelSrc, /relationship-post-result-footer/);
    assert.match(panelSrc, /postResultFooter[\s\S]*query-condition-notice/);
    assert.match(panelSrc, /di\.rel\.queryConditionNote/);
    assert.match(panelSrc, /di\.rel\.queryConditionBody/);
  });
});

describe("Phase 1B.2.4 return continuity still hides Quick Search", () => {
  test("I–L. Detail/Network/Timeline/Map keep return-to-results label + relRun", () => {
    for (const src of [caseSrc, networkSrc, timelineSrc, mapSrc]) {
      assert.match(src, /returnToBackLabelKey|di\.rel\.backToSearchResults|isRelationshipSearchReturnTo/);
    }
    assert.match(panelSrc, /relRun/);
    // Returning with relRun=1 keeps showAnswerFirst true → Quick Search stays out of answer branch.
    assert.match(panelSrc, /const run = searchParams\.get\("relRun"\) === "1"/);
    assert.match(panelSrc, /const showAnswerFirst = Boolean\(run && query\)/);
  });

  test("M. Expand one-step continuity preserved (no multi-hop)", () => {
    assert.match(panelSrc, /expand-continuity-bar/);
    assert.match(panelSrc, /di\.rel\.backToPreviousResult/);
    assert.doesNotMatch(panelSrc, /queryChain|multiHop|hopHistory/);
  });
});

describe("Phase 1B.2.4 semantics + General Search untouched", () => {
  test("N. General Search mode still available on search page", () => {
    assert.match(pageSrc, /mode === "relationship"/);
    assert.match(pageSrc, /parseMode/);
    assert.match(pageSrc, /"general"/);
  });

  test("O–R. catalog FACT/INFERRED/PATH + presets unchanged; no factual writes in panel", () => {
    assert.match(catalogSrc, /queryMode:\s*"NEIGHBORHOOD"/);
    assert.match(catalogSrc, /queryMode:\s*"PATH"/);
    assert.match(catalogSrc, /edgeKind:\s*"INFERRED"/);
    assert.match(catalogSrc, /edgeKind:\s*"DIRECT"/);
    assert.doesNotMatch(panelSrc, /\bprisma\./);
    assert.doesNotMatch(panelSrc, /ผู้ค้า|ผู้ขาย|ผู้สั่งการ|\bCDR\b/);
  });
});
