/**
 * Concise operational summary above the KPI strip — ViewModel counts only.
 */
"use client";

import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { SectionShell } from "@/components/commander-workforce/section-shell";

function bullet(text: string): { text: string } {
  return { text };
}

export function buildExecutiveSummaryBullets(viewModel: CommanderWorkforceViewModel): string[] {
  const ready =
    (viewModel.promotion.byStatus.find((s) => s.status === "EligibleThisYear")?.count ?? 0) +
    (viewModel.promotion.byStatus.find((s) => s.status === "AlreadyEligible")?.count ?? 0);
  const urgentActions = viewModel.actionCenter.items.filter(
    (i) => i.severity === "critical" || i.severity === "urgent"
  ).length;
  const retireThisFy =
    viewModel.retirement.buckets.find((b) => b.key === "this_fiscal_year")?.count ?? 0;
  const dq = viewModel.dataQuality.affectedOfficerCount;

  const lines: string[] = [];
  const thisYear =
    viewModel.promotion.byStatus.find((s) => s.status === "EligibleThisYear")?.count ?? 0;
  const prior =
    viewModel.promotion.byStatus.find((s) => s.status === "AlreadyEligible")?.count ?? 0;
  if (ready > 0) {
    lines.push(
      `ผู้มีคุณสมบัติครบทั้งหมด ${ready.toLocaleString("th-TH")} นาย (พร้อมเลื่อนปีนี้ ${thisYear.toLocaleString("th-TH")} · ครบคุณสมบัติก่อนปีนี้ ${prior.toLocaleString("th-TH")})`
    );
  } else {
    lines.push("ยังไม่มีผู้มีคุณสมบัติครบในขอบเขตนี้");
  }

  if (urgentActions > 0) lines.push(`ต้องดำเนินการเร่งด่วน ${urgentActions.toLocaleString("th-TH")} รายการ`);
  else lines.push("ไม่มีรายการเร่งด่วนที่ต้องดำเนินการ");

  if (retireThisFy > 0) lines.push(`เกษียณปีงบประมาณนี้ ${retireThisFy.toLocaleString("th-TH")} นาย`);
  else lines.push("ไม่มีผู้เกษียณปีนี้");

  if (dq > 0) lines.push(`มีข้อมูลที่ต้องตรวจสอบ ${dq.toLocaleString("th-TH")} ราย`);
  else lines.push("ไม่พบช่องว่างข้อมูลที่ต้องติดตาม");

  return lines;
}

export function ExecutiveSummary({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const lines = buildExecutiveSummaryBullets(viewModel).map(bullet);

  return (
    <SectionShell title="สรุปสถานการณ์วันนี้" description="ภาพรวมเชิงปฏิบัติการจากข้อมูลชุดปัจจุบัน">
      <div className="rounded-xl border border-border bg-surface/50 px-4 py-4 sm:px-5 sm:py-5">
        <ul className="space-y-2.5 text-sm leading-relaxed text-foreground">
          {lines.map((item) => (
            <li key={item.text} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
