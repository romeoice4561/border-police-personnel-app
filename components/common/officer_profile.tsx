/**
 * OfficerProfile (Phase 14 UI): the full officer detail composition —
 * identity, career summary, quality + knowledge scores, phones, and the
 * timeline table. Consumes an OfficerProfile from the API; renders nothing it
 * isn't given (a missing field shows an explicit "—", never invented).
 */
import type { OfficerProfile as OfficerProfileData } from "@/lib/ui/api_client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { QualityBadge } from "@/components/common/quality_badge";
import { TimelineTable } from "@/components/common/timeline_table";
import { Badge } from "@/components/ui/badge";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

export function OfficerProfile({ profile }: { profile: OfficerProfileData }) {
  const { officer, timeline, phones, quality } = profile;
  const name = [officer.firstName, officer.lastName].filter(Boolean).join(" ") || officer.id;

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted">{officer.rank || "—"}</p>
          <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
          <p className="mt-1 text-sm text-muted">{officer.currentPosition || "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QualityBadge score={quality.qualityScore} />
          {officer.region ? <Badge>{officer.region}</Badge> : null}
        </div>
      </div>

      {/* Identity + career summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Rank" value={officer.rank} />
              <Field label="Region" value={officer.region} />
              <Field label="First name" value={officer.firstName} />
              <Field label="Last name" value={officer.lastName} />
              <Field label="Officer ID" value={officer.id} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career &amp; Quality</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Current unit" value={officer.currentUnit} />
              <Field label="Current position" value={officer.currentPosition} />
              <Field label="Career years" value={officer.careerYears} />
              <Field label="Timeline entries" value={timeline.length} />
              <Field label="Quality score" value={quality.qualityScore} />
              <Field label="Knowledge score" value={quality.knowledgeScore} />
              <Field label="Extraction confidence" value={officer.confidence} />
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* Phones */}
      <Card>
        <CardHeader>
          <CardTitle>Phone</CardTitle>
        </CardHeader>
        <CardBody>
          {phones.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {phones.map((p) => (
                <li key={p}>
                  <Badge className="tabular-nums">{p}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No phone on record.</p>
          )}
        </CardBody>
      </Card>

      {/* Timeline */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Career Timeline</h2>
        <TimelineTable timeline={timeline} />
      </section>
    </div>
  );
}
