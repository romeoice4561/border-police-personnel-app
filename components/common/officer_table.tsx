/**
 * OfficerTable (Phase 14 UI): rank, name, position, unit, phone, career years,
 * quality. Rows link to the officer detail page. Responsive — collapses to a
 * card list on small screens via OfficerCard. Sortable headers are optional
 * (parent-controlled).
 */
"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { OfficerSummary } from "@/lib/ui/api_client";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerCard } from "@/components/common/officer_card";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { cn } from "@/lib/ui/cn";

export interface OfficerTableSort {
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
}

const COLUMNS: Array<{ key: string; label: string; sortable?: boolean; align?: "right" }> = [
  { key: "rank", label: "Rank", sortable: true },
  { key: "lastName", label: "Name", sortable: true },
  { key: "currentPosition", label: "Position" },
  { key: "currentUnit", label: "Unit" },
  { key: "phone", label: "Phone" },
  { key: "careerYears", label: "Years", sortable: true, align: "right" },
  { key: "qualityScore", label: "Quality", sortable: true, align: "right" },
];

export function OfficerTable({ officers, sort }: { officers: OfficerSummary[]; sort?: OfficerTableSort }) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 sm:hidden">
        {officers.map((o) => (
          <OfficerCard key={o.officerId} officer={o} />
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              {COLUMNS.map((col) => {
                const isActive = sort?.sortBy === col.key;
                return (
                  <th key={col.key} scope="col" className={cn("px-4 py-3 font-medium", col.align === "right" && "text-right")}>
                    {col.sortable && sort ? (
                      <button
                        type="button"
                        onClick={() => sort.onSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground",
                          isActive && "text-foreground",
                          col.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {col.label}
                        {isActive ? (
                          sort.sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {officers.map((o) => (
              <tr key={o.officerId} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                <td className="px-4 py-3 text-muted">{o.rank || "—"}</td>
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2.5">
                    <OfficerPhoto
                      thumbnailUrl={o.thumbnailUrl}
                      name={[o.firstName, o.lastName].filter(Boolean).join(" ") || o.officerId}
                      size={32}
                    />
                    <Link href={`/officers/${encodeURIComponent(o.officerId)}`} className="text-accent hover:underline">
                      {[o.firstName, o.lastName].filter(Boolean).join(" ") || o.officerId}
                    </Link>
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{o.currentPosition || "—"}</td>
                <td className="px-4 py-3 text-muted">{o.currentUnit || "—"}</td>
                <td className="px-4 py-3 tabular-nums text-muted">{o.phone || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{o.careerYears}</td>
                <td className="px-4 py-3 text-right">
                  <QualityBadge score={o.qualityScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
