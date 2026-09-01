/**
 * Phase 1B.2.4 / 18.5 — centralized Drug entity visual language.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const visualSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_entity_visual.tsx"), "utf8");
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const resultsSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
const pickerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_entity_picker.tsx"), "utf8");
const legendSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_legend.tsx"), "utf8");
const graphNodeSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_graph_node.tsx"), "utf8");
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");

const ENTITY_TYPES = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"] as const;

describe("Drug entity visual mapping — canonical icons", () => {
  test("DRUG_ENTITY_ICON covers every graph node type exactly once", () => {
    assert.match(visualSrc, /export const DRUG_ENTITY_ICON/);
    for (const type of ENTITY_TYPES) {
      assert.match(visualSrc, new RegExp(`${type}:\\s*\\w+`));
    }
    assert.match(visualSrc, /PERSON:\s*User/);
    assert.match(visualSrc, /PHONE:\s*Phone/);
    assert.match(visualSrc, /SIM:\s*CreditCard/);
    assert.match(visualSrc, /DEVICE:\s*Smartphone/);
    assert.match(visualSrc, /VEHICLE:\s*Car/);
    assert.match(visualSrc, /CASE:\s*FileSpreadsheet/);
    assert.match(visualSrc, /LOCATION:\s*MapPin/);
  });

  test("Relationship Search panel + results + picker share the canonical map", () => {
    assert.match(panelSrc, /from "@\/components\/drug_intelligence\/drug_entity_visual"/);
    assert.match(panelSrc, /DrugEntityIconMark/);
    assert.match(panelSrc, /DRUG_ENTITY_ICON/);
    assert.doesNotMatch(panelSrc, /const ENTITY_ICON:/);
    assert.match(resultsSrc, /from "@\/components\/drug_intelligence\/drug_entity_visual"/);
    assert.match(resultsSrc, /DrugEntityIconMark/);
    assert.match(pickerSrc, /DRUG_ENTITY_ICON/);
    assert.match(pickerSrc, /data-entity-type=\{result\.entityType\}/);
  });

  test("Network legend/graph reuse the same map (no competing LOCATION icon)", () => {
    assert.match(legendSrc, /DRUG_ENTITY_ICON/);
    assert.match(graphNodeSrc, /DRUG_ENTITY_ICON/);
    assert.doesNotMatch(legendSrc, /LOCATION:\s*FileSpreadsheet/);
    assert.doesNotMatch(panelSrc, /LOCATION:\s*FileSpreadsheet/);
  });

  test("Thai labels remain mandatory beside icons", () => {
    assert.match(dictSrc, /di\.network\.groupPerson":\s*tr\("บุคคล"/);
    assert.match(dictSrc, /di\.network\.groupPhone":\s*tr\("เบอร์โทรศัพท์"/);
    assert.match(dictSrc, /di\.network\.groupCase":\s*tr\("คดี"/);
    assert.match(resultsSrc, /DRUG_GRAPH_NODE_TYPE_LABEL_KEY/);
    assert.match(panelSrc, /DRUG_GRAPH_NODE_TYPE_LABEL_KEY/);
    assert.match(visualSrc, /aria-hidden="true"/);
  });

  test("selected source card + search context + result cards use entity marks", () => {
    assert.match(panelSrc, /data-testid="selected-entity-card"/);
    assert.match(panelSrc, /data-entity-type=\{selection\.entityType\}/);
    assert.match(panelSrc, /DrugEntityIconMark[\s\S]*size="lg"/);
    assert.match(resultsSrc, /relationship-search-context/);
    assert.match(resultsSrc, /searchedFromIcon/);
    assert.match(resultsSrc, /data-entity-type=\{item\.to\.entityType\}/);
    assert.match(resultsSrc, /di\.rel\.relatedToSource/);
    assert.match(dictSrc, /di\.rel\.relatedToSource":\s*tr\("เกี่ยวข้องกับ"/);
  });

  test("meaning does not rely on emoji as primary icons", () => {
    assert.doesNotMatch(visualSrc, /👤|📁|📱|🚗/);
    assert.match(visualSrc, /from "lucide-react"/);
  });
});
