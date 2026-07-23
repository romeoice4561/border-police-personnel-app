/**
 * OfficerPromotionIntelligenceCard (Phase 44 — Officer Intelligence
 * Workspace, Task 4; Phase 49.7 — structured re-display; Phase 49.8 — rank
 * tenure + data-confidence fields).
 *
 * The one primary Promotion Intelligence presentation on the profile page —
 * replaces the legacy PromotionCycleSection (lib/promotion_cycle/*, a
 * separate/older display system with its own English-mixed labels and
 * "เกินกำหนด" cycle semantics distinct from Phase 41's PromotionSummary).
 * Every value is read directly from OfficerIntelligenceViewModel.promotion —
 * no calculation happens here. Never shows Priority Score or algorithm
 * internals (task rule) and never implies automatic appointment
 * entitlement (explicit disclaimer note at the bottom).
 *
 * Phase 49.7: the previous single "คุณสมบัติ: {qualificationTextTh}" field
 * could read as an unconditional success badge. Replaced with THREE
 * distinct, unambiguous presentations selected by `promotion.status`/
 * `promotion.available` — waiting, already-eligible, and not-assessable.
 *
 * Phase 49.8: the not-assessable branch now shows the REAL reason
 * (`promotion.confidenceReasonTh`, e.g. "ไม่พบวันที่เริ่มครองยศปัจจุบัน")
 * instead of a single hardcoded position-level-only sentence — a missing
 * RANK-tenure evidence gap (the root cause this phase fixes) gets its own
 * accurate wording, not a position-level-worded placeholder. Also adds rank
 * tenure fields ("เริ่มครองยศปัจจุบัน"/"อายุในยศ") and a compact
 * "ความน่าเชื่อถือของข้อมูล" confidence indicator when confidence is not
 * "confirmed" (silently omitted when confirmed — no need to announce
 * "everything is fine" on every card).
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
              <Field
                label="เริ่มดำรงระดับนี้"
                value={viewModel.service.currentPositionLevelStartYearBe != null ? `พ.ศ. ${viewModel.service.currentPositionLevelStartYearBe}` : null}
              />
              <Field label="อายุในระดับตำแหน่ง" value={promotion.yearsInCurrentLevel != null ? `${promotion.yearsInCurrentLevel} ปี` : null} />
              <Field label="ยศปัจจุบัน" value={identity.rank} />
              <Field
                label="เริ่มครองยศปัจจุบัน"
                value={promotion.currentRankStartedAtYearBe != null ? `พ.ศ. ${promotion.currentRankStartedAtYearBe}` : null}
              />
              <Field label="อายุในยศ" value={promotion.yearsInCurrentRank != null ? `${promotion.yearsInCurrentRank} ปี` : null} />
              <Field label="เป้าหมาย" value={promotion.targetPositionTh} />
              <Field label="เกณฑ์ระยะเวลา" value={promotion.requiredTenureYears != null ? `${promotion.requiredTenureYears} ปี` : null} />
              <Field
                label="ครบคุณสมบัติครั้งแรก"
                value={promotion.firstEligibleYearBe != null ? `พ.ศ. ${promotion.firstEligibleYearBe}` : null}
              />
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
                  <Field label="รอการแต่งตั้งมาแล้ว" value={promotion.waitingYears != null ? `${promotion.waitingYears} ปี` : null} />
                  <Field label="รอบการแต่งตั้ง" value={promotion.eligibilityYearNumber != null ? `รอบที่ ${promotion.eligibilityYearNumber}` : null} />
                </>
              ) : null}
              {promotion.confidence !== "confirmed" ? (
                <Field label="ความน่าเชื่อถือของข้อมูล" value={CONFIDENCE_LABEL_TH[promotion.confidence]} />
              ) : null}
            </dl>

            {!isAlreadyEligible && promotion.waitingReasonTh ? (
              <div className="rounded-lg border border-border bg-neutral-bg px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">เหตุผล</p>
                <p className="mt-0.5 text-sm text-foreground">{promotion.waitingReasonTh}</p>
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
