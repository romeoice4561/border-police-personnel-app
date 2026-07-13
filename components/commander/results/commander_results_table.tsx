import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderSortField } from "@/components/commander/query/types";
import { PriorityBadge, PromotionStatusBadge, RetirementStatusBadge } from "@/components/intelligence/intelligence_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

const COLUMNS: Array<{ key: CommanderSortField; label: string; align?: "right" }> = [
  { key: "rank", label: "Rank" },
  { key: "displayName", label: "Name" },
  { key: "currentPosition", label: "Current Position" },
  { key: "positionLevel", label: "Position Level" },
  { key: "yearsInRank", label: "Rank Years", align: "right" },
  { key: "yearsInPosition", label: "Position Years", align: "right" },
  { key: "governmentServiceYears", label: "Service", align: "right" },
  { key: "ageYears", label: "Age", align: "right" },
  { key: "promotionStatus", label: "Promotion" },
  { key: "retirementStatus", label: "Retirement" },
  { key: "priority", label: "Priority" },
];

function fmt(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

export function CommanderResultsTable({
  officers,
  sortBy,
  sortDirection,
  onSort,
}: {
  officers: CommanderQueryOfficer[];
  sortBy: CommanderSortField;
  sortDirection: "asc" | "desc";
  onSort: (field: CommanderSortField) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results Table</CardTitle>
      </CardHeader>
      <CardBody>
        {officers.length === 0 ? (
          <p className="text-sm text-muted">No officers match the current query.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">Portrait</th>
                  {COLUMNS.map((column) => {
                    const active = sortBy === column.key;
                    return (
                      <th key={column.key} className={cn("px-3 py-3 font-medium", column.align === "right" && "text-right")}>
                        <button
                          type="button"
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground", column.align === "right" && "flex-row-reverse")}
                          onClick={() => onSort(column.key)}
                        >
                          {column.label}
                          {active ? sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {officers.map((officer) => (
                  <tr key={officer.officerId} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                    <td className="px-3 py-3">
                      <OfficerPhoto
                        name={officer.displayName}
                        thumbnailUrl={officer.thumbnailUrl}
                        driveFileId={officer.driveFileId}
                        webViewUrl={officer.webViewUrl}
                        size={32}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted">{officer.rank || "—"}</td>
                    <td className="px-3 py-3 font-medium">
                      <Link href={`/officers/${encodeURIComponent(officer.officerId)}`} className="text-accent hover:underline">
                        {officer.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">{officer.currentPosition || "—"}</td>
                    <td className="px-3 py-3 text-muted">{officer.positionLevel || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(officer.yearsInRank)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(officer.yearsInPosition)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(officer.governmentServiceYears)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(officer.ageYears)}</td>
                    <td className="px-3 py-3"><PromotionStatusBadge status={officer.promotionStatus} /></td>
                    <td className="px-3 py-3"><RetirementStatusBadge status={officer.retirementStatus} /></td>
                    <td className="px-3 py-3"><PriorityBadge priority={officer.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
