/**
 * OfficerIntelligenceHeader (Phase 44 — Officer Intelligence Workspace,
 * Task 3).
 *
 * The redesigned profile hero: portrait, rank/name, position, unit, and
 * verification badge on the left; a compact KPI summary grid (age, service,
 * retirement year, time in current level, promotion qualification, status)
 * on the right. Every KPI value is read directly from
 * OfficerIntelligenceViewModel — no calculation happens in this component.
 * Replaces the old ad-hoc "Career Years"/"Current Age" HeaderFields
 * (calculateCareerYearsSimple/calculateCurrentAge) that bypassed the
 * Intelligence facades.
 */
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { PROMOTION_STATUS_TONE } from "@/lib/intelligence/promotion/status_tone";
import { isValidTimelineVerificationStatus, VERIFICATION_STATUS_META } from "@/lib/officer_profile/verification_options";
import type { Timeline } from "@/lib/database/query_types";
import { PortraitManager } from "@/components/officer/portrait_manager";
import { PhoneAction } from "@/components/officer/phone_action";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Briefcase, Building2 } from "lucide-react";

const UNAVAILABLE = "ยังไม่มีข้อมูลเพียงพอ";

function KpiCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="wrap-break-word text-sm font-semibold text-foreground">{value ?? <span className="font-normal text-muted">{UNAVAILABLE}</span>}</dd>
    </div>
  );
}

/** Sourced from the officer's current (most recent) timeline row — mirrors the prior ProfileHeader's VerificationBadge exactly (unchanged behavior, just relocated). */
function VerificationBadge({ currentTimelineRow }: { currentTimelineRow: Timeline | null }) {
  const status = currentTimelineRow?.verificationStatus;
  if (!status || !isValidTimelineVerificationStatus(status)) {
    return (
      <Badge tone="neutral">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        ยังไม่ตรวจสอบ / Not Verified
      </Badge>
    );
  }
  const meta = VERIFICATION_STATUS_META[status];
  return (
    <Badge tone={meta.color} className="px-3 py-1 text-sm">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.labelTh} / {meta.labelEn}
    </Badge>
  );
}

export function OfficerIntelligenceHeader({
  viewModel,
  portrait,
  phone,
  currentTimelineRow,
  onPortraitChanged,
}: {
  viewModel: OfficerIntelligenceViewModel;
  /** Full ResolvedOfficerPortrait (not just the URL) — PortraitManager needs source/driveFileId for the upload/replace/history UI, unchanged from before this phase. */
  portrait: ResolvedOfficerPortrait;
  phone: string | null;
  currentTimelineRow: Timeline | null;
  onPortraitChanged?: () => void;
}) {
  const { identity, age, service, retirement, promotion } = viewModel;

  return (
    <header className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="relative shrink-0">
          <PortraitManager
            officerId={identity.officerId}
            name={identity.displayName}
            thumbnailUrl={portrait.thumbnailUrl}
            driveFileId={portrait.driveFileId}
            webViewUrl={portrait.webViewUrl}
            source={portrait.source}
            onChanged={onPortraitChanged}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted">{identity.rank || "—"}</p>
              <h1 title={identity.displayName} className="wrap-break-word text-2xl leading-tight font-semibold text-foreground">
                {identity.displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                {identity.position ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    {identity.position}
                  </span>
                ) : null}
                {identity.unit ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {identity.unit}
                  </span>
                ) : null}
              </div>
            </div>
            <VerificationBadge currentTimelineRow={currentTimelineRow} />
          </div>

          {phone ? (
            <div className="mt-3">
              <PhoneAction phone={phone} />
            </div>
          ) : null}
        </div>
      </div>

      {/* KPI summary grid — Task 3: อายุปัจจุบัน, อายุราชการ, ปีเกษียณอายุราชการ, ดำรงตำแหน่งระดับนี้มา, คุณสมบัติ, สถานะ. */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCell label="อายุปัจจุบัน" value={age.available ? age.displayAgeTh : null} />
        <KpiCell label="อายุราชการ" value={service.available ? service.displayServiceDurationTh : null} />
        <KpiCell label="ปีเกษียณอายุราชการ" value={retirement.available ? `พ.ศ. ${retirement.retirementYearBe}` : null} />
        <KpiCell label="ดำรงตำแหน่งระดับนี้มา" value={service.yearsInCurrentPositionLevel != null ? `${service.yearsInCurrentPositionLevel} ปี` : null} />
        <KpiCell label="คุณสมบัติ" value={promotion.available ? promotion.qualificationTextTh : null} />
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted">สถานะ</dt>
          <dd className="mt-0.5">
            {promotion.available && promotion.displayStatusTh ? (
              <Badge tone={PROMOTION_STATUS_TONE[promotion.status]}>{promotion.displayStatusTh}</Badge>
            ) : (
              <span className="text-sm text-muted">{UNAVAILABLE}</span>
            )}
          </dd>
        </div>
      </dl>
    </header>
  );
}
