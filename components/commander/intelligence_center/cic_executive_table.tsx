/**
 * CicExecutiveTable (Phase 49B — Commander Intelligence Center).
 *
 * One master table: Photo / Rank / Name / Unit / Position / Promotion /
 * Retirement / Readiness / Missing Docs / Training / Priority / Next
 * Action. Every cell is a field already computed by build_view_model.ts
 * from existing engines (promotionIntelligence, documentIntelligence,
 * trainingIntelligence, OfficerIntelligenceCard.priority) — no new
 * calculation happens in this component. Every row opens the officer's
 * profile (desktop-first, sticky header per the enterprise-government
 * style already used elsewhere in Commander Search).
 */
"use client";

import Link from "next/link";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { ExecutiveTableRow, PriorityBucketKey } from "@/lib/commander_intelligence_center/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const PRIORITY_LABEL_KEY: Record<PriorityBucketKey, TranslationKey> = {
  critical: "cic.priority.critical",
  high: "cic.priority.high",
  medium: "cic.priority.medium",
  low: "cic.priority.low",
};

const PRIORITY_TONE: Record<PriorityBucketKey, "critical" | "warning" | "accent" | "default"> = {
  critical: "critical",
  high: "warning",
  medium: "accent",
  low: "default",
};

const READINESS_TONE: Record<string, "good" | "warning" | "serious" | "neutral"> = {
  READY: "good",
  NEEDS_REVIEW: "warning",
  INCOMPLETE: "warning",
  BLOCKED: "serious",
  UNKNOWN: "neutral",
};

function TableRow({ row }: { row: ExecutiveTableRow }) {
  const { t } = useT();
  const readinessTone = READINESS_TONE[row.readinessLevel] ?? "neutral";
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-neutral-bg">
      <td className="whitespace-nowrap px-3 py-2.5">
        <Link href={row.href} className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`${t("cic.table.viewProfile")} ${row.displayName}`}>
          <OfficerPhoto thumbnailUrl={row.officialPortraitUrl} name={row.displayName} size={32} />
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate text-sm font-medium text-foreground">
              {row.rank ? `${row.rank} ` : ""}
              {row.displayName}
            </span>
          </span>
        </Link>
      </td>
      <td className="min-w-[140px] max-w-[220px] px-3 py-2.5 text-sm wrap-break-word text-foreground">{row.currentUnit ?? "—"}</td>
      <td className="min-w-[160px] max-w-[260px] px-3 py-2.5 text-sm wrap-break-word text-foreground">{row.currentPosition ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">{row.displayPromotionStatusTh || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">{row.retirementYearBe != null ? `พ.ศ. ${row.retirementYearBe}` : "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Badge tone={readinessTone}>{row.readinessLevel}</Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">{row.missingDocumentsCount > 0 ? row.missingDocumentsCount : "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">{row.trainingStatusTh || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Badge tone={PRIORITY_TONE[row.priority]}>{t(PRIORITY_LABEL_KEY[row.priority])}</Badge>
      </td>
      <td className="max-w-[240px] px-3 py-2.5 text-sm wrap-break-word text-foreground">{row.nextActionTh}</td>
    </tr>
  );
}

export function CicExecutiveTable({ rows }: { rows: ExecutiveTableRow[] }) {
  const { t } = useT();

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle>{t("cic.table.title")}</CardTitle>
      </CardHeader>
      <CardBody className="min-w-0 p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("cic.table.empty")}</p>
        ) : (
          <div className="max-h-[720px] min-w-0 max-w-full overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className={cn("px-3 py-2.5")}>{t("cic.table.officer")}</th>
                  <th className="min-w-[140px] px-3 py-2.5">{t("cic.table.unit")}</th>
                  <th className="min-w-[160px] px-3 py-2.5">{t("cic.table.currentPosition")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.promotionStatus")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.retirement")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.readiness")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.missingDocs")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.training")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.priority")}</th>
                  <th className="px-3 py-2.5">{t("cic.table.nextAction")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TableRow key={row.officerId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
