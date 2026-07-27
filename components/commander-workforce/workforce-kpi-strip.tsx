/**
 * Executive KPI strip — qualifiedNow aggregate + distinct year buckets (52.2.2).
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { MetricCard, type ExecutiveMetricTone } from "@/components/commander-workforce/metric-card";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { StatusBadge } from "@/components/commander-workforce/status-badge";
import { UI_QUALIFIED_NOW_LABEL_TH } from "@/components/commander-workforce/labels";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";

type StripItem = {
  key: string;
  labelTh: string;
  count: number;
  percentage: number | null;
  availability: CommanderWorkforceViewModel["overview"]["metrics"][number]["availability"];
  drilldown: CommanderWorkforceViewModel["overview"]["metrics"][number]["drilldown"];
  tone: ExecutiveMetricTone;
  badge?: ReactNode;
  descriptionTh?: string;
};

function buildStrip(vm: CommanderWorkforceViewModel): StripItem[] {
  const total = vm.overview.metrics.find((m) => m.key === "total_personnel");
  const eligibleThisYear = vm.promotion.byStatus.find((s) => s.status === "EligibleThisYear");
  const already = vm.promotion.byStatus.find((s) => s.status === "AlreadyEligible");
  const restricted = vm.promotion.byStatus.find((s) => s.status === "RetirementRestricted");
  const retireFy = vm.retirement.buckets.find((b) => b.key === "this_fiscal_year");
  const missingTraining = vm.training.byStatus.find((m) => m.key === "training:MissingRequired");
  const expiredDocs = vm.documents.byStatus.find((m) => m.key === "documents:expired");
  const incompleteDocs = vm.documents.byStatus.find((m) => m.key === "documents:incomplete");
  const missingDocs = vm.documents.byStatus.find((m) => m.key === "documents:missing_required");
  const docCount =
    (expiredDocs?.count ?? 0) + (incompleteDocs?.count ?? 0) + (missingDocs?.count ?? 0);

  const thisYearCount = eligibleThisYear?.count ?? 0;
  const priorYearCount = already?.count ?? 0;
  const qualifiedNow = thisYearCount + priorYearCount;

  const items: StripItem[] = [];
  if (total) {
    items.push({
      key: "total",
      labelTh: "กำลังพลทั้งหมด",
      count: total.count,
      percentage: total.percentage,
      availability: total.availability,
      drilldown: total.drilldown,
      tone: "overview",
    });
  }

  items.push({
    key: "qualified_now",
    labelTh: UI_QUALIFIED_NOW_LABEL_TH,
    count: qualifiedNow,
    percentage: null,
    availability: { status: "available" },
    drilldown: buildWorkforceDrilldown({
      id: "promotion:qualifiedNow",
      label: UI_QUALIFIED_NOW_LABEL_TH,
      target: "commander-promotion",
      filters: { bucket: "qualifiedNow" },
    }),
    tone: qualifiedNow > 0 ? "good" : "neutral",
    badge: qualifiedNow > 0 ? <StatusBadge kind="ready" /> : undefined,
    descriptionTh: `พร้อมเลื่อนปีนี้ ${thisYearCount.toLocaleString("th-TH")} · ครบคุณสมบัติก่อนปีนี้ ${priorYearCount.toLocaleString("th-TH")}`,
  });

  if (eligibleThisYear) {
    items.push({
      key: "eligible_year",
      labelTh: "พร้อมเลื่อนปีนี้",
      count: eligibleThisYear.count,
      percentage:
        vm.promotion.totalEvaluated > 0
          ? Math.round((eligibleThisYear.count / vm.promotion.totalEvaluated) * 1000) / 10
          : null,
      availability: { status: "available" },
      drilldown: eligibleThisYear.drilldown,
      tone: eligibleThisYear.count > 0 ? "good" : "neutral",
      badge: eligibleThisYear.count > 0 ? <StatusBadge kind="ready" /> : undefined,
      descriptionTh: "ครบคุณสมบัติครั้งแรกในปีนี้",
    });
  }
  if (already) {
    items.push({
      key: "already",
      labelTh: "ครบคุณสมบัติก่อนปีนี้",
      count: already.count,
      percentage: null,
      availability: { status: "available" },
      drilldown: already.drilldown,
      tone: already.count > 0 ? "warning" : "neutral",
      badge: already.count > 0 ? <StatusBadge kind="attention" /> : undefined,
      descriptionTh: "ครบมาก่อนปีนี้ และยังไม่ได้รับการแต่งตั้ง",
    });
  }
  if (restricted) {
    items.push({
      key: "restricted",
      labelTh: "จำกัดจากการเกษียณ",
      count: restricted.count,
      percentage: null,
      availability: { status: "available" },
      drilldown: restricted.drilldown,
      tone: restricted.count > 0 ? "warning" : "neutral",
    });
  }
  if (retireFy) {
    items.push({
      key: "retire_fy",
      labelTh: "เกษียณปีนี้",
      count: retireFy.count,
      percentage: null,
      availability: { status: "available" },
      drilldown: retireFy.drilldown,
      tone: retireFy.count > 0 ? "warning" : "neutral",
    });
  }
  if (missingTraining) {
    items.push({
      key: "training_missing",
      labelTh: "ขาดหลักสูตร",
      count: missingTraining.count,
      percentage: missingTraining.percentage,
      availability: missingTraining.availability,
      drilldown: missingTraining.drilldown,
      tone: missingTraining.count > 0 ? "warning" : "neutral",
    });
  }
  items.push({
    key: "docs_issue",
    labelTh: "เอกสารไม่ครบ/หมดอายุ",
    count: docCount,
    percentage: null,
    availability: { status: "available" },
    drilldown: expiredDocs?.drilldown ?? incompleteDocs?.drilldown ?? missingDocs?.drilldown ?? null,
    tone: docCount > 0 ? "serious" : "neutral",
    badge: docCount > 0 ? <StatusBadge kind="review" /> : undefined,
  });
  items.push({
    key: "dq",
    labelTh: "ข้อมูลต้องตรวจสอบ",
    count: vm.dataQuality.affectedOfficerCount,
    percentage: vm.dataQuality.percentage,
    availability: { status: "available" },
    drilldown: vm.dataQuality.categories[0]?.drilldown ?? null,
    tone: vm.dataQuality.affectedOfficerCount > 0 ? "critical" : "neutral",
    badge: vm.dataQuality.affectedOfficerCount > 0 ? <StatusBadge kind="review" /> : undefined,
  });
  return items;
}

export function WorkforceKpiStrip({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const items = buildStrip(viewModel);
  const thisYear = viewModel.promotion.byStatus.find((s) => s.status === "EligibleThisYear")?.count ?? 0;
  const prior = viewModel.promotion.byStatus.find((s) => s.status === "AlreadyEligible")?.count ?? 0;
  const qualified = thisYear + prior;

  return (
    <SectionShell
      title="ตัวชี้วัดผู้บริหาร"
      description="ตัวเลขจากชุดข้อมูลปัจจุบัน — กดการ์ดเพื่อเจาะลึกรายการ"
      actions={
        <Link
          href="/commander-promotion?bucket=qualifiedNow"
          className="text-xs font-medium text-accent underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {UI_QUALIFIED_NOW_LABEL_TH} {qualified.toLocaleString("th-TH")} นาย
        </Link>
      }
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.key} className="min-w-[11rem] flex-1 md:min-w-0">
            <MetricCard
              labelTh={item.labelTh}
              count={item.count}
              percentage={item.percentage}
              availability={item.availability}
              drilldown={item.drilldown}
              tone={item.tone}
              badge={item.badge}
              descriptionTh={item.descriptionTh}
            />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
