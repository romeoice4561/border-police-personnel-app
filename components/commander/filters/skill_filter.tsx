/**
 * SkillFilterControl (Phase 44 — Personnel Capability Intelligence).
 *
 * The Commander Search "ความเชี่ยวชาญและศักยภาพ / Skills & Competencies"
 * filter: category → skill, minimum level, verified, has certificate,
 * certificate expiring soon, expert, instructor, deployment-ready, and minimum
 * experience. Pure controlled component over CommanderQueryFilters["skill"] —
 * no matching logic here (that lives in the query center's applyFilters via
 * lib/capability/skill_filter). Skill/category/level NAMES come from the DB
 * catalog rendered in the active language; chrome labels are dictionary keys.
 */
"use client";

import type { SkillCatalog } from "@/lib/capability/capability_types";
import type { SkillFilter } from "@/lib/capability/skill_filter";
import { useT, useLanguage } from "@/components/i18n/language_provider";

const controlClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function SkillFilterControl({
  catalog,
  value,
  onChange,
}: {
  catalog: SkillCatalog;
  value: SkillFilter | undefined;
  onChange: (next: SkillFilter | undefined) => void;
}) {
  const { t } = useT();
  const { language } = useLanguage();
  const name = (th: string, en: string) => (language === "th" ? th : en);
  const filter = value ?? {};

  /** Update one field; if the whole filter becomes empty, clear it (undefined) so the section reads as "off". */
  function set<K extends keyof SkillFilter>(key: K, next: SkillFilter[K]) {
    const merged: SkillFilter = { ...filter, [key]: next };
    const cleaned: SkillFilter = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== false && v !== "" && v != null) (cleaned as Record<string, unknown>)[k] = v;
    }
    onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
  }

  const skillsForCategory = filter.categoryId != null ? catalog.categories.find((c) => c.id === filter.categoryId)?.skills ?? [] : catalog.categories.flatMap((c) => c.skills);

  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted">{t("capability.filterTitle")}</legend>

      <label className="space-y-1 text-xs font-medium text-muted">
        {t("capability.category")}
        <select
          className={controlClass}
          value={filter.categoryId != null ? String(filter.categoryId) : ""}
          onChange={(e) => onChange(cleanup({ ...filter, categoryId: e.target.value ? Number(e.target.value) : undefined, skillId: undefined }))}
        >
          <option value="">{t("capability.allCategories")}</option>
          {catalog.categories.map((c) => (
            <option key={c.id} value={c.id}>{name(c.nameTh, c.nameEn)}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted">
        {t("capability.skill")}
        <select className={controlClass} value={filter.skillId != null ? String(filter.skillId) : ""} onChange={(e) => set("skillId", e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">{t("capability.allSkills")}</option>
          {skillsForCategory.map((s) => (
            <option key={s.id} value={s.id}>{name(s.nameTh, s.nameEn)}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted">
        {t("capability.minLevel")}
        <select className={controlClass} value={filter.minLevelRank != null ? String(filter.minLevelRank) : ""} onChange={(e) => set("minLevelRank", e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">{t("capability.anyLevel")}</option>
          {catalog.levels.map((l) => (
            <option key={l.id} value={l.rank}>{name(l.nameTh, l.nameEn)}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted">
        {t("capability.minYearsExperience")}
        <input
          type="number"
          min="0"
          className={controlClass}
          value={filter.minYearsExperience ?? ""}
          onChange={(e) => set("minYearsExperience", e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </label>

      <div className="grid grid-cols-1 gap-1.5">
        <ToggleRow label={t("capability.verified")} checked={filter.verified === true} onChange={(v) => set("verified", v || undefined)} />
        <ToggleRow label={t("capability.hasCertificate")} checked={filter.hasCertificate === true} onChange={(v) => set("hasCertificate", v || undefined)} />
        <ToggleRow label={t("capability.certificateExpiringSoon")} checked={filter.certificateExpiringSoon === true} onChange={(v) => set("certificateExpiringSoon", v || undefined)} />
        <ToggleRow label={t("capability.expert")} checked={filter.isExpert === true} onChange={(v) => set("isExpert", v || undefined)} />
        <ToggleRow label={t("capability.instructor")} checked={filter.isInstructor === true} onChange={(v) => set("isInstructor", v || undefined)} />
        <ToggleRow label={t("capability.availableForDeployment")} checked={filter.availableForDeployment === true} onChange={(v) => set("availableForDeployment", v || undefined)} />
      </div>
    </fieldset>
  );
}

/** Drops empty/false/undefined keys, returning undefined when nothing remains. */
function cleanup(filter: SkillFilter): SkillFilter | undefined {
  const cleaned: SkillFilter = {};
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== false && v !== "" && v != null) (cleaned as Record<string, unknown>)[k] = v;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
      <input type="checkbox" className="h-4 w-4 rounded border-border text-accent focus:ring-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
