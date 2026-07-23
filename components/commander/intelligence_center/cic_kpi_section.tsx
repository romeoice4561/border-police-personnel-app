/**
 * CicKpiSection (Phase 49B — Commander Intelligence Center).
 *
 * Renders the ten executive KPI cards from an already-computed
 * CommanderIntelligenceCenterViewModel — every value/href here was built by
 * lib/commander_intelligence_center/build_view_model.ts from existing
 * engines; this component only formats and links. Every KPI is clickable
 * (opens Commander Search, already filtered) unless `href` is null, which
 * only happens when there is genuinely nothing to filter on (e.g. no
 * training policy configured yet) — never a fake/dead link.
 */
"use client";

import Link from "next/link";
import { Users, Award, AlertTriangle, Clock, FileWarning, GraduationCap, UserX, FileX, ShieldAlert, Sparkles } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderKpiCardViewModel, CommanderKpiId } from "@/lib/commander_intelligence_center/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const KPI_LABEL_KEY: Record<CommanderKpiId, TranslationKey> = {
  personnel: "cic.kpi.personnel",
  readyForPromotion: "cic.kpi.readyForPromotion",
  promotionOverdue: "cic.kpi.promotionOverdue",
  retiringWithin12Months: "cic.kpi.retiringWithin12Months",
  documentsMissing: "cic.kpi.documentsMissing",
  trainingMissing: "cic.kpi.trainingMissing",
  profileIncomplete: "cic.kpi.profileIncomplete",
  expiredDocuments: "cic.kpi.expiredDocuments",
  criticalOfficers: "cic.kpi.criticalOfficers",
  aiReady: "cic.kpi.aiReady",
};

const KPI_ICON: Record<CommanderKpiId, typeof Users> = {
  personnel: Users,
  readyForPromotion: Award,
  promotionOverdue: Clock,
  retiringWithin12Months: AlertTriangle,
  documentsMissing: FileWarning,
  trainingMissing: GraduationCap,
  profileIncomplete: UserX,
  expiredDocuments: FileX,
  criticalOfficers: ShieldAlert,
  aiReady: Sparkles,
};

const WARNING_WHEN_POSITIVE: readonly CommanderKpiId[] = [
  "promotionOverdue",
  "retiringWithin12Months",
  "documentsMissing",
  "trainingMissing",
  "profileIncomplete",
  "expiredDocuments",
];

function KpiTile({ kpi }: { kpi: CommanderKpiCardViewModel }) {
  const { t } = useT();
  const Icon = KPI_ICON[kpi.id];
  const tone = kpi.id === "criticalOfficers" && kpi.value > 0 ? "critical" : WARNING_WHEN_POSITIVE.includes(kpi.id) && kpi.value > 0 ? "warning" : "neutral";
  const hint = kpi.id === "trainingMissing" && kpi.href === null ? t("cic.kpi.trainingMissingNoPolicy") : undefined;

  const card = (
    <KpiCard
      label={t(KPI_LABEL_KEY[kpi.id])}
      value={kpi.value.toLocaleString()}
      tone={tone}
      hint={hint}
      icon={<Icon className="h-4 w-4" />}
    />
  );

  if (!kpi.href) return card;
  return (
    <Link href={kpi.href} aria-label={t(KPI_LABEL_KEY[kpi.id])}>
      {card}
    </Link>
  );
}

export function CicKpiSection({ kpis }: { kpis: CommanderKpiCardViewModel[] }) {
  return (
    <KpiGrid className="lg:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.id} kpi={kpi} />
      ))}
    </KpiGrid>
  );
}
