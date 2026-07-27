"use client";

import Link from "next/link";
import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { MetricCard, type ExecutiveMetricTone } from "@/components/commander-workforce/metric-card";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { promotionLabelTh } from "@/components/commander-workforce/labels";
import { StatusBadge, badgeKindForPromotionStatus } from "@/components/commander-workforce/status-badge";
import { Button } from "@/components/ui/button";

const STATUS_TONE: Record<string, ExecutiveMetricTone> = {
  EligibleThisYear: "good",
  AlreadyEligible: "good",
  Waiting: "neutral",
  MissingTraining: "warning",
  MissingDocuments: "warning",
  RetirementRestricted: "serious",
  NotEligible: "neutral",
  Unknown: "neutral",
};

export function PromotionSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { promotion } = viewModel;
  const total = promotion.totalEvaluated;

  return (
    <SectionShell
      title="ข่าวกรองการเลื่อนตำแหน่ง"
      description={`ประเมินแล้ว ${total.toLocaleString("th-TH")} นาย · พร้อม ${promotion.eligibleTotal.toLocaleString("th-TH")} · ติดขัด ${promotion.blockedTotal.toLocaleString("th-TH")} · ไม่ทราบข้อมูล ${promotion.unknownTotal.toLocaleString("th-TH")}`}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/commander-promotion" aria-label="เปิดศูนย์เลื่อนระดับตำแหน่ง">
            เปิดศูนย์เลื่อนระดับตำแหน่ง
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {promotion.byStatus.map((bucket) => {
          const badgeKind = badgeKindForPromotionStatus(bucket.status);
          return (
            <MetricCard
              key={bucket.status}
              labelTh={promotionLabelTh(bucket.status)}
              count={bucket.count}
              percentage={total > 0 ? Math.round((bucket.count / total) * 1000) / 10 : null}
              availability={{ status: "available" }}
              drilldown={bucket.drilldown}
              tone={STATUS_TONE[bucket.status] ?? "neutral"}
              badge={badgeKind ? <StatusBadge kind={badgeKind} /> : undefined}
            />
          );
        })}
      </div>
    </SectionShell>
  );
}
