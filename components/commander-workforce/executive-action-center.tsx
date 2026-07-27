/**
 * Executive Action Center — Thai labels, semantic badges, padded cards.
 */
"use client";

import type { CommanderWorkforceViewModel, WorkforceActionItem, WorkforceSeverity } from "@/lib/commander_workforce/types";
import { DrilldownLink } from "@/components/commander-workforce/drilldown-link";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { sanitizeExecutiveCopy } from "@/components/commander-workforce/labels";
import { StatusBadge, badgeKindForSeverity } from "@/components/commander-workforce/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

const SEVERITY_TONE: Record<WorkforceSeverity, string> = {
  critical: "border-critical/40 bg-critical/5",
  urgent: "border-warning/40 bg-warning/5",
  attention: "border-accent/30 bg-accent/5",
  info: "border-border bg-surface",
};

const CATEGORY_TH: Record<WorkforceActionItem["category"], string> = {
  promotion: "เลื่อนตำแหน่ง",
  retirement: "เกษียณ",
  training: "หลักสูตร",
  documents: "เอกสาร",
  data_quality: "คุณภาพข้อมูล",
};

function groupItems(items: WorkforceActionItem[]) {
  const urgent = items.filter((i) => i.severity === "critical" || i.severity === "urgent");
  const watch = items.filter((i) => i.severity === "attention");
  const review = items.filter((i) => i.severity === "info");
  return [
    { key: "urgent", title: "ดำเนินการเร่งด่วน", items: urgent },
    { key: "watch", title: "ควรติดตาม", items: watch },
    { key: "review", title: "ตรวจสอบข้อมูล", items: review },
  ] as const;
}

function ActionCard({ item }: { item: WorkforceActionItem }) {
  return (
    <article
      className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:p-5", SEVERITY_TONE[item.severity])}
      aria-label={`${item.titleTh} — ${item.count} ราย`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind={badgeKindForSeverity(item.severity)} />
            <span className="text-xs text-muted">{CATEGORY_TH[item.category]}</span>
          </div>
          <h3 className="text-base font-semibold leading-snug text-foreground">{item.titleTh}</h3>
        </div>
        <p className="text-3xl font-semibold tabular-nums text-foreground">
          {item.count.toLocaleString("th-TH")}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted">{sanitizeExecutiveCopy(item.summaryTh)}</p>
      <p className="text-xs leading-relaxed text-muted">{sanitizeExecutiveCopy(item.explanationTh)}</p>
      <p className="text-xs text-muted">ขอบเขต: {sanitizeExecutiveCopy(item.affectedScopeTh)}</p>
      <div>
        <DrilldownLink drilldown={item.drilldown}>
          <Button type="button" size="sm" variant="outline" aria-label={`ดูกำลังพล: ${item.titleTh}`}>
            ดูกำลังพลที่เกี่ยวข้อง
          </Button>
        </DrilldownLink>
      </div>
    </article>
  );
}

export function ExecutiveActionCenter({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const groups = groupItems(viewModel.actionCenter.items);

  return (
    <SectionShell
      title="ศูนย์ปฏิบัติการผู้บริหาร"
      description="รายการจากสถานะที่มีอยู่ — เพื่อติดตามงาน ไม่ใช่การจัดลำดับบุคคล"
    >
      {viewModel.actionCenter.items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
          ขณะนี้ไม่มีรายการที่ต้องดำเนินการในขอบเขตที่เลือก
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.key} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => (
                    <ActionCard key={item.key} item={item} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </SectionShell>
  );
}
