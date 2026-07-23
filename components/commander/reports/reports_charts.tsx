"use client";

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { CommanderQueryCharts } from "@/components/commander/charts/commander_query_charts";
import { CommanderTimelineCharts } from "@/components/commander/charts/commander_timeline_charts";
import { useT } from "@/components/i18n/language_provider";

/**
 * Reuses existing Commander chart components — no duplicate visualization logic.
 * Drilldown is a no-op in the report center (presentation surface).
 */
export function ReportsCharts({ officers }: { officers: CommanderQueryOfficer[] }) {
  const { language } = useT();
  if (officers.length === 0) {
    return (
      <p className="text-sm text-muted print:hidden">
        {language === "en" ? "No chart data for the current scope." : "ไม่มีข้อมูลแผนภูมิในขอบเขตปัจจุบัน"}
      </p>
    );
  }

  return (
    <div className="space-y-4 print:break-inside-avoid">
      <CommanderQueryCharts officers={officers} onDrilldown={() => undefined} />
      <CommanderTimelineCharts officers={officers} onDrilldown={() => undefined} />
    </div>
  );
}
