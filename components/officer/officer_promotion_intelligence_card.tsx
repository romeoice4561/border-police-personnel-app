/**
 * OfficerPromotionIntelligenceCard (Phase 44 / 49.7 / 49.8 / 49.10).
 *
 * Every value is read directly from OfficerIntelligenceViewModel.promotion —
 * no promotion arithmetic happens here. Disclaimer retained at the bottom.
 */
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { PROMOTION_STATUS_TONE } from "@/lib/intelligence/promotion/status_tone";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const UNAVAILABLE = "ยังไม่มีข้อมูลเพียงพอ";
const NOT_ASSESSABLE_FALLBACK_REASON = "ไม่พบข้อมูลที่จำเป็นสำหรับการประเมิน";

const CONFIDENCE_LABEL_TH: Record<OfficerIntelligenceViewModel["promotion"]["confidence"], string> = {
  confirmed: "ยืนยันจากข้อมูลโครงสร้าง",
  derived: "ประเมินจากข้อมูลโดยประมาณ",
  incomplete: "ข้อมูลไม่ครบถ้วน",
  unknown: "ไม่สามารถประเมินได้",
};

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

  const isUnknown = !promotion.available || promotion.status === "Unknown";
  const isAlreadyEligible = promotion.status === "EligibleThisYear" || promotion.status === "AlreadyEligible";
  const reasonTh = promotion.displayReasonTh ?? promotion.waitingReasonTh ?? promotion.confidenceReasonTh;

  return (
    <Card>
      <CardHeader>
        <CardTitle>คุณสมบัติการเลื่อนระดับ</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {isUnknown ? (
          <div className="space-y-1">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">สถานะ</dt>
              <dd className="mt-0.5">
                <Badge tone="neutral">{promotion.displayStatusTh ?? UNAVAILABLE}</Badge>
              </dd>
            </div>
            <p className="text-sm text-muted">เหตุผล: {promotion.confidenceReasonTh ?? NOT_ASSESSABLE_FALLBACK_REASON}</p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ระดับตำแหน่งปัจจุบัน" value={identity.positionLevel} />
              <Field label="เป้าหมาย" value={promotion.targetPositionTh} />
              <Field
                label="เริ่มดำรงระดับนี้"
                value={viewModel.service.currentPositionLevelStartYearBe != null ? `พ.ศ. ${viewModel.service.currentPositionLevelStartYearBe}` : null}
              />
              <Field
                label="ดำรงระดับมาแล้ว"
                value={promotion.yearsInCurrentLevel != null ? `${promotion.yearsInCurrentLevel} ปี` : null}
              />
              <Field label="เกณฑ์ขั้นต่ำ" value={promotion.requiredTenureYears != null ? `${promotion.requiredTenureYears} ปี` : null} />
              <Field label="เหลืออีก" value={promotion.displayRemainingTenureTh} />
              <Field label="ครบคุณสมบัติครั้งแรก" value={promotion.displayFirstEligibleYearTh} />
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
              {isAlreadyEligible ? (
                <>
                  <Field label="รอการแต่งตั้งมาแล้ว" value={promotion.displayWaitingTh} />
                  <Field
                    label="รอบการแต่งตั้ง"
                    value={promotion.eligibilityYearNumber != null ? `รอบที่ ${promotion.eligibilityYearNumber}` : null}
                  />
                </>
              ) : null}
              {promotion.confidence !== "confirmed" ? (
                <Field label="ความน่าเชื่อถือของข้อมูล" value={CONFIDENCE_LABEL_TH[promotion.confidence]} />
              ) : null}
            </dl>

            {reasonTh ? (
              <div className="rounded-lg border border-border bg-neutral-bg px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">เหตุผล</p>
                <p className="mt-0.5 text-sm text-foreground">{reasonTh}</p>
              </div>
            ) : null}

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
