/**
 * SkillDashboard (Phase 44 — Personnel Capability Intelligence).
 *
 * Commander dashboard capability analytics: coverage/shortage KPI tiles
 * (languages, AI, drone, instructors, medical, legal, IT, PR, deployment-ready,
 * expiring certificates) plus a "top skills" list. Presentational only — reads
 * the precomputed SkillDashboardData; no business logic. Labels via the central
 * dictionary; skill NAMES are the DB's bilingual columns in the active language.
 */
"use client";

import {
  Award,
  BadgeCheck,
  Cpu,
  HeartPulse,
  Languages,
  Megaphone,
  Plane,
  Scale,
  ShieldAlert,
  Sword,
  Users,
} from "lucide-react";
import type { SkillDashboardData } from "@/lib/capability/skill_dashboard";
import { useT, useLanguage } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

function Tile({ label, value, hint, icon }: { label: string; value: number; hint?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <span className="text-muted" aria-hidden="true">{icon}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function SkillDashboard({ data }: { data: SkillDashboardData }) {
  const { t } = useT();
  const { language } = useLanguage();
  const iconClass = "h-4 w-4";
  const peopleHint = t("capability.peopleUnit");
  const coverage = data.totalOfficers > 0 ? Math.round((data.officersWithSkills / data.totalOfficers) * 100) : 0;

  return (
    <section className="space-y-3" aria-label={t("capability.dashboardTitle")}>
      <h2 className="text-base font-semibold text-foreground">{t("capability.dashboardTitle")}</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("capability.skillCoverage")} value={coverage} hint={`${data.officersWithSkills.toLocaleString()} / ${data.totalOfficers.toLocaleString()}`} icon={<BadgeCheck className={iconClass} />} />
        <Tile label={t("capability.deploymentReady")} value={data.deploymentReady} hint={peopleHint} icon={<Users className={iconClass} />} />
        <Tile label={t("capability.certsExpiring")} value={data.certificatesExpiringSoon} hint={peopleHint} icon={<ShieldAlert className={iconClass} />} />
        <Tile label={t("capability.allInstructors")} value={data.instructors} hint={peopleHint} icon={<Award className={iconClass} />} />
        <Tile label={t("capability.languageSpeakers")} value={data.languageSpeakers} hint={peopleHint} icon={<Languages className={iconClass} />} />
        <Tile label={t("capability.aiExperts")} value={data.aiExperts} hint={peopleHint} icon={<Cpu className={iconClass} />} />
        <Tile label={t("capability.droneExperts")} value={data.droneExperts} hint={peopleHint} icon={<Plane className={iconClass} />} />
        <Tile label={t("capability.medicalStaff")} value={data.medicalStaff} hint={peopleHint} icon={<HeartPulse className={iconClass} />} />
        <Tile label={t("capability.legalStaff")} value={data.legalStaff} hint={peopleHint} icon={<Scale className={iconClass} />} />
        <Tile label={t("capability.itStaff")} value={data.itStaff} hint={peopleHint} icon={<Cpu className={iconClass} />} />
        <Tile label={t("capability.prStaff")} value={data.prStaff} hint={peopleHint} icon={<Megaphone className={iconClass} />} />
        <Tile label={t("capability.officersWithSkills")} value={data.officersWithSkills} hint={peopleHint} icon={<Sword className={iconClass} />} />
      </div>

      {data.topSkills.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("capability.topSkills")}</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1.5">
              {data.topSkills.map((s) => (
                <li key={s.skillId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{language === "th" ? s.nameTh : s.nameEn}</span>
                  <span className="tabular-nums text-muted">{s.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
