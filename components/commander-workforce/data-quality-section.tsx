"use client";

import type { CommanderWorkforceViewModel, WorkforceSeverity } from "@/lib/commander_workforce/types";
import { DrilldownLink } from "@/components/commander-workforce/drilldown-link";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { StatusBadge, badgeKindForSeverity } from "@/components/commander-workforce/status-badge";
import { Button } from "@/components/ui/button";

const SEVERITY_TH: Record<WorkforceSeverity, string> = {
  critical: "วิกฤต",
  urgent: "เร่งด่วน",
  attention: "ควรติดตาม",
  info: "ข้อมูล",
};

export function DataQualitySection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { dataQuality } = viewModel;

  return (
    <SectionShell
      title="คุณภาพข้อมูล"
      description={`กำลังพลที่ได้รับผลกระทบ ${dataQuality.affectedOfficerCount.toLocaleString("th-TH")} นาย${
        dataQuality.percentage != null ? ` (${dataQuality.percentage}%)` : ""
      }`}
    >
      {dataQuality.categories.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
          ไม่พบช่องว่างข้อมูลที่ต้องติดตามในขอบเขตปัจจุบัน
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-surface/80 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">รายการ</th>
                <th className="px-4 py-3 font-medium">จำนวน</th>
                <th className="px-4 py-3 font-medium">ร้อยละ</th>
                <th className="px-4 py-3 font-medium">ระดับ</th>
                <th className="px-4 py-3 font-medium">แนวทางแก้ไข</th>
                <th className="px-4 py-3 font-medium">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {dataQuality.categories.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{row.labelTh}</td>
                  <td className="px-4 py-3 text-lg font-semibold tabular-nums text-foreground">
                    {row.count.toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {row.percentage != null ? `${row.percentage}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind={badgeKindForSeverity(row.severity)} />
                      <span className="text-xs text-muted">{SEVERITY_TH[row.severity]}</span>
                    </div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-muted">{row.remediationTh}</td>
                  <td className="px-4 py-3">
                    <DrilldownLink drilldown={row.drilldown}>
                      <Button type="button" size="sm" variant="outline" aria-label={`ดูรายการ: ${row.labelTh}`}>
                        ดูรายการ
                      </Button>
                    </DrilldownLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}
