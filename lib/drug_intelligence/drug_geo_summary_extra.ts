/**
 * Additional map-workspace KPIs not already in DrugGeoSummaryView (Phase
 * DI-8.2, Section 3/11) — "จำนวนผู้ต้องหา" and "จำนวนหน่วยปฏิบัติ". Computed
 * client-side from the already-fetched DrugGeoResultView (markers +
 * no-coordinate cases) — no new API field, no new query. The map API's
 * DrugGeoSummary already gives totalCases/markerCount/provinceCount/
 * noCoordinateCount; this only adds the two figures it doesn't carry,
 * using data the client already has in hand.
 *
 * Defendant count: distinct personId across every case's personSummaries.
 * Only markers carry personSummaries (a no-coordinate case's suspect count
 * isn't in the client view model at all) — this is the same "reuse what's
 * already fetched, don't add a new field" boundary the rest of DI-8.2
 * follows; a no-coordinate case's persons are undercounted here by
 * construction, not silently miscounted.
 *
 * Unit count: distinct non-empty reportingUnitText across BOTH markers and
 * no-coordinate cases (reportingUnitText exists on both view types) —
 * leadUnitText is deliberately NOT unioned in here, since "หน่วยปฏิบัติ" in
 * the KPI strip means the reporting/operating unit, not every possible
 * arrest-lead label (Section 16: never confuse reporting unit with lead
 * unit).
 *
 * Pure — no I/O, no React.
 */

interface DefendantCountableCase {
  personSummaries: { personId: string }[];
}
interface UnitCountableCase {
  reportingUnitText: string | null;
}

export function computeDrugGeoDefendantCount(markers: DefendantCountableCase[]): number {
  const ids = new Set<string>();
  for (const m of markers) {
    for (const p of m.personSummaries) ids.add(p.personId);
  }
  return ids.size;
}

export function computeDrugGeoUnitCount(cases: UnitCountableCase[]): number {
  const units = new Set<string>();
  for (const c of cases) {
    const text = c.reportingUnitText?.trim();
    if (text) units.add(text);
  }
  return units.size;
}
