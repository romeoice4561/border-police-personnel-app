/**
 * OfficerProfileCard (Phase 15A).
 *
 * The officer's core facts — rank, full name, position, unit, region, phone,
 * career years. Presentational Server Component; a missing field renders an
 * explicit "—" (never invented). Phones beyond the primary (from the related
 * Phone rows) are listed too.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

export function OfficerProfileCard({ officer }: { officer: OfficerWithRelations }) {
  const extraPhones = officer.phones.map((p) => p.number).filter((n) => n && n !== officer.phone);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Rank" value={officer.rank} />
          <Field label="Region" value={officer.region} />
          <Field label="Full name" value={officerFullName(officer)} />
          <Field label="Career years" value={officer.careerYears} />
          <Field label="Position" value={officer.currentPosition} />
          <Field label="Unit" value={officer.currentUnit} />
          <Field label="Phone" value={officer.phone} />
          <Field label="Officer ID" value={officer.officerId} />
        </dl>

        {extraPhones.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <dt className="text-xs uppercase tracking-wide text-muted">Additional phones</dt>
            <dd className="mt-1 text-sm tabular-nums text-foreground">{extraPhones.join(", ")}</dd>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
