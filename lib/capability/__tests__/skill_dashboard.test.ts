import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSkillDashboard } from "@/lib/capability/skill_dashboard";
import type { OfficerWithRelations, OfficerSkillWithRelations } from "@/lib/database/query_types";

// Phase 44 — skill dashboard aggregation.

const NOW = new Date(Date.UTC(2026, 6, 15));

function skill(ov: {
  skillId: number;
  skillCode: string;
  categoryCode: string;
  levelRank?: number;
  availableForDeployment?: boolean;
  certificateNumber?: string;
  expiryDate?: Date | null;
}): OfficerSkillWithRelations {
  return {
    id: ov.skillId,
    officerId: 1,
    skillId: ov.skillId,
    levelId: ov.levelRank ?? null,
    yearsExperience: null,
    certificateNumber: ov.certificateNumber ?? null,
    issuingOrganization: null,
    issueDate: null,
    expiryDate: ov.expiryDate ?? null,
    verified: false,
    verifiedBy: null,
    verifiedDate: null,
    availableForDeployment: ov.availableForDeployment ?? false,
    remarks: null,
    createdAt: NOW,
    updatedAt: NOW,
    skill: {
      id: ov.skillId,
      code: ov.skillCode,
      categoryId: 1,
      nameTh: ov.skillCode,
      nameEn: ov.skillCode,
      searchableKeywords: "",
      requiresCertificate: false,
      hasExpiry: false,
      sortOrder: 0,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
      category: { id: 1, code: ov.categoryCode, nameTh: ov.categoryCode, nameEn: ov.categoryCode, icon: null, sortOrder: 0, active: true, createdAt: NOW, updatedAt: NOW },
    },
    level: ov.levelRank != null ? { id: ov.levelRank, code: `L${ov.levelRank}`, nameTh: "x", nameEn: "x", rank: ov.levelRank, active: true, createdAt: NOW, updatedAt: NOW } : null,
  } as OfficerSkillWithRelations;
}

function officer(id: number, skills: OfficerSkillWithRelations[]): OfficerWithRelations {
  return { id, officerId: `o${id}`, skills } as OfficerWithRelations;
}

test("counts coverage, deployment-ready, instructors, languages, AI/drone experts, and staff buckets by distinct officer", () => {
  const officers: OfficerWithRelations[] = [
    // Officer 1: Chinese (language), AI expert (rank 6), deployment-ready.
    officer(1, [
      skill({ skillId: 1, skillCode: "LANG_ZH", categoryCode: "LANGUAGE", levelRank: 5, availableForDeployment: true }),
      skill({ skillId: 2, skillCode: "TECH_AI", categoryCode: "TECH", levelRank: 6 }),
    ]),
    // Officer 2: instructor TCCC (rank 7), medical, expiring cert.
    officer(2, [
      skill({ skillId: 3, skillCode: "TAC_TCCC", categoryCode: "TACTICAL", levelRank: 7, certificateNumber: "C-1", expiryDate: new Date(Date.UTC(2026, 7, 1)) }),
      skill({ skillId: 4, skillCode: "MED_CPR", categoryCode: "MEDICAL", levelRank: 3 }),
    ]),
    // Officer 3: drone expert (rank 6), legal, PR.
    officer(3, [
      skill({ skillId: 5, skillCode: "AVI_DRONE_PILOT", categoryCode: "AVIATION", levelRank: 6 }),
      skill({ skillId: 6, skillCode: "LEGAL_BARRISTER", categoryCode: "LEGAL" }),
      skill({ skillId: 7, skillCode: "MEDIA_MC", categoryCode: "MEDIA" }),
    ]),
    // Officer 4: no skills.
    officer(4, []),
  ];

  const d = buildSkillDashboard(officers, NOW);
  assert.equal(d.totalOfficers, 4);
  assert.equal(d.officersWithSkills, 3);
  assert.equal(d.deploymentReady, 1); // only officer 1
  assert.equal(d.instructors, 1); // officer 2 (rank 7)
  assert.equal(d.languageSpeakers, 1); // officer 1
  assert.equal(d.aiExperts, 1); // officer 1 (AI rank 6)
  assert.equal(d.droneExperts, 1); // officer 3 (drone rank 6)
  assert.equal(d.medicalStaff, 1); // officer 2
  assert.equal(d.legalStaff, 1); // officer 3
  assert.equal(d.itStaff, 1); // officer 1 (TECH)
  assert.equal(d.prStaff, 1); // officer 3 (MEDIA)
  assert.equal(d.certificatesExpiringSoon, 1); // officer 2
});

test("AI/drone buckets require EXPERT level — a low-level AI skill doesn't count", () => {
  const officers = [
    officer(1, [skill({ skillId: 1, skillCode: "TECH_AI", categoryCode: "TECH", levelRank: 3 })]),
  ];
  const d = buildSkillDashboard(officers, NOW);
  assert.equal(d.aiExperts, 0);
  assert.equal(d.itStaff, 1); // still counts as IT staff (category membership)
});

test("topSkills ranks by holder count, capped at 10", () => {
  const officers = [
    officer(1, [skill({ skillId: 1, skillCode: "LANG_EN", categoryCode: "LANGUAGE" })]),
    officer(2, [skill({ skillId: 1, skillCode: "LANG_EN", categoryCode: "LANGUAGE" })]),
    officer(3, [skill({ skillId: 2, skillCode: "TECH_AI", categoryCode: "TECH" })]),
  ];
  const d = buildSkillDashboard(officers, NOW);
  assert.equal(d.topSkills[0].skillCode, "LANG_EN");
  assert.equal(d.topSkills[0].count, 2);
  assert.ok(d.topSkills.length <= 10);
});

test("empty input yields all-zero aggregates (never throws)", () => {
  const d = buildSkillDashboard([], NOW);
  assert.equal(d.totalOfficers, 0);
  assert.equal(d.officersWithSkills, 0);
  assert.deepEqual(d.topSkills, []);
});
