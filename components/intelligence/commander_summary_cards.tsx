import { AlertTriangle, Award, FileWarning, GraduationCap, IdCard, ImageOff, ShieldCheck, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import type { CommanderDashboardSummary } from "@/lib/intelligence";

function SummaryTile({ label, value, icon, hint }: { label: string; value: number; icon: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <span className="text-muted" aria-hidden="true">{icon}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function CommanderSummaryCards({ summary }: { summary: CommanderDashboardSummary }) {
  const iconClass = "h-4 w-4";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryTile label="Total Officers" value={summary.totalOfficers} icon={<Users className={iconClass} />} />
      <SummaryTile label="Promotion Ready" value={summary.promotionReady} icon={<Award className={iconClass} />} />
      <SummaryTile label="Near Promotion" value={summary.nearPromotion} icon={<ShieldCheck className={iconClass} />} />
      <SummaryTile label="Retiring Soon" value={summary.retiringSoon} icon={<AlertTriangle className={iconClass} />} />
      <SummaryTile label="Missing Docs" value={summary.missingDocuments} icon={<FileWarning className={iconClass} />} />
      <SummaryTile label="Missing GP7" value={summary.missingGp7} icon={<IdCard className={iconClass} />} />
      <SummaryTile label="Missing Portrait" value={summary.missingPortrait} icon={<ImageOff className={iconClass} />} />
      <SummaryTile label="Missing Training" value={summary.missingTraining} icon={<GraduationCap className={iconClass} />} />
    </div>
  );
}
