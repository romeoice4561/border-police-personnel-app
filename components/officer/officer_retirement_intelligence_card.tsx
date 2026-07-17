/**
 * OfficerRetirementIntelligenceCard (Phase 44 — Officer Intelligence
 * Workspace, Task 6).
 *
 * Closes the Phase 43-noted gap: the Retirement Intelligence facade
 * (lib/intelligence/retirement) was not consumed anywhere in the Officer
 * Workspace. Every value here is read from
 * OfficerIntelligenceViewModel.retirement, which the server composer built
 * via computeRetirementSummary — no recalculation in this component. Year
 * is always Buddhist Era; the 1 October fiscal-year rule lives entirely in
 * the facade.
 */
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
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

/** Retirement awareness banding — mirrors the same "within N years" horizon Commander Search/Dashboard already use, derived here only from the already-computed remainingDays (no new date math). */
function retirementAwarenessLabel(remainingDays: number | null, isRetired: boolean): { text: string; tone: "good" | "warning" | "critical" } {
  if (isRetired) return { text: "เกษียณแล้ว", tone: "critical" };
  if (remainingDays == null) return { text: "ไม่สามารถประเมินได้", tone: "good" };
  if (remainingDays <= 365) return { text: "ใกล้เกษียณภายใน 1 ปี", tone: "critical" };
  if (remainingDays <= 365 * 3) return { text: "ใกล้เกษียณภายใน 3 ปี", tone: "warning" };
  return { text: "เกษียณตามเกณฑ์ปกติ", tone: "good" };
}

export function OfficerRetirementIntelligenceCard({ viewModel }: { viewModel: OfficerIntelligenceViewModel }) {
  const { retirement } = viewModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Intelligence / การเกษียณอายุราชการ</CardTitle>
      </CardHeader>
      <CardBody>
        {!retirement.available ? (
          <p className="text-sm text-muted">{UNAVAILABLE}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="วันเกษียณอายุราชการ" value={retirement.displayRetirementDateTh} />
            <Field label="ปีเกษียณ พ.ศ." value={retirement.retirementYearBe != null ? `พ.ศ. ${retirement.retirementYearBe}` : null} />
            <Field label="ระยะเวลาคงเหลือ" value={retirement.displayRemainingTh} />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">สถานะ</dt>
              <dd className="mt-0.5">
                {(() => {
                  const awareness = retirementAwarenessLabel(retirement.remainingDays, retirement.isRetired);
                  return <Badge tone={awareness.tone}>{awareness.text}</Badge>;
                })()}
              </dd>
            </div>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}
