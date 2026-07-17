/**
 * OfficerPromotionIntelligenceCard (Phase 44 — Officer Intelligence
 * Workspace, Task 4).
 *
 * The one primary Promotion Intelligence presentation on the profile page —
 * replaces the legacy PromotionCycleSection (lib/promotion_cycle/*, a
 * separate/older display system with its own English-mixed labels and
 * "เกินกำหนด" cycle semantics distinct from Phase 41's PromotionSummary).
 * Every value is read directly from OfficerIntelligenceViewModel.promotion —
 * no calculation happens here. Never shows Priority Score or algorithm
 * internals (task rule) and never implies automatic appointment
 * entitlement (explicit disclaimer note at the bottom).
 */
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { PROMOTION_STATUS_TONE } from "@/lib/intelligence/promotion/status_tone";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const UNAVAILABLE = "ยังไม่มีข้อมูลเพียงพอ";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value ?? <span className="font-normal text-muted">{UNAVAILABLE}</span>}</dd>
    </div>
  );
}

export function OfficerPromotionIntelligenceCard({ viewModel }: { viewModel: OfficerIntelligenceViewModel }) {
  const { identity, promotion } = viewModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotion Intelligence / การวิเคราะห์การเลื่อนตำแหน่ง</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {!promotion.available ? (
          <p className="text-sm text-muted">{UNAVAILABLE}</p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ตำแหน่งปัจจุบัน" value={identity.position} />
              <Field label="ระดับตำแหน่งปัจจุบัน" value={identity.positionLevel} />
              <Field
                label="ดำรงตำแหน่งระดับนี้มาตั้งแต่ปี"
                value={viewModel.service.currentPositionLevelStartYearBe != null ? `พ.ศ. ${viewModel.service.currentPositionLevelStartYearBe}` : null}
              />
              <Field
                label="ดำรงตำแหน่งระดับนี้มา"
                value={promotion.yearsInCurrentLevel != null ? `${promotion.yearsInCurrentLevel} ปี` : null}
              />
              <Field label="คุณสมบัติ" value={promotion.qualificationTextTh} />
              <Field label="ปีที่ครบครั้งแรก" value={promotion.firstEligibleYearBe != null ? `พ.ศ. ${promotion.firstEligibleYearBe}` : null} />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">สถานะ</dt>
                <dd className="mt-0.5">
                  {promotion.displayStatusTh ? (
                    <Badge tone={PROMOTION_STATUS_TONE[promotion.status]}>{promotion.displayStatusTh}</Badge>
                  ) : (
                    <span className="text-sm text-muted">{UNAVAILABLE}</span>
                  )}
                </dd>
              </div>
              <Field label="รอการแต่งตั้งมาแล้ว" value={promotion.waitingYears != null ? `${promotion.waitingYears} ปี` : null} />
              <Field label="ปีนี้เป็นปีที่" value={promotion.eligibilityYearNumber} />
            </dl>

            {promotion.blockers.length > 0 ? (
              <div className="rounded-lg border border-serious/30 bg-serious/5 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-serious">ข้อขัดข้องหรือเงื่อนไขที่ยังขาด</p>
                <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                  {promotion.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <p className="border-t border-border pt-3 text-xs text-muted">
          ข้อมูลนี้ใช้สนับสนุนการพิจารณา ไม่ใช่คำสั่งแต่งตั้งอัตโนมัติ
        </p>
      </CardBody>
    </Card>
  );
}
