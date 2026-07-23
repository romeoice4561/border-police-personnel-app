"use client";

import type { CommanderBriefViewModel } from "@/lib/commander_reports/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

export function ReportsBriefPanel({ brief }: { brief: CommanderBriefViewModel }) {
  const { language } = useT();
  const kpis = [
    { label: language === "en" ? "Personnel" : "กำลังพลทั้งหมด", value: brief.totalPersonnel },
    { label: language === "en" ? "Ready for promotion" : "ครบคุณสมบัติเลื่อนตำแหน่ง", value: brief.readyForPromotion },
    { label: language === "en" ? "Retiring ≤12 months" : "เกษียณภายใน 12 เดือน", value: brief.retiringWithin12Months },
    { label: language === "en" ? "Expired documents" : "เอกสารหมดอายุ", value: brief.expiredDocuments },
    { label: language === "en" ? "Training missing" : "ขาดการฝึกอบรม", value: brief.missingTraining },
    { label: "Critical Officers", value: brief.criticalOfficers },
    { label: language === "en" ? "AI Ready" : "พร้อม AI", value: brief.aiReady },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "en" ? "Commander Brief" : "สรุปผู้บังคับบัญชา (หนึ่งหน้า)"}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border px-3 py-3">
              <p className="text-xs text-muted">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{kpi.value.toLocaleString("th-TH")}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{language === "en" ? "Summary" : "สรุป"}</h3>
            <ul className="mt-2 space-y-1.5">
              {brief.summaryLinesTh.map((line) => (
                <li key={line} className="text-sm text-foreground/90">• {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{language === "en" ? "Action items" : "รายการที่ต้องดำเนินการ"}</h3>
            <ul className="mt-2 space-y-1.5">
              {brief.actionItemsTh.map((line) => (
                <li key={line} className="text-sm text-foreground/90">• {line}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
