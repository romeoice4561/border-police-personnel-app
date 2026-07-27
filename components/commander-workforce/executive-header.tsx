/**
 * Executive header — Thai labels, clear scope / as-of / readiness / actions.
 */
"use client";

import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceHeader } from "@/components/workspace/workspace_header";
import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCompanyLabelTh, formatDivisionLabelTh, formatRegionLabelTh } from "@/components/commander-workforce/labels";

function asOfLabelBe(asOfDate: string): string {
  const [y, m, d] = asOfDate.split("-").map(Number);
  if (!y || !m || !d) return asOfDate;
  const be = y + 543;
  return `ข้อมูล ณ วันที่ ${d}/${m}/${be} พ.ศ.`;
}

function scopeDisplayTh(viewModel: CommanderWorkforceViewModel): string {
  const { scope } = viewModel;
  const parts: string[] = [];
  if (scope.companyPublicCode) {
    parts.push(formatCompanyLabelTh(scope.companyPublicCode));
  } else if (scope.divisionPublicCode) {
    parts.push(formatDivisionLabelTh(scope.divisionPublicCode));
  } else if (scope.regionPublicCode) {
    parts.push(formatRegionLabelTh(scope.regionPublicCode));
  }
  if (parts.length) return parts.join(" · ");
  return scope.labelTh || "กำลังพลทั้งหมดในขอบเขตที่เข้าถึงได้";
}

export function ExecutiveHeader({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const router = useRouter();
  const readiness = viewModel.readiness;
  const total =
    viewModel.overview.metrics.find((m) => m.key === "total_personnel")?.count ??
    viewModel.scope.officerCount;

  const readinessAvailable = readiness.overallAvailability.status === "available";
  const readinessBadge = readinessAvailable ? (
    <Badge tone="accent">ความพร้อม {readiness.overallPercentage ?? "—"}%</Badge>
  ) : (
    <Badge tone="neutral">ความพร้อมยังประเมินไม่ได้</Badge>
  );

  return (
    <header className="space-y-4">
      <WorkspaceHeader
        title="ศูนย์บัญชาการกำลังพล"
        subtitle="ภาพรวมกำลังพลและความพร้อมเพื่อประกอบการสั่งการ"
        breadcrumb={[
          { label: "หน้าหลัก", href: "/dashboard" },
          { label: "ศูนย์บัญชาการกำลังพล" },
        ]}
        statusBadge={readinessBadge}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()} aria-label="รีเฟรชข้อมูล">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              รีเฟรช
            </Button>
            <Button asChild size="sm" variant="accent">
              <Link href="/commander-search" aria-label="เปิดศูนย์ค้นหากำลังพล">
                <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                ค้นหากำลังพล
              </Link>
            </Button>
            <Link
              href="/commander-intelligence/legacy"
              className="text-xs text-muted underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              รุ่นเดิม (อ้างอิง)
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 rounded-xl border border-border bg-surface/60 p-4 sm:grid-cols-3 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">ข้อมูล ณ วันที่</p>
          <p className="mt-1 text-sm font-medium text-foreground">{asOfLabelBe(viewModel.asOfDate)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">ขอบเขตหน่วย</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground" title={scopeDisplayTh(viewModel)}>
            {scopeDisplayTh(viewModel)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">กำลังพลในขอบเขต</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-accent">
            {total.toLocaleString("th-TH")}
            <span className="ml-1 text-sm font-normal text-muted">นาย</span>
          </p>
        </div>
      </div>
    </header>
  );
}
