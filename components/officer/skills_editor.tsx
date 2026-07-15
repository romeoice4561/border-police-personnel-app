/**
 * SkillsEditor (Phase 44 — Personnel Capability Intelligence, edit mode).
 *
 * The "ความเชี่ยวชาญและศักยภาพ / Professional Skills & Competencies" card in
 * EDIT mode: an accordion of skill categories; within each, a checkbox per
 * skill. Checking a skill reveals its detail sub-form — proficiency level,
 * years of experience, certificate (number / issuing org / issue + expiry
 * date), verification (verified + by + date), mission readiness, remarks.
 *
 * Pure controlled component over the draft skill rows from useOfficerWorkspace
 * (no fetching, no save logic). The catalog (categories + skills + levels) is
 * loaded server-side and passed in. Labels come from the central dictionary;
 * skill/category/level NAMES are the DB's bilingual columns rendered in the
 * active language. Accessible: category disclosures are real <details> with a
 * button summary; every field has an associated label.
 */
"use client";

import { useMemo } from "react";
import type { SkillCatalog } from "@/lib/capability/capability_types";
import { emptySkillRow, type SkillDraftRow } from "@/components/officer/use_officer_workspace";
import { useT, useLanguage } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export interface SkillsEditorProps {
  catalog: SkillCatalog;
  rows: SkillDraftRow[];
  onChange: (rows: SkillDraftRow[]) => void;
}

export function SkillsEditor({ catalog, rows, onChange }: SkillsEditorProps) {
  const { t } = useT();
  const { language } = useLanguage();
  const name = (th: string, en: string) => (language === "th" ? th : en);

  const bySkillId = useMemo(() => new Map(rows.map((r) => [r.skillId, r])), [rows]);
  const levelOptions = useMemo(
    () => catalog.levels.map((l) => ({ value: String(l.id), label: name(l.nameTh, l.nameEn) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog.levels, language]
  );

  function toggleSkill(skillId: number, checked: boolean) {
    if (checked) {
      const existing = bySkillId.get(skillId);
      if (existing) onChange(rows.map((r) => (r.skillId === skillId ? { ...r, checked: true } : r)));
      else onChange([...rows, emptySkillRow(skillId)]);
    } else {
      // Uncheck: drop the row entirely (replace-all save removes it).
      onChange(rows.filter((r) => r.skillId !== skillId));
    }
  }

  function updateSkill(skillId: number, patch: Partial<SkillDraftRow>) {
    onChange(rows.map((r) => (r.skillId === skillId ? { ...r, ...patch } : r)));
  }

  const selectedCount = rows.filter((r) => r.checked).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t("capability.title")}</CardTitle>
        <span className="text-xs text-muted">
          {selectedCount} {t("capability.skillsSelected")}
        </span>
      </CardHeader>
      <CardBody className="space-y-2">
        {catalog.categories.map((category) => {
          const selectedInCategory = category.skills.filter((s) => bySkillId.get(s.id)?.checked).length;
          return (
            <details key={category.id} className="group rounded-xl border border-border">
              <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground marker:content-none hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span>{name(category.nameTh, category.nameEn)}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {selectedInCategory > 0 ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">{selectedInCategory}</span>
                  ) : null}
                  <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                </span>
              </summary>

              <div className="space-y-3 border-t border-border px-4 py-3">
                {category.skills.map((skill) => {
                  const row = bySkillId.get(skill.id);
                  const checked = Boolean(row?.checked);
                  const inputId = `skill-${skill.id}`;
                  return (
                    <div key={skill.id} className="rounded-lg border border-transparent">
                      <label htmlFor={inputId} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          id={inputId}
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                          checked={checked}
                          onChange={(e) => toggleSkill(skill.id, e.target.checked)}
                        />
                        {name(skill.nameTh, skill.nameEn)}
                      </label>

                      {checked && row ? (
                        <div className="mt-2 space-y-3 rounded-lg bg-neutral-bg/40 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <LabeledField label={t("capability.level")}>
                              <Select
                                options={levelOptions}
                                placeholder={t("capability.selectLevel")}
                                value={row.levelId}
                                onChange={(e) => updateSkill(skill.id, { levelId: e.target.value })}
                                aria-label={t("capability.level")}
                              />
                            </LabeledField>
                            <LabeledField label={t("capability.yearsExperience")}>
                              <input
                                type="number"
                                min="0"
                                max="80"
                                className={inputCls}
                                value={row.yearsExperience}
                                onChange={(e) => updateSkill(skill.id, { yearsExperience: e.target.value })}
                                aria-label={t("capability.yearsExperience")}
                              />
                            </LabeledField>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <LabeledField label={t("capability.certificateNumber")}>
                              <input className={inputCls} value={row.certificateNumber} onChange={(e) => updateSkill(skill.id, { certificateNumber: e.target.value })} aria-label={t("capability.certificateNumber")} />
                            </LabeledField>
                            <LabeledField label={t("capability.issuingOrganization")}>
                              <input className={inputCls} value={row.issuingOrganization} onChange={(e) => updateSkill(skill.id, { issuingOrganization: e.target.value })} aria-label={t("capability.issuingOrganization")} />
                            </LabeledField>
                            <LabeledField label={t("capability.issueDate")}>
                              <input className={inputCls} placeholder={t("capability.datePlaceholder")} value={row.issueDate} onChange={(e) => updateSkill(skill.id, { issueDate: e.target.value })} aria-label={t("capability.issueDate")} />
                            </LabeledField>
                            <LabeledField label={t("capability.expiryDate")}>
                              <input className={inputCls} placeholder={t("capability.datePlaceholder")} value={row.expiryDate} onChange={(e) => updateSkill(skill.id, { expiryDate: e.target.value })} aria-label={t("capability.expiryDate")} />
                            </LabeledField>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                              <input type="checkbox" className="h-4 w-4 rounded border-border text-accent focus:ring-accent" checked={row.verified} onChange={(e) => updateSkill(skill.id, { verified: e.target.checked })} />
                              {t("capability.verified")}
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                              <input type="checkbox" className="h-4 w-4 rounded border-border text-accent focus:ring-accent" checked={row.availableForDeployment} onChange={(e) => updateSkill(skill.id, { availableForDeployment: e.target.checked })} />
                              {t("capability.availableForDeployment")}
                            </label>
                          </div>

                          {row.verified ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <LabeledField label={t("capability.verifiedBy")}>
                                <input className={inputCls} value={row.verifiedBy} onChange={(e) => updateSkill(skill.id, { verifiedBy: e.target.value })} aria-label={t("capability.verifiedBy")} />
                              </LabeledField>
                              <LabeledField label={t("capability.verifiedDate")}>
                                <input className={inputCls} placeholder={t("capability.datePlaceholder")} value={row.verifiedDate} onChange={(e) => updateSkill(skill.id, { verifiedDate: e.target.value })} aria-label={t("capability.verifiedDate")} />
                              </LabeledField>
                            </div>
                          ) : null}

                          <LabeledField label={t("capability.remarks")}>
                            <textarea rows={2} className={`${inputCls} resize-y`} value={row.remarks} onChange={(e) => updateSkill(skill.id, { remarks: e.target.value })} aria-label={t("capability.remarks")} />
                          </LabeledField>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </CardBody>
    </Card>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
