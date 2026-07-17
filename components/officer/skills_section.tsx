/**
 * SkillsSection (Phase 44 — Personnel Capability Intelligence, read-only).
 *
 * The officer profile's "ความเชี่ยวชาญและศักยภาพ / Professional Skills &
 * Competencies" card in VIEW mode: the officer's recorded skills grouped by
 * category, each with its proficiency level, experience, certificate, and
 * mission-readiness badges. The editable counterpart is SkillsEditor, shown
 * when the workspace is in edit mode. Presentational only — no business logic.
 */
"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import type { OfficerSkillWithRelations } from "@/lib/database/query_types";
import { useT } from "@/components/i18n/language_provider";
import { useLanguage } from "@/components/i18n/language_provider";
import { formatLocalizedDate } from "@/lib/i18n/format_date";
import { toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { Badge } from "@/components/ui/badge";

function nameFor(language: "th" | "en", th: string, en: string): string {
  return language === "th" ? th : en;
}

export function SkillsSection({ skills }: { skills: OfficerSkillWithRelations[] }) {
  const { t } = useT();
  const { language } = useLanguage();

  // Group by category, preserving the load order (already category→skill sorted upstream would be ideal; sort defensively by category name).
  const byCategory = new Map<number, { name: string; rows: OfficerSkillWithRelations[] }>();
  for (const row of skills) {
    const cat = row.skill.category;
    const entry = byCategory.get(cat.id) ?? { name: nameFor(language, cat.nameTh, cat.nameEn), rows: [] };
    entry.rows.push(row);
    byCategory.set(cat.id, entry);
  }
  const groups = [...byCategory.values()];

  return (
    <EditableSectionCard title={t("capability.title")}>
      {skills.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <BadgeCheck className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message={t("capability.noSkills")} />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.name}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{group.name}</p>
              <ul className="space-y-2">
                {group.rows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{nameFor(language, row.skill.nameTh, row.skill.nameEn)}</span>
                      {row.level ? <Badge tone="accent">{nameFor(language, row.level.nameTh, row.level.nameEn)}</Badge> : null}
                      {row.verified ? (
                        <Badge tone="good">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          {t("capability.verified")}
                        </Badge>
                      ) : null}
                      {row.availableForDeployment ? <Badge tone="warning">{t("capability.availableForDeployment")}</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                      {row.yearsExperience != null ? (
                        <span>{t("capability.experience")}: {row.yearsExperience} {t("capability.years")}</span>
                      ) : null}
                      {row.certificateNumber ? (
                        <span>{t("capability.certificateNumber")}: {row.certificateNumber}</span>
                      ) : null}
                      {row.expiryDate ? (
                        <span>{t("capability.expiryDate")}: {formatLocalizedDate({ yearBE: toBuddhistEraYear(row.expiryDate.getUTCFullYear()), month: row.expiryDate.getUTCMonth() + 1, day: row.expiryDate.getUTCDate() }, language)}</span>
                      ) : null}
                    </div>
                    {row.remarks ? <p className="mt-1 text-xs text-muted italic">{row.remarks}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </EditableSectionCard>
  );
}
