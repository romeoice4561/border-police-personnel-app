import { test } from "node:test";
import assert from "node:assert/strict";

import { toSkillSignals, matchesSkillFilter, isEmptySkillFilter, isExpiringSoon } from "@/lib/capability/skill_filter";
import type { OfficerSkillWithRelations } from "@/lib/database/query_types";

// Phase 44 — skill signal derivation + commander-search matching.

const ASOF = new Date(Date.UTC(2026, 6, 15));

function skillRow(ov: { skillId: number; skillCode: string; categoryId: number } & Partial<OfficerSkillWithRelations>): OfficerSkillWithRelations {
  return {
    id: ov.skillId,
    officerId: 1,
    skillId: ov.skillId,
    levelId: ov.levelId ?? null,
    yearsExperience: ov.yearsExperience ?? null,
    certificateNumber: ov.certificateNumber ?? null,
    issuingOrganization: null,
    issueDate: null,
    expiryDate: ov.expiryDate ?? null,
    verified: ov.verified ?? false,
    verifiedBy: null,
    verifiedDate: null,
    availableForDeployment: ov.availableForDeployment ?? false,
    remarks: null,
    createdAt: ASOF,
    updatedAt: ASOF,
    skill: {
      id: ov.skillId,
      code: ov.skillCode,
      categoryId: ov.categoryId,
      nameTh: "x",
      nameEn: "x",
      searchableKeywords: "",
      requiresCertificate: false,
      hasExpiry: false,
      sortOrder: 0,
      active: true,
      createdAt: ASOF,
      updatedAt: ASOF,
      category: { id: ov.categoryId, code: "C", nameTh: "c", nameEn: "c", icon: null, sortOrder: 0, active: true, createdAt: ASOF, updatedAt: ASOF },
    },
    level: ov.level ?? null,
  } as OfficerSkillWithRelations;
}

function level(rank: number) {
  return { id: rank, code: `L${rank}`, nameTh: "x", nameEn: "x", rank, active: true, createdAt: ASOF, updatedAt: ASOF };
}

test("toSkillSignals derives level rank, expert/instructor, certificate + expiring flags", () => {
  const rows = [
    skillRow({ skillId: 10, skillCode: "LANG_ZH", categoryId: 3, level: level(5), verified: true, availableForDeployment: true }),
    skillRow({ skillId: 20, skillCode: "TAC_TCCC", categoryId: 4, level: level(7), certificateNumber: "C-1", expiryDate: new Date(Date.UTC(2026, 7, 1)) }),
    skillRow({ skillId: 30, skillCode: "TECH_AI", categoryId: 2, level: level(6) }),
  ];
  const signals = toSkillSignals(rows, ASOF);

  const zh = signals.find((s) => s.skillCode === "LANG_ZH")!;
  assert.equal(zh.levelRank, 5);
  assert.equal(zh.verified, true);
  assert.equal(zh.availableForDeployment, true);
  assert.equal(zh.isExpert, false); // rank 5 < 6

  const tccc = signals.find((s) => s.skillCode === "TAC_TCCC")!;
  assert.equal(tccc.isInstructor, true); // rank 7
  assert.equal(tccc.hasCertificate, true);
  assert.equal(tccc.certificateExpiringSoon, true); // expires ~17 days out

  const ai = signals.find((s) => s.skillCode === "TECH_AI")!;
  assert.equal(ai.isExpert, true); // rank 6
  assert.equal(ai.isInstructor, false);
});

test("isExpiringSoon: within window (incl. already expired) true; far future false; null false", () => {
  assert.equal(isExpiringSoon(new Date(Date.UTC(2026, 7, 1)), ASOF), true); // ~17 days
  assert.equal(isExpiringSoon(new Date(Date.UTC(2026, 5, 1)), ASOF), true); // already expired
  assert.equal(isExpiringSoon(new Date(Date.UTC(2027, 0, 1)), ASOF), false); // ~half a year
  assert.equal(isExpiringSoon(null, ASOF), false);
});

test("empty filter matches everyone", () => {
  const signals = toSkillSignals([skillRow({ skillId: 1, skillCode: "X", categoryId: 1 })], ASOF);
  assert.equal(isEmptySkillFilter({}), true);
  assert.equal(matchesSkillFilter(signals, {}), true);
  assert.equal(matchesSkillFilter([], {}), true);
});

test("all constraints must be satisfied by the SAME skill (not spread across skills)", () => {
  const signals = toSkillSignals(
    [
      skillRow({ skillId: 10, skillCode: "LANG_ZH", categoryId: 3, level: level(5), availableForDeployment: false }),
      skillRow({ skillId: 99, skillCode: "OTHER", categoryId: 9, level: level(1), availableForDeployment: true }),
    ],
    ASOF
  );
  // Chinese at Excellent AND deployment-ready — the Chinese row is NOT
  // deployment-ready, and the deployment-ready row is not Chinese → no match.
  assert.equal(matchesSkillFilter(signals, { skillId: 10, minLevelRank: 5, availableForDeployment: true }), false);
  // Chinese at Excellent alone → matches.
  assert.equal(matchesSkillFilter(signals, { skillId: 10, minLevelRank: 5 }), true);
});

test("minLevelRank requires level >= threshold; unset level never matches a min-level filter", () => {
  const withLevel = toSkillSignals([skillRow({ skillId: 1, skillCode: "A", categoryId: 1, level: level(4) })], ASOF);
  const noLevel = toSkillSignals([skillRow({ skillId: 1, skillCode: "A", categoryId: 1 })], ASOF);
  assert.equal(matchesSkillFilter(withLevel, { minLevelRank: 4 }), true);
  assert.equal(matchesSkillFilter(withLevel, { minLevelRank: 5 }), false);
  assert.equal(matchesSkillFilter(noLevel, { minLevelRank: 1 }), false);
});

test("category, verified, certificate, expert, instructor, experience filters each constrain", () => {
  const signals = toSkillSignals(
    [skillRow({ skillId: 7, skillCode: "TECH_AI", categoryId: 2, level: level(6), verified: true, certificateNumber: "C", yearsExperience: 8 })],
    ASOF
  );
  assert.equal(matchesSkillFilter(signals, { categoryId: 2 }), true);
  assert.equal(matchesSkillFilter(signals, { categoryId: 99 }), false);
  assert.equal(matchesSkillFilter(signals, { verified: true }), true);
  assert.equal(matchesSkillFilter(signals, { hasCertificate: true }), true);
  assert.equal(matchesSkillFilter(signals, { isExpert: true }), true);
  assert.equal(matchesSkillFilter(signals, { isInstructor: true }), false);
  assert.equal(matchesSkillFilter(signals, { minYearsExperience: 5 }), true);
  assert.equal(matchesSkillFilter(signals, { minYearsExperience: 10 }), false);
});
