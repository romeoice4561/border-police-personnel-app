/**
 * Phase 1B.2 Relationship Search UX — source-string regression tests.
 * Protects mode cards, 3-step workflow, presets, governance notice.
 * Does not execute browser UI.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const modeSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_search_mode_switcher.tsx"), "utf8");
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const resultsSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/search/page.tsx"), "utf8");
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
const catalogSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_relationship_query_catalog.ts"), "utf8");

describe("Phase 1B.2 Search Center mode cards", () => {
  test("mode switcher is semantic tablist with three cards", () => {
    assert.match(modeSrc, /role="tablist"/);
    assert.match(modeSrc, /role="tab"/);
    assert.match(modeSrc, /aria-selected=\{selected\}/);
    assert.match(modeSrc, /data-testid="search-mode-cards"/);
    assert.match(modeSrc, /data-testid=\{`search-mode-\$\{item\.id\}`\}/);
    assert.match(modeSrc, /id:\s*"general"/);
    assert.match(modeSrc, /id:\s*"relationship"/);
    assert.match(modeSrc, /id:\s*"ai"/);
  });

  test("AI mode remains disabled with coming-soon badge", () => {
    assert.match(modeSrc, /id:\s*"ai"[\s\S]*disabled:\s*true/);
    assert.match(modeSrc, /di\.search\.modeAiSoon/);
    assert.match(modeSrc, /aria-disabled=\{item\.disabled/);
  });

  test("active mode uses accent border/background (not color-only)", () => {
    assert.match(modeSrc, /border-accent bg-accent\/10/);
    assert.match(modeSrc, /di\.search\.modeGeneralDesc/);
    assert.match(modeSrc, /di\.search\.modeRelationshipDesc/);
  });
});

describe("Phase 1B.2 Relationship 3-step workflow", () => {
  test("desktop workflow exposes three numbered steps", () => {
    assert.match(panelSrc, /data-testid="rel-step-1"/);
    assert.match(panelSrc, /data-testid="rel-step-2"/);
    assert.match(panelSrc, /data-testid="rel-step-3"/);
    assert.match(panelSrc, /di\.rel\.sourceSection/);
    assert.match(panelSrc, /di\.rel\.relationSection/);
    assert.match(panelSrc, /di\.rel\.targetSection/);
    assert.match(dictSrc, /① เลือกข้อมูลต้นทาง/);
    assert.match(dictSrc, /② เลือกความสัมพันธ์/);
    assert.match(dictSrc, /③ เลือก\/ระบุสิ่งที่ต้องการหา/);
  });

  test("workflow + primary CTA appear before Quick Search (above-the-fold hierarchy)", () => {
    const workflowIdx = panelSrc.indexOf('data-testid="relationship-workflow"');
    const ctaIdx = panelSrc.indexOf('data-testid="rel-search-submit"');
    assert.ok(workflowIdx >= 0 && ctaIdx >= 0);
    assert.ok(workflowIdx < ctaIdx, "CTA must sit inside/after workflow markup");
    // Phase 1B.2.3: after execution, answer-first order swaps Quick Search below results.
    assert.match(panelSrc, /showAnswerFirst/);
    assert.match(panelSrc, /\{showAnswerFirst \? \([\s\S]*resultsSection[\s\S]*quickSearchSection/);
  });

  test("after search, Quick Search must not interrupt results (answer-first)", () => {
    assert.match(panelSrc, /showAnswerFirst \? \([\s\S]*\{resultsSection\}[\s\S]*\{quickSearchSection\}/);
    assert.match(panelSrc, /data-collapsed=\{showAnswerFirst \? "true" : "false"\}/);
  });

  test("selected source renders concrete entity card", () => {
    assert.match(panelSrc, /data-testid="selected-entity-card"/);
    assert.match(panelSrc, /function EntityCard/);
  });

  test("relation selection shows explanation card from catalog semantics", () => {
    assert.match(panelSrc, /data-testid="relation-explain-card"/);
    assert.match(panelSrc, /relationExplainKey/);
    assert.match(panelSrc, /di\.rel\.explainDirect/);
    assert.match(panelSrc, /di\.rel\.explainInferred/);
    assert.match(panelSrc, /di\.rel\.explainPath/);
  });

  test("optional target wording remains available", () => {
    assert.match(panelSrc, /di\.rel\.targetOptionalDetail|di\.rel\.targetOptionalHint/);
    assert.match(panelSrc, /di\.rel\.targetSearchOptional/);
  });

  test("primary Search CTA and Reset are present", () => {
    assert.match(panelSrc, /data-testid="rel-search-submit"/);
    assert.match(panelSrc, /data-testid="rel-reset-all"/);
    assert.match(panelSrc, /function resetAll/);
    assert.match(panelSrc, /di\.rel\.disabledNeedSource|di\.rel\.searchDisabledHint/);
    assert.match(panelSrc, /submitting/);
  });

  test("desktop uses multi-column workflow; mobile keeps vertical arrows", () => {
    assert.match(panelSrc, /lg:grid-cols-\[1fr_auto_1fr_auto_1fr\]/);
    assert.match(panelSrc, /function StepArrow/);
    assert.match(panelSrc, /lg:hidden/);
    assert.match(panelSrc, /hidden lg:flex/);
  });
});

describe("Phase 1B.2 Quick Search cards", () => {
  test("presets render as cards and configure without auto-run", () => {
    assert.match(panelSrc, /data-testid="relationship-quick-search"/);
    assert.match(panelSrc, /function applyPreset/);
    assert.match(panelSrc, /relRun: undefined/);
    assert.doesNotMatch(panelSrc, /applyPreset\([\s\S]{0,200}run:\s*true/);
    assert.match(panelSrc, /data-testid=\{`rel-preset-\$\{preset\.id\}`\}/);
    for (const id of [
      "preset_phone_cases",
      "preset_person_phones",
      "preset_vehicle_cases",
      "preset_device_cases",
      "preset_sim_cases",
      "preset_person_path",
    ]) {
      assert.match(panelSrc, new RegExp(id));
    }
  });

  test("preset that needs source scrolls and focuses Step 1", () => {
    assert.match(panelSrc, /scrollIntoView\(\{\s*behavior:\s*"smooth"/);
    assert.match(panelSrc, /step1Ref\.current\?\.scrollIntoView/);
    assert.match(panelSrc, /focusable\?\.focus/);
    assert.match(dictSrc, /กดเพื่อช่วยตั้งค่าการค้นหาอย่างรวดเร็ว/);
  });

  test("path preset badges as path; direct presets as fact — not fabricated inferred", () => {
    assert.match(panelSrc, /function presetBadgeKey/);
    assert.match(panelSrc, /queryMode === "PATH"/);
    assert.match(catalogSrc, /preset_person_path[\s\S]*person_path_to_person/);
  });
});

describe("Phase 1B.2 governance + results", () => {
  test("QUERY CONDITION notice is present and expanded", () => {
    assert.match(panelSrc, /data-testid="query-condition-notice"/);
    assert.match(panelSrc, /di\.rel\.queryConditionNote/);
    assert.match(panelSrc, /di\.rel\.queryConditionBody/);
  });

  test("empty state is compact and instructional", () => {
    assert.match(panelSrc, /di\.rel\.promptEmptyTitle/);
    assert.match(panelSrc, /di\.rel\.promptEmpty/);
    assert.match(panelSrc, /border-dashed/);
  });

  test("results keep detail/network primary hierarchy with why/evidence sections", () => {
    assert.match(resultsSrc, /di\.rel\.openNetwork/);
    assert.match(resultsSrc, /di\.rel\.expand/);
    assert.match(resultsSrc, /variant="accent"/);
    assert.match(resultsSrc, /di\.rel\.whyFoundLabel/);
    assert.match(resultsSrc, /di\.rel\.evidenceInSystem/);
    assert.match(resultsSrc, /primaryIsDetail/);
  });

  test("page header uses stronger Search Center identity", () => {
    assert.match(pageSrc, /di\.search\.centerTitle/);
    assert.match(pageSrc, /di\.search\.centerSubtitle/);
    assert.match(pageSrc, /di\.search\.centerDescription/);
    assert.match(dictSrc, /Drug Intelligence Search Center/);
  });

  test("forbidden user-facing developer jargon absent from new Thai copy", () => {
    assert.doesNotMatch(dictSrc, /di\.rel\.[^"]+":\s*tr\("[^"]*\b(graph|BFS|entity ID|junction)\b/i);
    assert.doesNotMatch(dictSrc, /di\.search\.[^"]+":\s*tr\("[^"]*\b(graph|BFS)\b/i);
  });
});

describe("Phase 1B.2 architecture preservation", () => {
  test("panel still uses controlled catalog + relationship search hook", () => {
    assert.match(panelSrc, /DRUG_RELATIONSHIP_SEARCH_PRESETS/);
    assert.match(panelSrc, /getControlledRelation/);
    assert.match(panelSrc, /useDrugRelationshipSearch/);
    assert.match(panelSrc, /onExpand/);
  });

  test("URL mode contract preserved on search page", () => {
    assert.match(pageSrc, /mode === "relationship"/);
    assert.match(pageSrc, /parseMode/);
    assert.match(pageSrc, /next\.set\("mode", nextMode\)/);
  });
});
