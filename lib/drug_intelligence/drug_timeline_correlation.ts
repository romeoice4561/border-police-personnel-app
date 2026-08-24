/**
 * Pure timeline KPI / geographic-aggregate / correlation helpers (Phase
 * DI-7, Sections 3, 9, 10). No I/O — takes an already-hydrated
 * DrugTimelineEvent[] and derives deterministic summaries. Every KPI/
 * correlation here states a FACT already present in the input events —
 * never a probability, never a criminal-risk score (Section 10's explicit
 * prohibition). Mirrors drug_intelligence_alert_severity.ts's "deterministic,
 * documented rules" convention exactly.
 */

import type { DrugTimelineEvent, DrugTimelineKpi, DrugGeographicAggregateRow, DrugTimelineCorrelation } from "@/lib/drug_intelligence/drug_timeline_types";

/**
 * Section 3 KPI rules (exact):
 *   - eventCount: number of events in scope.
 *   - provinceCount: number of DISTINCT non-null provinces across events.
 *   - personsRepeatedAcrossAreas: a person whose recorded events span 2+
 *     DISTINCT provinces (never "2+ events" alone — same-province repeats
 *     are a REPEAT_PERSON/case-count signal, already covered by DI-6, not
 *     a geographic one).
 *   - entitiesRepeatedAcrossAreas: N/A at this layer — DrugTimelineEvent
 *     doesn't carry per-entity ids (only person names), so this KPI is
 *     always 0 here; the service layer computes it separately via
 *     DrugEntityDetailService when a focus entity view is active. See
 *     drug_timeline_service.ts's docstring for why entity-level cross-area
 *     detection needs the entity's own sourceCases, not the generic event
 *     list.
 *   - areasWithRepeatEvents: a province with 2+ events in scope.
 *   - dateRangeFrom/To: min/max arrestDate across events with a known date.
 */
export function computeDrugTimelineKpi(events: DrugTimelineEvent[]): DrugTimelineKpi {
  const provinces = new Set(events.map((e) => e.province).filter((p): p is string => p !== null));

  const eventsByProvincePerPerson = new Map<string, Set<string>>();
  for (const event of events) {
    if (!event.province) continue;
    for (const p of event.persons) {
      const set = eventsByProvincePerPerson.get(p.personId) ?? new Set<string>();
      set.add(event.province);
      eventsByProvincePerPerson.set(p.personId, set);
    }
  }
  const personsRepeatedAcrossAreas = [...eventsByProvincePerPerson.values()].filter((set) => set.size >= 2).length;

  const provinceEventCounts = new Map<string, number>();
  for (const event of events) {
    if (!event.province) continue;
    provinceEventCounts.set(event.province, (provinceEventCounts.get(event.province) ?? 0) + 1);
  }
  const areasWithRepeatEvents = [...provinceEventCounts.values()].filter((count) => count >= 2).length;

  const dates = events.map((e) => e.arrestDate).filter((d): d is Date => d !== null);
  const dateRangeFrom = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const dateRangeTo = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  return {
    eventCount: events.length,
    provinceCount: provinces.size,
    personsRepeatedAcrossAreas,
    entitiesRepeatedAcrossAreas: 0,
    areasWithRepeatEvents,
    dateRangeFrom,
    dateRangeTo,
  };
}

/** Section 9: จังหวัด/อำเภอ -> จำนวนคดี. Only ever built from province/district values actually present on the events (no fabricated administrative hierarchy). Rows sorted by caseCount descending, then province name, for a stable/deterministic order. */
export function computeDrugGeographicAggregate(events: DrugTimelineEvent[]): DrugGeographicAggregateRow[] {
  const byKey = new Map<string, DrugGeographicAggregateRow>();
  for (const event of events) {
    if (!event.province) continue;
    const key = `${event.province}|${event.district ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.caseCount += 1;
      existing.eventIds.push(event.caseId);
    } else {
      byKey.set(key, { province: event.province, district: event.district, caseCount: 1, eventIds: [event.caseId] });
    }
  }
  return [...byKey.values()].sort((a, b) => b.caseCount - a.caseCount || a.province.localeCompare(b.province));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Section 10 correlation rules (exact, deterministic):
 *   A/B — SHARED_LOCATION_MULTI_PERSON: 2+ DISTINCT persons recorded across
 *     events in the SAME province (never same-event-only — that's just
 *     "multiple suspects in one case," not a cross-event geographic signal).
 *   D — TIME_WINDOW_CLUSTER: 2+ events in the SAME province with arrestDate
 *     within `timeWindowDays` of each other.
 * Wording never claims proof — always "ความเชื่อมโยงที่พบจากข้อมูล... ควร
 * ตรวจสอบเพิ่มเติม" (composed in drug_timeline_explanation.ts, referenced by
 * key here so this module stays presentation-agnostic... actually composed
 * inline since these are data-shaped facts, not i18n-keyed alert records —
 * the UI layer translates `kind`+data into localized text.).
 */
export function computeDrugTimelineCorrelations(events: DrugTimelineEvent[], timeWindowDays: number): DrugTimelineCorrelation[] {
  const correlations: DrugTimelineCorrelation[] = [];

  const eventsByProvince = new Map<string, DrugTimelineEvent[]>();
  for (const event of events) {
    if (!event.province) continue;
    const list = eventsByProvince.get(event.province) ?? [];
    list.push(event);
    eventsByProvince.set(event.province, list);
  }

  for (const [province, provinceEvents] of eventsByProvince) {
    const distinctPersonIds = new Set(provinceEvents.flatMap((e) => e.persons.map((p) => p.personId)));
    if (distinctPersonIds.size >= 2) {
      correlations.push({
        kind: "SHARED_LOCATION_MULTI_PERSON",
        entityType: null,
        entityId: null,
        province,
        caseIds: [...new Set(provinceEvents.map((e) => e.caseId))],
        explanation: `พบบุคคล ${distinctPersonIds.size} รายที่มีข้อมูลในพื้นที่ ${province} — ควรตรวจสอบความเชื่อมโยงเพิ่มเติม`,
      });
    }

    if (provinceEvents.length >= 2) {
      const sortedByDate = [...provinceEvents].filter((e) => e.arrestDate !== null).sort((a, b) => a.arrestDate!.getTime() - b.arrestDate!.getTime());
      for (let i = 0; i < sortedByDate.length - 1; i++) {
        const a = sortedByDate[i];
        const b = sortedByDate[i + 1];
        const diffDays = (b.arrestDate!.getTime() - a.arrestDate!.getTime()) / MS_PER_DAY;
        if (diffDays <= timeWindowDays) {
          correlations.push({
            kind: "TIME_WINDOW_CLUSTER",
            entityType: "CASE",
            entityId: null,
            province,
            caseIds: [a.caseId, b.caseId],
            explanation: `พบเหตุการณ์ในพื้นที่ ${province} ห่างกัน ${Math.round(diffDays)} วัน — ความเชื่อมโยงที่พบจากข้อมูล ควรตรวจสอบเพิ่มเติม`,
          });
        }
      }
    }
  }

  return correlations;
}
