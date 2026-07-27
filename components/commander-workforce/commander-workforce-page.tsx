/**
 * Commander Workforce Intelligence workspace shell (Phase 52.2 + 52.2.1 polish).
 */
"use client";

import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { ExecutiveHeader } from "@/components/commander-workforce/executive-header";
import { WorkforceFilterBar } from "@/components/commander-workforce/workforce-filter-bar";
import { ExecutiveSummary } from "@/components/commander-workforce/executive-summary";
import { WorkforceKpiStrip } from "@/components/commander-workforce/workforce-kpi-strip";
import { ExecutiveActionCenter } from "@/components/commander-workforce/executive-action-center";
import { PromotionSection } from "@/components/commander-workforce/promotion-section";
import { RetirementSection } from "@/components/commander-workforce/retirement-section";
import { TrainingSection } from "@/components/commander-workforce/training-section";
import { DocumentSection } from "@/components/commander-workforce/document-section";
import { ReadinessSection } from "@/components/commander-workforce/readiness-section";
import { DataQualitySection } from "@/components/commander-workforce/data-quality-section";
import { PersonnelOverviewSection } from "@/components/commander-workforce/personnel-overview-section";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { DrilldownLink } from "@/components/commander-workforce/drilldown-link";
import { sanitizeExecutiveCopy } from "@/components/commander-workforce/labels";
import { Button } from "@/components/ui/button";

export function CommanderWorkforcePage({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const empty = viewModel.metadata.filteredOfficerCount === 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      <ExecutiveHeader viewModel={viewModel} />
      <WorkforceFilterBar viewModel={viewModel} />

      {empty ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
          <p className="text-base font-medium text-foreground">ยังไม่พบกำลังพลในขอบเขตที่เลือก</p>
          <p className="mt-2 text-sm text-muted">
            ลองล้างตัวกรอง หรือเปิดศูนย์ค้นหากำลังพลเพื่อตรวจรายชื่อโดยตรง
          </p>
        </div>
      ) : null}

      <ExecutiveSummary viewModel={viewModel} />
      <WorkforceKpiStrip viewModel={viewModel} />
      <ExecutiveActionCenter viewModel={viewModel} />
      <PromotionSection viewModel={viewModel} />
      <RetirementSection viewModel={viewModel} />
      <TrainingSection viewModel={viewModel} />
      <DocumentSection viewModel={viewModel} />
      <ReadinessSection viewModel={viewModel} />
      <DataQualitySection viewModel={viewModel} />
      <PersonnelOverviewSection viewModel={viewModel} />

      <SectionShell title="ทางลัดเจาะลึกรายการ" description="เปิดรายการที่เกี่ยวข้องตามสถานะที่เลือก">
        <div className="flex flex-wrap gap-2">
          {viewModel.drilldowns.slice(0, 24).map((dd) => {
            const label = sanitizeExecutiveCopy(dd.label) || "เปิดรายการ";
            return (
              <DrilldownLink key={dd.id} drilldown={dd}>
                <Button type="button" size="sm" variant="outline" aria-label={`เจาะลึก: ${label}`}>
                  {label}
                </Button>
              </DrilldownLink>
            );
          })}
          {viewModel.drilldowns.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีทางลัดในขอบเขตนี้</p>
          ) : null}
        </div>
      </SectionShell>
    </div>
  );
}
