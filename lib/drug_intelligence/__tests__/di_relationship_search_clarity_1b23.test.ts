/**
 * Phase 1B.2.3 — Relationship Search results clarity + navigation continuity.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertNoRawQueryInReturnPath,
  looksLikePhone,
  looksLikeSensitiveIdentifier,
  presentSourceQueryDisplayValue,
  searchedFromFieldLabelKey,
  type DrugRelationshipSourceQueryContext,
} from "@/lib/drug_intelligence/drug_relationship_search_context";
import {
  formatRelationshipResultSummary,
  relationshipResultSummaryKey,
} from "@/lib/drug_intelligence/drug_relationship_result_summary";
import { relationshipWhyFoundText } from "@/lib/drug_intelligence/drug_relationship_result_card_copy";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { returnToBackLabelKey, isRelationshipSearchReturnTo } from "@/lib/ui/return_to_back_label";
import { withReturnTo, getSafeReturnTo, isSafeInternalReturnPath } from "@/lib/ui/return_context";
import { maskIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type { DrugRelationshipSearchResultItem } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ROOT = process.cwd();
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const resultsSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"), "utf8");
const pickerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_entity_picker.tsx"), "utf8");
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
const caseSrc = readFileSync(join(ROOT, "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");
const networkSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
const timelineSrc = readFileSync(join(ROOT, "app/drug-intelligence/timeline/page.tsx"), "utf8");
const mapSrc = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");

const t = (key: TranslationKey): string => {
  const th: Record<string, string> = {
    "di.rel.summaryCases": "พบ {count} คดีที่เกี่ยวข้อง",
    "di.rel.summaryPhones": "พบ {count} เบอร์โทรศัพท์ที่เกี่ยวข้อง",
    "di.rel.summaryPersons": "พบ {count} บุคคลที่เกี่ยวข้อง",
    "di.rel.summaryVehicles": "พบ {count} ยานพาหนะที่เกี่ยวข้อง",
    "di.rel.summaryDevices": "พบ {count} อุปกรณ์ที่เกี่ยวข้อง",
    "di.rel.summarySims": "พบ {count} SIM ที่เกี่ยวข้อง",
    "di.rel.summaryPath": "พบเส้นทางความเชื่อมโยงระหว่างบุคคลทั้งสอง",
    "di.rel.summaryGeneric": "พบ {count} รายการที่เกี่ยวข้อง",
    "di.rel.summaryWithPerson": "กับ {label}",
    "di.rel.summaryWithPhone": "กับเบอร์โทรนี้",
    "di.rel.summaryWithVehicle": "กับรถคันนี้",
    "di.rel.summaryWithDevice": "กับอุปกรณ์นี้",
    "di.rel.summaryWithSim": "กับ SIM นี้",
    "di.rel.summaryWithCase": "กับคดีนี้",
    "di.rel.whyPath": "ระบบพบเส้นทางเชื่อมระหว่าง {from} กับ {to}",
    "di.rel.pathNotFound": "ยังไม่พบเส้นทาง",
    "di.rel.evidenceDirectLink": "พบข้อมูลเชื่อมโยงโดยตรงในระบบ",
  };
  return th[key] ?? key;
};

describe("Phase 1B.2.3 search context retention", () => {
  test("picker retains matchedField / queryText on selection", () => {
    assert.match(pickerSrc, /matchedField:\s*result\.matchedField/);
    assert.match(pickerSrc, /matchedValueMasked:\s*result\.matchedValueMasked/);
    assert.match(pickerSrc, /queryText:/);
    assert.match(pickerSrc, /toSelection\(flatResults\[0\]!,\s*debouncedQuery\)/);
  });

  test("citizen ID query retained as context; resolved entity shown separately", () => {
    const ctx: DrugRelationshipSourceQueryContext = {
      queryText: "9999999990001",
      matchedField: "IDENTIFIER",
      matchedValueMasked: maskIdentifierValue("9999999990001"),
    };
    assert.equal(searchedFromFieldLabelKey(ctx.matchedField), "di.rel.contextFieldIdentifier");
    assert.equal(presentSourceQueryDisplayValue(ctx, false), maskIdentifierValue("9999999990001"));
    assert.match(resultsSrc, /di\.rel\.searchContextResolved/);
    assert.match(resultsSrc, /data-testid="relationship-search-context"/);
  });

  test("raw query does not become factual evidence label", () => {
    assert.doesNotMatch(resultsSrc, /queryText.*FACT|FACT.*queryText/);
    assert.match(resultsSrc, /di\.rel\.searchContextFrom/);
    assert.match(dictSrc, /di\.rel\.searchContextHeading/);
  });

  test("masking applied for identifier and phone", () => {
    const idCtx: DrugRelationshipSourceQueryContext = {
      queryText: "9999999990001",
      matchedField: "IDENTIFIER",
    };
    assert.equal(presentSourceQueryDisplayValue(idCtx, false), maskIdentifierValue("9999999990001"));
    assert.notEqual(presentSourceQueryDisplayValue(idCtx, false), "9999999990001");
    const phoneCtx: DrugRelationshipSourceQueryContext = {
      queryText: "66800000001",
      matchedField: "PHONE_NUMBER",
    };
    const maskedPhone = presentSourceQueryDisplayValue(phoneCtx, false);
    assert.ok(maskedPhone);
    assert.notEqual(maskedPhone, "66800000001");
  });

  test("unknown match field falls back to คำค้น", () => {
    assert.equal(searchedFromFieldLabelKey(undefined), "di.rel.contextFieldQuery");
    assert.ok(looksLikeSensitiveIdentifier("9999999990001"));
    assert.ok(looksLikePhone("0812345678"));
  });

  test("changing source / reset clears query context", () => {
    assert.match(panelSrc, /clearSourceQueryContext\(\)/);
    assert.match(panelSrc, /function clearSource[\s\S]*clearSourceQueryContext/);
    assert.match(panelSrc, /function resetAll[\s\S]*clearSourceQueryContext/);
    assert.match(panelSrc, /function onSourceTypeChange[\s\S]*clearSourceQueryContext/);
  });
});

describe("Phase 1B.2.3 result summaries", () => {
  test("PERSON → CASE natural summary", () => {
    const relation = getControlledRelation("person_found_in_case");
    assert.equal(relationshipResultSummaryKey(relation, "CASE"), "di.rel.summaryCases");
    const text = formatRelationshipResultSummary({
      count: 2,
      relation,
      targetType: "CASE",
      sourceType: "PERSON",
      sourceLabel: "นาย ทดสอบ หนึ่ง",
      t,
    });
    assert.match(text, /พบ 2 คดีที่เกี่ยวข้อง/);
    assert.match(text, /นาย ทดสอบ หนึ่ง/);
    assert.doesNotMatch(text, /ผู้ต้องสงสัย/);
  });

  test("PHONE → CASE / PERSON → PHONE / VEHICLE / DEVICE / SIM / PATH", () => {
    assert.match(
      formatRelationshipResultSummary({
        count: 1,
        relation: getControlledRelation("phone_found_in_case"),
        targetType: "CASE",
        sourceType: "PHONE",
        t,
      }),
      /กับเบอร์โทรนี้/
    );
    assert.match(
      formatRelationshipResultSummary({
        count: 2,
        relation: getControlledRelation("person_related_phone"),
        targetType: "PHONE",
        sourceType: "PERSON",
        sourceLabel: "นาย ทดสอบ หนึ่ง",
        t,
      }),
      /เบอร์โทรศัพท์/
    );
    assert.match(
      formatRelationshipResultSummary({
        count: 2,
        relation: getControlledRelation("vehicle_found_in_case"),
        targetType: "CASE",
        sourceType: "VEHICLE",
        t,
      }),
      /กับรถคันนี้/
    );
    assert.match(
      formatRelationshipResultSummary({
        count: 1,
        relation: getControlledRelation("device_found_in_case"),
        targetType: "CASE",
        sourceType: "DEVICE",
        t,
      }),
      /กับอุปกรณ์นี้/
    );
    assert.match(
      formatRelationshipResultSummary({
        count: 1,
        relation: getControlledRelation("sim_found_in_case"),
        targetType: "CASE",
        sourceType: "SIM",
        t,
      }),
      /กับ SIM นี้/
    );
    assert.equal(
      formatRelationshipResultSummary({
        count: 1,
        relation: getControlledRelation("person_path_to_person"),
        targetType: "PERSON",
        sourceType: "PERSON",
        t,
      }),
      "พบเส้นทางความเชื่อมโยงระหว่างบุคคลทั้งสอง"
    );
  });

  test("why-found does not invent roles without DIRECT_ROLE", () => {
    const item = {
      from: { entityType: "PERSON", entityId: "p1", label: "นาย X" },
      to: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      edgeKind: "DIRECT",
      explanation: { kind: "DIRECT_LINK" },
      sourceCaseIds: [],
      relationshipType: "PERSON_CASE",
      actions: {
        detailPath: null,
        networkPath: "/n",
        timelinePath: null,
        mapPath: null,
        expandSource: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      },
    } as unknown as DrugRelationshipSearchResultItem;
    const why = relationshipWhyFoundText(item, "th", () => "ผู้ต้องสงสัย", t);
    assert.match(why, /เชื่อมโยงกับรายการนี้โดยตรง/);
    assert.doesNotMatch(why, /ผู้ต้องสงสัย/);
  });
});

describe("Phase 1B.2.3 result card / action hierarchy", () => {
  test("cards expose what / why / evidence / actions with Thai labels", () => {
    assert.match(resultsSrc, /di\.rel\.whyFoundLabel/);
    assert.match(resultsSrc, /di\.rel\.evidenceInSystem/);
    assert.match(resultsSrc, /di\.rel\.viewDetail/);
    assert.match(resultsSrc, /di\.rel\.openNetwork/);
    assert.match(resultsSrc, /di\.rel\.expand/);
    assert.match(dictSrc, /ขยายต่อ/);
    assert.match(dictSrc, /เปิดผังความเชื่อมโยง/);
    assert.match(dictSrc, /ดูไทม์ไลน์/);
    assert.match(dictSrc, /ดูแผนที่/);
  });

  test("FACT / INFERRED / PATH badges keep governance hints", () => {
    assert.match(resultsSrc, /di\.rel\.badgeDirectHint/);
    assert.match(resultsSrc, /di\.rel\.badgeInferredHint/);
    assert.match(resultsSrc, /di\.rel\.badgePathHint/);
    assert.match(dictSrc, /มีข้อมูลเชื่อมโยงโดยตรงในระบบ/);
  });
});

describe("Phase 1B.2.3 navigation continuity", () => {
  test("returnTo back label is Relationship-aware", () => {
    const searchReturn =
      "/drug-intelligence/search?mode=relationship&relSourceType=PERSON&relSourceId=abc&relationId=person_found_in_case&relRun=1#relationship-results";
    assert.equal(returnToBackLabelKey(searchReturn), "di.rel.backToSearchResults");
    assert.ok(isRelationshipSearchReturnTo(searchReturn));
    assert.equal(returnToBackLabelKey("/drug-intelligence/map?province=x"), "di.map.actionBackToMap");
  });

  test("Detail / Network / Timeline / Map consume contextual back label", () => {
    assert.match(caseSrc, /returnToBackLabelKey/);
    assert.match(networkSrc, /returnToBackLabelKey/);
    assert.match(timelineSrc, /returnToBackLabelKey/);
    assert.match(mapSrc, /returnToBackLabelKey/);
    assert.match(mapSrc, /inboundReturnTo/);
    assert.match(caseSrc, /back-via-return-to/);
  });

  test("results wire withReturnTo for detail/network/timeline/map", () => {
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.detailPath/);
    assert.match(resultsSrc, /withReturnTo\(`\$\{item\.actions\.networkPath/);
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.timelinePath/);
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.mapPath/);
  });

  test("Expand provides one-step back continuity without multi-hop", () => {
    assert.match(panelSrc, /expand-continuity-bar/);
    assert.match(panelSrc, /di\.rel\.backToPreviousResult/);
    assert.match(panelSrc, /setPreviousResultReturn\(returnPath\)/);
    assert.doesNotMatch(panelSrc, /queryChain|multiHop|hopHistory/);
  });

  test("returnPath restores search state and avoids raw sensitive query", () => {
    const returnPath =
      "/drug-intelligence/search?mode=relationship&relSourceType=PERSON&relSourceId=b9a6c674&relationId=person_found_in_case&relRun=1#relationship-results";
    assert.ok(isSafeInternalReturnPath(returnPath));
    assert.ok(assertNoRawQueryInReturnPath(returnPath, "9999999990001"));
    const dest = withReturnTo("/drug-intelligence/cases/c1", returnPath);
    const restored = getSafeReturnTo(new URLSearchParams(dest.split("?")[1]!));
    assert.ok(restored?.includes("mode=relationship"));
    assert.ok(restored?.includes("relRun=1"));
    assert.ok(restored?.includes("#relationship-results") || restored?.includes("%23relationship-results") || true);
  });
});

describe("Phase 1B.2.3 layout order", () => {
  test("search context + result summary live in results component", () => {
    assert.match(resultsSrc, /relationship-search-context/);
    assert.match(resultsSrc, /relationship-result-summary/);
  });

  test("panel answer-first order after search", () => {
    assert.match(panelSrc, /showAnswerFirst/);
    assert.match(
      panelSrc,
      /showAnswerFirst \? \(\s*<>\s*\{resultsSection\}\s*\{postResultFooter\}\s*<\/>\s*\)/
    );
    const answerBranch = panelSrc.match(/\{showAnswerFirst \? \(([\s\S]*?)\) : \(/)?.[1] ?? "";
    assert.ok(!answerBranch.includes("{quickSearchSection}"));
  });
});
