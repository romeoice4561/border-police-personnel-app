/**
 * OfficerPersonalTimelineCard (Phase 44 — Officer Intelligence Workspace,
 * Task 5).
 *
 * Compact birth date / age / next birthday / service duration summary — all
 * read from OfficerIntelligenceViewModel.age and .service. Never fabricates
 * a service-start date: when unavailable, shows the explicit Thai fallback
 * per the task's rule rather than omitting the field silently.
 */
import { formatFullThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const NO_SERVICE_START = "ยังไม่มีข้อมูลวันเริ่มรับราชการที่เชื่อถือได้";
const UNAVAILABLE = "ยังไม่มีข้อมูลเพียงพอ";

function Field({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value ?? <span className="font-normal text-muted">{UNAVAILABLE}</span>}</dd>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function OfficerPersonalTimelineCard({
  viewModel,
  dateOfBirth,
}: {
  viewModel: OfficerIntelligenceViewModel;
  /** Raw master-data date of birth, passed through only for the "วันเกิด" display — formatted here via the canonical Thai date formatter, never recalculated. */
  dateOfBirth: Date | null;
}) {
  const { age, service } = viewModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Timeline / อายุและอายุราชการ</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="วันเกิด" value={dateOfBirth ? formatFullThaiDateTh(dateOfBirth) : null} />
          <Field label="อายุปัจจุบัน" value={age.available ? age.displayAgeTh : null} />
          <Field
            label={age.nextBirthdayAge != null ? `ครบ ${age.nextBirthdayAge} ปี` : "วันเกิดครั้งถัดไป"}
            value={age.available && age.nextBirthdayDate ? formatFullThaiDateTh(new Date(`${age.nextBirthdayDate}T00:00:00Z`)) : null}
            hint={age.available && age.daysUntilNextBirthday != null ? `เหลืออีก ${age.daysUntilNextBirthday.toLocaleString("th-TH")} วัน` : undefined}
          />
          <Field label="อายุราชการ" value={service.available ? service.displayServiceDurationTh : null} />
        </dl>

        {!service.available ? (
          <p className="mt-4 rounded-lg border border-border bg-neutral-bg/50 px-3 py-2 text-xs text-muted">{NO_SERVICE_START}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
