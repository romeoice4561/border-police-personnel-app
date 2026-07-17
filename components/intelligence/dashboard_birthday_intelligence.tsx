/**
 * DashboardBirthdayIntelligence (Phase 42 — Commander Dashboard
 * Intelligence, Task 5).
 *
 * "วันเกิดกำลังพล" — three clickable KPI cards (today / next 7 days / this
 * month) that expand an inline list on click. Every displayed value
 * (turningAge, displayBirthdayTh, displayTurningAgeTh) comes from
 * BirthdayOfficerViewModel, itself built from AgeSummary
 * (lib/intelligence/age) — this component performs no age or date math.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Cake, User } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { BirthdayOfficerViewModel } from "@/lib/commander_dashboard/types";

type BirthdayTab = "today" | "nextSevenDays" | "thisMonth";

function BirthdayRow({ officer }: { officer: BirthdayOfficerViewModel }) {
  return (
    <Link
      href={`/officers/${encodeURIComponent(officer.officerId)}`}
      className="flex items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-neutral-bg"
    >
      {officer.profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar thumbnail.
        <img src={officer.profileImageUrl} alt={officer.displayName} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" loading="lazy" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-neutral-bg text-muted" aria-hidden="true">
          <User className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {officer.rank ? `${officer.rank} ` : ""}
          {officer.displayName}
        </p>
        <p className="truncate text-xs text-muted">{[officer.position, officer.unit].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-accent">{officer.displayTurningAgeTh}</p>
        <p className="text-xs text-muted">{officer.displayBirthdayTh}</p>
      </div>
    </Link>
  );
}

export function DashboardBirthdayIntelligence({ birthdays }: { birthdays: CommanderDashboardViewModel["birthdays"] }) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<BirthdayTab | null>(null);

  const lists: Record<BirthdayTab, BirthdayOfficerViewModel[]> = {
    today: birthdays.today,
    nextSevenDays: birthdays.nextSevenDays,
    thisMonth: birthdays.thisMonth,
  };

  const activeList = activeTab ? lists[activeTab] : [];

  return (
    <section aria-label={t("dashboard.birthdayTitle")} className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.birthdayTitle")}</h2>
      <KpiGrid className="lg:grid-cols-3">
        <KpiCard
          label={t("dashboard.birthdayToday")}
          value={birthdays.todayCount.toLocaleString()}
          icon={<Cake className="h-4 w-4" />}
          tone={birthdays.todayCount > 0 ? "good" : "neutral"}
          onClick={() => setActiveTab((current) => (current === "today" ? null : "today"))}
        />
        <KpiCard
          label={t("dashboard.birthdayNextSevenDays")}
          value={birthdays.nextSevenDaysCount.toLocaleString()}
          icon={<Cake className="h-4 w-4" />}
          onClick={() => setActiveTab((current) => (current === "nextSevenDays" ? null : "nextSevenDays"))}
        />
        <KpiCard
          label={t("dashboard.birthdayThisMonth")}
          value={birthdays.thisMonthCount.toLocaleString()}
          icon={<Cake className="h-4 w-4" />}
          onClick={() => setActiveTab((current) => (current === "thisMonth" ? null : "thisMonth"))}
        />
      </KpiGrid>

      {activeTab ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "today" ? t("dashboard.birthdayToday") : activeTab === "nextSevenDays" ? t("dashboard.birthdayNextSevenDays") : t("dashboard.birthdayThisMonth")}
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {activeList.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("dashboard.birthdayEmpty")}</p>
            ) : (
              <div>
                {activeList.map((officer) => (
                  <BirthdayRow key={officer.officerId} officer={officer} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
