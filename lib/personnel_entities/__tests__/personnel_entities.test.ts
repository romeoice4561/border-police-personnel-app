/**
 * Phase 51.1A — Entity Resolution Layer tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrgTree } from "@/lib/organization/org_tree";
import {
  applyConversationContext,
  buildOrgEntityCatalog,
  buildUnitSuggestionActions,
  companyAliasesForCode,
  conversationFromOrganization,
  divisionAliasesForCode,
  normalizeAliasKey,
  regionAliasesForCode,
  resolvePersonnelEntities,
} from "@/lib/personnel_entities";

const TREE: OrgTree = {
  headquarters: [],
  regions: [
    { id: 100, code: "4", nameTh: "ภาค 4", headquartersId: null },
    { id: 101, code: "3", nameTh: "ภาค 3", headquartersId: null },
  ],
  battalions: [
    { id: 200, code: "41", nameTh: "กก.ตชด.41", regionId: 100 },
    { id: 201, code: "42", nameTh: "กก.ตชด.42", regionId: 100 },
  ],
  companies: [
    { id: 57, code: "414", nameTh: "ร้อย ตชด.414", battalionId: 200 },
    { id: 58, code: "415", nameTh: "ร้อย ตชด.415", battalionId: 200 },
  ],
};

describe("personnel_entities aliases", () => {
  it("normalizes whitespace, dots, and mixed casing", () => {
    assert.equal(normalizeAliasKey("ร้อย  414"), normalizeAliasKey("ร้อย414"));
    assert.equal(normalizeAliasKey("ตชด.414"), normalizeAliasKey("ตชด414"));
    assert.equal(normalizeAliasKey("กก.ตชด.41"), normalizeAliasKey("กกตชด41"));
  });

  it("generates company / division / region alias sets", () => {
    assert.ok(companyAliasesForCode("414").includes("ร้อย414"));
    assert.ok(divisionAliasesForCode("41").includes("กก41"));
    assert.ok(regionAliasesForCode("4").includes("ภาค4"));
  });
});

describe("personnel_entities organization resolution", () => {
  const catalog = buildOrgEntityCatalog(TREE);

  it("maps public company code 414 to internal id 57", () => {
    const r = resolvePersonnelEntities("ร้อย414", { catalog });
    assert.equal(r.clarification, null);
    assert.ok(r.primaryOrganization);
    assert.equal(r.primaryOrganization!.type, "company");
    assert.equal(r.primaryOrganization!.publicCode, "414");
    assert.equal(r.primaryOrganization!.internalNumericId, 57);
    assert.equal(r.primaryOrganization!.displayName, "ร้อย ตชด.414");
  });

  it("resolves every common company alias identically", () => {
    const aliases = ["414", "ร้อย414", "ร้อย 414", "ตชด414", "ตชด.414", "กองร้อย414", "กองร้อย ตชด.414"];
    for (const query of aliases) {
      const r = resolvePersonnelEntities(query, { catalog });
      assert.equal(r.primaryOrganization?.publicCode, "414", query);
      assert.equal(r.primaryOrganization?.internalNumericId, 57, query);
    }
  });

  it("resolves division aliases to public code 41 / internal 200", () => {
    for (const query of ["41", "กก41", "กก.41", "กก.ตชด.41", "กองกำกับ41", "กองกำกับ 41"]) {
      const r = resolvePersonnelEntities(query, { catalog });
      assert.equal(r.primaryOrganization?.type, "division", query);
      assert.equal(r.primaryOrganization?.publicCode, "41", query);
      assert.equal(r.primaryOrganization?.internalNumericId, 200, query);
    }
  });

  it("resolves region aliases to public code 4 / internal 100", () => {
    for (const query of ["ภาค4", "ภาค 4", "Region4"]) {
      const r = resolvePersonnelEntities(query, { catalog });
      assert.equal(r.primaryOrganization?.type, "region", query);
      assert.equal(r.primaryOrganization?.publicCode, "4", query);
      assert.equal(r.primaryOrganization?.internalNumericId, 100, query);
    }
  });

  it("never treats public code as internal id", () => {
    const r = resolvePersonnelEntities("414", { catalog });
    assert.notEqual(r.primaryOrganization?.internalNumericId, 414);
    assert.equal(r.primaryOrganization?.internalNumericId, 57);
  });
});

describe("personnel_entities context + suggestions", () => {
  const catalog = buildOrgEntityCatalog(TREE);

  it("conversation context contract scopes a follow-up query", () => {
    const first = resolvePersonnelEntities("ร้อย414", { catalog });
    const ctx = conversationFromOrganization(first.primaryOrganization);
    assert.ok(ctx?.organization);
    assert.equal(ctx!.organization!.publicCode, "414");

    const second = resolvePersonnelEntities("พร้อมเลื่อน", {
      catalog,
      conversationContext: ctx,
    });
    assert.equal(second.primaryOrganization?.publicCode, "414");
    assert.equal(second.primaryOrganization?.confidence, "context");
    assert.equal(second.conversationContext?.organization?.publicCode, "414");

    // Explicit helper remains available for adapters
    const applied = applyConversationContext(second, ctx, () => first.primaryOrganization);
    assert.equal(applied.primaryOrganization?.publicCode, "414");
  });

  it("builds unit suggestion actions without hostnames", () => {
    const r = resolvePersonnelEntities("414", { catalog });
    const actions = buildUnitSuggestionActions(r.primaryOrganization!);
    assert.ok(actions.length >= 5);
    assert.ok(actions.some((a) => a.labelTh.includes("พร้อมเลื่อน")));
    assert.ok(actions.every((a) => !String(a.payload.href ?? "").includes("://") || String(a.payload.href).startsWith("/")));
  });
});
