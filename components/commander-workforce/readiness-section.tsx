/**
 * Workforce readiness — ViewModel formula only. Operational indicator.
 */
"use client";

import { useState } from "react";
import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { AvailabilityState } from "@/components/commander-workforce/availability-state";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { sanitizeExecutiveCopy } from "@/components/commander-workforce/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

const SOURCE_SECTION_TH: Record<string, string> = {
  promotion: "การเลื่อนตำแหน่ง",
  retirement: "การเกษียณ",
  training: "หลักสูตร",
  documents: "เอกสาร",
  dataQuality: "คุณภาพข้อมูล",
  data_quality: "คุณภาพข้อมูล",
};

export function ReadinessSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { readiness } = viewModel;
  const [open, setOpen] = useState(false);

  return (
    <SectionShell
      title="ความพร้อมกำลังพล"
      description="ตัวชี้วัดความพร้อมเชิงปฏิบัติการ — ไม่ใช่คะแนนตัดสินใจแต่งตั้งหรือเลื่อนตำแหน่ง"
    >
      <div className="rounded-xl border border-border bg-surface/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">ความพร้อมโดยรวม</p>
            {readiness.overallAvailability.status === "unavailable" ? (
              <div className="mt-1 space-y-1">
                <p className="text-4xl font-semibold text-muted">—</p>
                <AvailabilityState availability={readiness.overallAvailability} />
              </div>
            ) : (
              <p className="text-4xl font-semibold tabular-nums text-accent">
                {readiness.overallPercentage ?? "—"}%
              </p>
            )}
            {readiness.confidencePercentage != null ? (
              <p className="mt-1 text-xs text-muted">
                ความสมบูรณ์ของการประเมิน {readiness.confidencePercentage}%
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="readiness-formula"
          >
            {open ? "ซ่อนวิธีคำนวณ" : "วิธีคำนวณ"}
          </Button>
        </div>

        {open ? (
          <div
            id="readiness-formula"
            className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-4 text-sm text-muted"
          >
            <p className="font-medium text-foreground">{sanitizeExecutiveCopy(readiness.formulaTh)}</p>
            <ul className="list-disc space-y-1.5 pl-5">
              {readiness.breakdownTh.map((line) => (
                <li key={line}>{sanitizeExecutiveCopy(line)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readiness.dimensions.map((dim) => (
            <div
              key={dim.key}
              className={cn(
                "rounded-xl border border-border bg-surface p-4",
                dim.status === "unavailable" && "opacity-80"
              )}
            >
              <p className="text-xs text-muted">{dim.labelTh}</p>
              {dim.status === "unavailable" || dim.availability.status === "unavailable" ? (
                <div className="mt-2 space-y-1">
                  <p className="text-3xl font-semibold text-muted">—</p>
                  <AvailabilityState availability={dim.availability} />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                    {dim.percentage ?? "—"}%
                  </p>
                  <p className="text-xs text-muted">
                    {dim.numerator ?? "—"} / {dim.denominator ?? "—"}
                  </p>
                </>
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {sanitizeExecutiveCopy(dim.explanationTh)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                แหล่งข้อมูล: {SOURCE_SECTION_TH[dim.sourceSection] ?? dim.sourceSection}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
