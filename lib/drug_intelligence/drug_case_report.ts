/**
 * Case Intelligence Report (DI-10C + DI-10E.3 refinement).
 * Factual case-linked records only. Association does not imply guilt.
 * Case alerts are labeled ANALYTIC SIGNAL, never FACT.
 * COUNT and MASS seizures stay separate.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { presentExportIdentifier, presentExportPhone } from "@/lib/drug_intelligence/drug_export_masking";
import {
  DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION,
  DRUG_EXPORT_CASE_REPORT_SOFT_PER_SECTION,
} from "@/lib/drug_intelligence/drug_export_limits";
import type { CASE_REPORT_SECTIONS, DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import {
  DRUG_CASE_OFFICER_ROLE_LABELS,
  DRUG_CASE_UNIT_ROLE_LABELS,
  isValidDrugCaseOfficerRole,
  isValidDrugCaseUnitRole,
} from "@/lib/drug_intelligence/drug_case_officer_options";
import { DRUG_CATEGORY_LABELS, isValidDrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import {
  DRUG_CASE_PERSON_ROLE_LABELS,
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  isValidDrugCasePersonRole,
  isValidDrugPersonIdentifierType,
} from "@/lib/drug_intelligence/drug_person_options";
import { formatCsvIsoDate } from "@/lib/export/csv";
import { escapeHtml, escapeHtmlMultiline } from "@/lib/export/html";
import { translate, type Language, type TranslationKey } from "@/lib/i18n/dictionary";

export const CASE_REPORT_SCHEMA_VERSION = 1 as const;
export const CASE_REPORT_SYSTEM_NAME = "BPPIS Drug Intelligence";

export class DrugExportCaseNotFoundError extends Error {
  readonly code = "CASE_NOT_FOUND";
  constructor() {
    super("case not found");
  }
}

export class DrugExportInvalidCaseError extends Error {
  readonly code = "INVALID_CASE";
  constructor() {
    super("case id required");
  }
}

export class DrugExportTooManyCaseRowsError extends Error {
  readonly code = "TOO_MANY_ROWS";
  constructor() {
    super("too many rows");
  }
}

export const CASE_REPORT_SECTION_KEYS: Record<(typeof CASE_REPORT_SECTIONS)[number], TranslationKey> = {
  summary: "di.export.sectionCaseCounts",
  case: "di.export.sectionCase",
  units: "di.export.sectionParticipatingUnits",
  officers: "di.export.sectionArrestTeam",
  people: "di.export.sectionPeople",
  phones: "di.export.sectionPhones",
  sims: "di.export.sectionSims",
  devices: "di.export.sectionDevices",
  vehicles: "di.export.sectionVehicles",
  seizures: "di.export.sectionSeizures",
  locations: "di.export.sectionLocations",
  signals: "di.export.sectionCaseSignals",
  timeline: "di.export.sectionCaseTimeline",
  methodology: "di.export.sectionCaseMethodology",
};

interface Bounded<T> {
  shown: T[];
  total: number;
  truncated: boolean;
}

export interface DrugCaseReportV1 {
  schemaVersion: 1;
  generatedAt: string;
  locale: Language;
  generatedBy: string;
  maskingMode: DrugExportMaskingMode;
  systemName: string;
  case: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    arrestDate: string;
    arrestTime: string;
    reportingUnit: string;
    leadUnit: string;
    province: string;
    district: string;
    locationName: string;
    narrative: string;
  };
  people: Bounded<{
    personId: string;
    displayName: string;
    role: string;
    aliases: string[];
    identifiers: Array<{ type: string; value: string }>;
  }>;
  phones: Bounded<{ number: string; personName: string; firstSeen: string; lastSeen: string }>;
  sims: Bounded<{ iccid: string; imsi: string; carrier: string; personName: string }>;
  devices: Bounded<{ brand: string; model: string; imei1: string; imei2: string; serial: string; personName: string }>;
  vehicles: Bounded<{ plate: string; province: string; vin: string; type: string; personName: string }>;
  locations: Bounded<{
    role: string;
    name: string;
    province: string;
    district: string;
    latitude: string;
    longitude: string;
  }>;
  seizures: Bounded<{
    category: string;
    measurementKind: string;
    quantity: string;
    unit: string;
    weightGrams: string;
  }>;
  units: Bounded<{ unitText: string; role: string }>;
  officers: Bounded<{ displayName: string; role: string; unitText: string }>;
  signals: Bounded<{ kind: string; category: string; label: string; detail: string }>;
  timeline: Bounded<{ date: string; kind: string; detail: string }>;
}

function boundList<T>(rows: T[]): Bounded<T> {
  const total = rows.length;
  if (total > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION) {
    throw new DrugExportTooManyCaseRowsError();
  }
  const shown = rows.slice(0, DRUG_EXPORT_CASE_REPORT_SOFT_PER_SECTION);
  return { shown, total, truncated: total > shown.length };
}

function labelRole(role: string, locale: Language): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  return locale === "th" ? DRUG_CASE_PERSON_ROLE_LABELS[role].labelTh : DRUG_CASE_PERSON_ROLE_LABELS[role].labelEn;
}

function labelLocationRole(role: string, locale: Language): string {
  if (!isValidDrugLocationRole(role)) return role;
  return locale === "th" ? DRUG_LOCATION_ROLE_LABELS[role].labelTh : DRUG_LOCATION_ROLE_LABELS[role].labelEn;
}

function labelCategory(category: string, locale: Language): string {
  if (!isValidDrugCategory(category)) return category;
  return locale === "th" ? DRUG_CATEGORY_LABELS[category].labelTh : DRUG_CATEGORY_LABELS[category].labelEn;
}

function labelStatus(status: string, locale: Language): string {
  if (!isValidDrugCaseStatus(status)) return status;
  return locale === "th" ? DRUG_CASE_STATUS_META[status].labelTh : DRUG_CASE_STATUS_META[status].labelEn;
}

function labelUnitRole(role: string, locale: Language): string {
  if (!isValidDrugCaseUnitRole(role)) return role;
  return locale === "th" ? DRUG_CASE_UNIT_ROLE_LABELS[role].labelTh : DRUG_CASE_UNIT_ROLE_LABELS[role].labelEn;
}

function labelOfficerRole(role: string, locale: Language): string {
  if (!isValidDrugCaseOfficerRole(role)) return role;
  return locale === "th" ? DRUG_CASE_OFFICER_ROLE_LABELS[role].labelTh : DRUG_CASE_OFFICER_ROLE_LABELS[role].labelEn;
}

function labelIdentifierType(type: string, locale: Language): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  return locale === "th" ? DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type].labelTh : DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type].labelEn;
}

function coordText(value: unknown, mode: DrugExportMaskingMode): string {
  if (mode !== "FULL" || value == null) return "";
  return String(value);
}

export function caseReportRecordCount(report: DrugCaseReportV1): number {
  return (
    1 +
    report.people.total +
    report.phones.total +
    report.sims.total +
    report.devices.total +
    report.vehicles.total +
    report.locations.total +
    report.seizures.total +
    report.units.total +
    report.officers.total +
    report.signals.total +
    report.timeline.total
  );
}

export async function buildDrugCaseReportV1(
  db: DatabaseClient,
  input: {
    caseId: string;
    locale: Language;
    generatedAt: string;
    generatedBy: string;
    maskingMode: DrugExportMaskingMode;
  }
): Promise<DrugCaseReportV1> {
  if (!input.caseId.trim()) throw new DrugExportInvalidCaseError();
  const take = DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION + 1;
  const personRepo = new DrugPersonRepository(db);
  const entityRepo = new DrugEntityRepository(db);

  const foundCase = await db.drugCase.findUnique({ where: { id: input.caseId } });
  if (!foundCase) throw new DrugExportCaseNotFoundError();

  const [personLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks, locationLinks, seizedItems, unitRows, officerRows, alerts] =
    await Promise.all([
      db.drugCasePerson.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCasePhone.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseSim.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseDevice.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseVehicle.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseLocation.findMany({ where: { caseId: input.caseId }, take }),
      db.drugSeizedItem.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseParticipatingUnit.findMany({ where: { caseId: input.caseId }, take }),
      db.drugCaseOfficer.findMany({ where: { caseId: input.caseId }, take }),
      db.drugIntelligenceAlert.findMany({ where: { currentCaseId: input.caseId }, take }),
    ]);

  if (
    personLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    phoneLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    simLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    deviceLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    vehicleLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    locationLinks.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    seizedItems.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    unitRows.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    officerRows.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION ||
    alerts.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION
  ) {
    throw new DrugExportTooManyCaseRowsError();
  }

  const typedPeople = personLinks as Array<{ personId: string; role: string }>;
  const typedPhones = phoneLinks as Array<{
    personId: string;
    phoneNumberId: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
  }>;
  const typedSims = simLinks as Array<{ personId: string | null; simId: string }>;
  const typedDevices = deviceLinks as Array<{ personId: string | null; deviceId: string }>;
  const typedVehicles = vehicleLinks as Array<{ personId: string | null; vehicleId: string }>;
  const typedLocations = locationLinks as Array<{ locationId: string; role: string }>;
  const typedOfficers = officerRows as Array<{
    officerId: string | null;
    manualRank: string | null;
    manualFullName: string | null;
    manualUnitText: string | null;
    role: string;
  }>;

  const personIds = [
    ...new Set(
      [
        ...typedPeople.map((row) => row.personId),
        ...typedPhones.map((row) => row.personId),
        ...typedSims.map((row) => row.personId).filter((id): id is string => Boolean(id)),
        ...typedDevices.map((row) => row.personId).filter((id): id is string => Boolean(id)),
        ...typedVehicles.map((row) => row.personId).filter((id): id is string => Boolean(id)),
      ].filter(Boolean)
    ),
  ];
  const phoneIds = [...new Set(typedPhones.map((row) => row.phoneNumberId))];
  const simIds = [...new Set(typedSims.map((row) => row.simId))];
  const deviceIds = [...new Set(typedDevices.map((row) => row.deviceId))];
  const vehicleIds = [...new Set(typedVehicles.map((row) => row.vehicleId))];
  const locationIds = [...new Set(typedLocations.map((row) => row.locationId))];
  const officerIds = [...new Set(typedOfficers.map((row) => row.officerId).filter((id): id is string => Boolean(id)))];

  const [persons, phones, sims, devices, vehicles, locations, aliases, identifiers, officers] = await Promise.all([
    personRepo.findByIds(personIds),
    entityRepo.findByIdsPhones(phoneIds),
    entityRepo.findByIdsSims(simIds),
    entityRepo.findByIdsDevices(deviceIds),
    entityRepo.findByIdsVehicles(vehicleIds),
    entityRepo.findByIdsLocations(locationIds),
    personIds.length > 0 ? db.drugPersonAlias.findMany({ where: { personId: { in: personIds } }, take }) : Promise.resolve([]),
    personIds.length > 0 ? db.drugPersonIdentifier.findMany({ where: { personId: { in: personIds } }, take }) : Promise.resolve([]),
    officerIds.length > 0 ? db.officer.findMany({ where: { officerId: { in: officerIds } } }) : Promise.resolve([]),
  ]);

  if (aliases.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION || identifiers.length > DRUG_EXPORT_CASE_REPORT_HARD_PER_SECTION) {
    throw new DrugExportTooManyCaseRowsError();
  }

  const personById = new Map(persons.map((row) => [row.id, row]));
  const phoneById = new Map(phones.map((row) => [row.id, row]));
  const simById = new Map(sims.map((row) => [row.id, row]));
  const deviceById = new Map(devices.map((row) => [row.id, row]));
  const vehicleById = new Map(vehicles.map((row) => [row.id, row]));
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const officerById = new Map(
    (officers as Array<{ officerId: string; rank: string | null; firstName: string | null; lastName: string | null; currentUnit: string | null }>).map(
      (row) => [row.officerId, row]
    )
  );

  const aliasesByPerson = new Map<string, string[]>();
  for (const row of aliases as Array<{ personId: string; fullName: string }>) {
    const list = aliasesByPerson.get(row.personId) ?? [];
    list.push(row.fullName);
    aliasesByPerson.set(row.personId, list);
  }
  const identifiersByPerson = new Map<string, Array<{ type: string; value: string }>>();
  for (const row of identifiers as Array<{ personId: string; type: string; value: string }>) {
    const list = identifiersByPerson.get(row.personId) ?? [];
    list.push({
      type: labelIdentifierType(row.type, input.locale),
      value: presentExportIdentifier(row.value, input.maskingMode),
    });
    identifiersByPerson.set(row.personId, list);
  }

  const peopleRows = typedPeople.map((link) => ({
    personId: link.personId,
    displayName: personById.get(link.personId)?.primaryFullName ?? "",
    role: labelRole(link.role, input.locale),
    aliases: aliasesByPerson.get(link.personId) ?? [],
    identifiers: identifiersByPerson.get(link.personId) ?? [],
  }));

  const phoneRows = typedPhones.map((link) => ({
    number: presentExportPhone(phoneById.get(link.phoneNumberId)?.normalizedNumber ?? "", input.maskingMode),
    personName: personById.get(link.personId)?.primaryFullName ?? "",
    firstSeen: formatCsvIsoDate(link.firstSeenAt),
    lastSeen: formatCsvIsoDate(link.lastSeenAt),
  }));

  const simRows = typedSims.map((link) => {
    const sim = simById.get(link.simId);
    return {
      iccid: presentExportIdentifier(sim?.iccid ?? "", input.maskingMode),
      imsi: presentExportIdentifier(sim?.imsi ?? "", input.maskingMode),
      carrier: sim?.carrier ?? "",
      personName: link.personId ? (personById.get(link.personId)?.primaryFullName ?? "") : "",
    };
  });

  const deviceRows = typedDevices.map((link) => {
    const device = deviceById.get(link.deviceId);
    return {
      brand: device?.brand ?? "",
      model: device?.model ?? "",
      imei1: presentExportIdentifier(device?.imei1 ?? "", input.maskingMode),
      imei2: presentExportIdentifier(device?.imei2 ?? "", input.maskingMode),
      serial: presentExportIdentifier(device?.serialNumber ?? "", input.maskingMode),
      personName: link.personId ? (personById.get(link.personId)?.primaryFullName ?? "") : "",
    };
  });

  const vehicleRows = typedVehicles.map((link) => {
    const vehicle = vehicleById.get(link.vehicleId);
    return {
      plate: presentExportIdentifier(vehicle?.registrationNumber ?? "", input.maskingMode),
      province: vehicle?.registrationProvince ?? "",
      vin: presentExportIdentifier(vehicle?.vin ?? "", input.maskingMode),
      type: vehicle?.vehicleType ?? "",
      personName: link.personId ? (personById.get(link.personId)?.primaryFullName ?? "") : "",
    };
  });

  const locationRows = typedLocations.map((link) => {
    const loc = locationById.get(link.locationId);
    return {
      role: labelLocationRole(link.role, input.locale),
      name: loc?.name ?? "",
      province: loc?.province ?? "",
      district: loc?.district ?? "",
      latitude: coordText(loc?.latitude, input.maskingMode),
      longitude: coordText(loc?.longitude, input.maskingMode),
    };
  });

  const seizureRows = (seizedItems as Array<{
    drugCategory: string;
    measurementKind: string;
    quantity: unknown;
    unit: string | null;
    weightGrams: unknown;
  }>).map((row) => ({
    category: labelCategory(row.drugCategory, input.locale),
    measurementKind: row.measurementKind,
    quantity: row.quantity != null ? String(row.quantity) : "",
    unit: row.unit ?? "",
    weightGrams: row.weightGrams != null ? String(row.weightGrams) : "",
  }));

  const unitMapped = (unitRows as Array<{ unitText: string | null; role: string }>).map((row) => ({
    unitText: row.unitText ?? "",
    role: labelUnitRole(row.role, input.locale),
  }));

  const officerMapped = typedOfficers.map((row) => {
    const linked = row.officerId ? officerById.get(row.officerId) : undefined;
    const displayName = linked
      ? [linked.rank, linked.firstName, linked.lastName].filter(Boolean).join(" ")
      : [row.manualRank, row.manualFullName].filter(Boolean).join(" ");
    return {
      displayName,
      role: labelOfficerRole(row.role, input.locale),
      unitText: linked?.currentUnit ?? row.manualUnitText ?? "",
    };
  });

  const analytic = translate("di.export.personSignalAnalytic", input.locale);
  const fact = translate("di.export.boardFact", input.locale);
  const signalRows = (alerts as Array<{ alertType: string; severity: string; status: string; occurrenceCount: number }>).map((alert) => ({
    kind: analytic,
    category: alert.alertType,
    label: alert.severity,
    detail: `${alert.status} · ${alert.occurrenceCount}`,
  }));

  const timelineRows: Array<{ date: string; kind: string; detail: string }> = [];
  const arrestDate = formatCsvIsoDate((foundCase as { arrestDate: Date | null }).arrestDate);
  const arrestTime = (foundCase as { arrestTime: string | null }).arrestTime ?? "";
  if (arrestDate) {
    timelineRows.push({
      date: [arrestDate, arrestTime].filter(Boolean).join(" "),
      kind: fact,
      detail: translate("di.field.arrestDate", input.locale),
    });
  }
  for (const row of phoneRows) {
    if (row.firstSeen) timelineRows.push({ date: row.firstSeen, kind: fact, detail: translate("di.export.sectionPhones", input.locale) });
    if (row.lastSeen && row.lastSeen !== row.firstSeen) {
      timelineRows.push({ date: row.lastSeen, kind: fact, detail: translate("di.export.sectionPhones", input.locale) });
    }
  }
  timelineRows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    schemaVersion: CASE_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    locale: input.locale,
    generatedBy: input.generatedBy,
    maskingMode: input.maskingMode,
    systemName: CASE_REPORT_SYSTEM_NAME,
    case: {
      id: (foundCase as { id: string }).id,
      caseNumber: (foundCase as { caseNumber: string }).caseNumber,
      title: (foundCase as { title: string }).title,
      status: labelStatus((foundCase as { status: string }).status, input.locale),
      arrestDate,
      arrestTime,
      reportingUnit: (foundCase as { reportingUnitText: string | null }).reportingUnitText ?? "",
      leadUnit: (foundCase as { leadUnitText: string | null }).leadUnitText ?? "",
      province: (foundCase as { province: string | null }).province ?? "",
      district: (foundCase as { district: string | null }).district ?? "",
      locationName: (foundCase as { locationName: string | null }).locationName ?? "",
      narrative: (foundCase as { narrative: string | null }).narrative ?? "",
    },
    people: boundList(peopleRows),
    phones: boundList(phoneRows),
    sims: boundList(simRows),
    devices: boundList(deviceRows),
    vehicles: boundList(vehicleRows),
    locations: boundList(locationRows),
    seizures: boundList(seizureRows),
    units: boundList(unitMapped),
    officers: boundList(officerMapped),
    signals: boundList(signalRows),
    timeline: boundList(timelineRows),
  };
}

function dash(value: string): string {
  return value.trim() ? escapeHtml(value) : "—";
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function truncationHtml(section: Bounded<unknown>, locale: Language): string {
  if (!section.truncated) return "";
  const text =
    locale === "th"
      ? `แสดง ${section.shown.length} จาก ${section.total} รายการ`
      : `Showing ${section.shown.length} of ${section.total} records`;
  return `<p class="note">${escapeHtml(text)}</p>`;
}

function semanticBadge(value: string): string {
  const text = value.trim();
  if (!text) return "—";
  const upper = text.toUpperCase();
  let kind = "";
  if (upper.includes("ANALYTIC") || text.includes("สัญญาณวิเคราะห์")) kind = "analytic";
  else if (upper.includes("INFERRED") || text.includes("อนุมาน")) kind = "inferred";
  else if (upper.includes("QUERY") || text.includes("เงื่อนไขการค้นหา")) kind = "query";
  else if (upper.includes("FACT") || upper.includes("DIRECT") || text.includes("ข้อเท็จจริง")) kind = "fact";
  if (!kind) return escapeHtml(text);
  return `<span class="badge badge-${kind}">${escapeHtml(text)}</span>`;
}

function kpiBox(label: string, count: number): string {
  if (count <= 0) return "";
  return `<div class="kpi"><div class="kpi-value">${escapeHtml(String(count))}</div><div class="kpi-label">${escapeHtml(label)}</div></div>`;
}

export function renderDrugCaseReportHtml(report: DrugCaseReportV1): string {
  const locale = report.locale;
  const t = (key: TranslationKey) => translate(key, locale);
  const maskingLabel = report.maskingMode === "FULL" ? t("di.export.full") : t("di.export.masked");
  const official = t("di.export.officialUse");
  const factBadge = semanticBadge(t("di.export.boardFact"));

  const peopleRows = report.people.shown.map((row) => [
    dash(row.displayName),
    dash(row.role),
    dash(row.aliases.join(", ")),
    dash(row.identifiers.map((id) => `${id.type}: ${id.value}`).join(" · ")),
  ]);
  const phoneRows = report.phones.shown.map((row) => [dash(row.number), dash(row.personName), dash(row.firstSeen), dash(row.lastSeen)]);
  const simRows = report.sims.shown.map((row) => [dash(row.iccid), dash(row.imsi), dash(row.carrier), dash(row.personName)]);
  const deviceRows = report.devices.shown.map((row) => [
    dash([row.brand, row.model].filter(Boolean).join(" ")),
    dash(row.imei1),
    dash(row.imei2),
    dash(row.serial),
    dash(row.personName),
  ]);
  const vehicleRows = report.vehicles.shown.map((row) => [dash(row.plate), dash(row.province), dash(row.vin), dash(row.type), dash(row.personName)]);
  const locationHeaders =
    report.maskingMode === "FULL"
      ? [t("di.export.role"), t("di.export.locationName"), t("di.field.province"), t("di.export.district"), t("di.export.latitude"), t("di.export.longitude")]
      : [t("di.export.role"), t("di.export.locationName"), t("di.field.province"), t("di.export.district")];
  const locationRows = report.locations.shown.map((row) => {
    const cells = [dash(row.role), dash(row.name), dash(row.province), dash(row.district)];
    if (report.maskingMode === "FULL") cells.push(dash(row.latitude), dash(row.longitude));
    return cells;
  });
  const seizureRows = report.seizures.shown.map((row) => [
    dash(row.category),
    dash(row.measurementKind),
    dash(row.quantity),
    dash(row.unit),
    dash(row.weightGrams),
  ]);
  const unitRows = report.units.shown.map((row) => [factBadge, dash(row.unitText), dash(row.role)]);
  const officerRows = report.officers.shown.map((row) => [factBadge, dash(row.displayName), dash(row.role), dash(row.unitText)]);
  const signalRows = report.signals.shown.map((row) => [semanticBadge(row.kind), dash(row.category), dash(row.label), dash(row.detail)]);
  const timelineRows = report.timeline.shown.map((row) => [dash(row.date), semanticBadge(row.kind), dash(row.detail)]);

  let sectionNo = 1;
  const numbered = (title: string, body: string) => {
    if (!body) return "";
    const html = `<section>
  <h2>${escapeHtml(`${sectionNo}. ${title}`)}</h2>
  ${body}
</section>`;
    sectionNo += 1;
    return html;
  };

  const kpiHtml = [
    kpiBox(t("di.export.caseKpiPeople"), report.people.total),
    kpiBox(t("di.export.caseKpiPhones"), report.phones.total),
    kpiBox(t("di.export.caseKpiSims"), report.sims.total),
    kpiBox(t("di.export.caseKpiDevices"), report.devices.total),
    kpiBox(t("di.export.caseKpiVehicles"), report.vehicles.total),
    kpiBox(t("di.export.caseKpiSeizures"), report.seizures.total),
    kpiBox(t("di.export.caseKpiUnits"), report.units.total),
    kpiBox(t("di.export.caseKpiSignals"), report.signals.total),
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t("di.export.caseReportTitle"))} — ${escapeHtml(report.case.caseNumber)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; @bottom-right { content: counter(page); } }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun", "Noto Sans Thai", "Thonburi", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif; color: #111; font-size: 11.5px; line-height: 1.45; margin: 0; }
  header.masthead { border-bottom: 2.5px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .kicker { font-size: 10px; letter-spacing: 0.03em; color: #333; margin: 0 0 2px; }
  h1 { font-size: 20px; margin: 0; line-height: 1.25; }
  .subtitle { font-size: 10.5px; letter-spacing: 0.08em; color: #333; margin: 2px 0 8px; }
  .system { font-size: 10px; color: #333; margin: 0; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; margin-top: 8px; font-size: 10.5px; }
  .meta-grid div { overflow-wrap: anywhere; }
  .meta-label { color: #333; }
  .kpi-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 4px; }
  .kpi { border: 1px solid #666; padding: 6px 8px; min-width: 92px; flex: 1 1 92px; page-break-inside: avoid; }
  .kpi-value { font-size: 16px; font-weight: 700; line-height: 1.2; }
  .kpi-label { font-size: 10px; color: #333; }
  h2 { font-size: 12.5px; margin: 16px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #111; page-break-after: avoid; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; }
  th, td { border: 1px solid #888; padding: 5px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-wrap: break-word; }
  th { background: #ececec; font-weight: 600; }
  table.kv th { width: 32%; background: #f3f3f3; }
  .note { color: #333; margin: 0 0 8px; font-size: 10.5px; }
  .badge { display: inline-block; border: 1px solid #111; padding: 1px 5px; font-size: 9.5px; line-height: 1.3; }
  .badge-fact { background: #ececec; border-style: solid; font-weight: 700; }
  .badge-inferred { background: #fff; border-style: dashed; }
  .badge-analytic { background: #fff; border-style: dotted; font-weight: 400; }
  .badge-query { background: #f7f7f7; border-style: dotted; }
  .method { border: 1px solid #111; padding: 8px 10px; background: #fafafa; }
  .method ol { margin: 0; padding-left: 18px; }
  .method li { margin: 0 0 5px; }
  footer { border-top: 1px solid #111; margin-top: 20px; padding-top: 8px; color: #333; font-size: 10.5px; }
  @media print {
    header.masthead, h2, .kpi { page-break-after: avoid; page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header class="masthead">
  <p class="kicker">${escapeHtml(t("di.nav.title"))}</p>
  <h1>${escapeHtml(t("di.export.caseReportTitle"))}</h1>
  <p class="subtitle">${escapeHtml(t("di.export.caseReportEnglishTitle"))}</p>
  <p class="system">${escapeHtml(t("di.export.personReportSystem"))}</p>
  <div class="meta-grid">
    <div><span class="meta-label">${escapeHtml(t("di.export.caseNumber"))}:</span> ${dash(report.case.caseNumber)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.field.status"))}:</span> ${dash(report.case.status)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.export.generatedAt"))}:</span> ${escapeHtml(report.generatedAt)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.export.generatedBy"))}:</span> ${dash(report.generatedBy)}</div>
    <div><span class="meta-label">${escapeHtml(official)}</span></div>
    <div><span class="meta-label">${escapeHtml(t("di.export.maskingMode"))}:</span> ${escapeHtml(maskingLabel)}</div>
  </div>
</header>
${
  kpiHtml
    ? numbered(t("di.export.sectionCaseCounts"), `<div class="kpi-row">${kpiHtml}</div><p class="note">${escapeHtml(t("di.export.caseScope"))}</p>`)
    : ""
}
${numbered(
  t("di.export.sectionCase"),
  `<table class="kv">
    <tbody>
      <tr><th scope="row">${escapeHtml(t("di.export.caseNumber"))}</th><td>${dash(report.case.caseNumber)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.caseTitle"))}</th><td>${dash(report.case.title)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.status"))}</th><td>${dash(report.case.status)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.arrestDate"))}</th><td>${dash(report.case.arrestDate)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.arrestTime"))}</th><td>${dash(report.case.arrestTime)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.reportingUnit"))}</th><td>${dash(report.case.reportingUnit)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.leadUnit"))}</th><td>${dash(report.case.leadUnit)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.province"))}</th><td>${dash(report.case.province)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.district"))}</th><td>${dash(report.case.district)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.locationName"))}</th><td>${dash(report.case.locationName)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.caseSummary"))}</th><td>${report.case.narrative ? escapeHtmlMultiline(report.case.narrative) : "—"}</td></tr>
    </tbody>
  </table>`
)}
${numbered(
  t("di.export.sectionParticipatingUnits"),
  `${truncationHtml(report.units, locale)}${table([t("di.export.boardSectionLegend"), t("di.export.caseOfficerUnit"), t("di.export.role")], unitRows)}`
)}
${numbered(
  t("di.export.sectionArrestTeam"),
  `${truncationHtml(report.officers, locale)}${table([t("di.export.boardSectionLegend"), t("di.export.caseOfficerName"), t("di.export.role"), t("di.export.caseOfficerUnit")], officerRows)}`
)}
${numbered(
  t("di.export.sectionPeople"),
  `${truncationHtml(report.people, locale)}${table([t("di.export.personName"), t("di.export.role"), t("di.export.aliases"), t("di.export.identifiers")], peopleRows)}`
)}
${numbered(
  t("di.export.sectionPhones"),
  `${truncationHtml(report.phones, locale)}${table([t("di.export.phones"), t("di.export.personName"), t("di.profile.firstSeen"), t("di.profile.lastSeen")], phoneRows)}`
)}
${numbered(
  t("di.export.sectionSims"),
  `${truncationHtml(report.sims, locale)}${table(["ICCID", "IMSI", t("di.export.carrier"), t("di.export.personName")], simRows)}`
)}
${numbered(
  t("di.export.sectionDevices"),
  `${truncationHtml(report.devices, locale)}${table([t("di.export.device"), "IMEI1", "IMEI2", t("di.export.serial"), t("di.export.personName")], deviceRows)}`
)}
${numbered(
  t("di.export.sectionVehicles"),
  `${truncationHtml(report.vehicles, locale)}${table([t("di.export.plate"), t("di.field.province"), "VIN", t("di.export.vehicleType"), t("di.export.personName")], vehicleRows)}`
)}
${numbered(
  t("di.export.sectionSeizures"),
  seizureRows.length > 0
    ? `${truncationHtml(report.seizures, locale)}${table([t("di.export.category"), t("di.export.measurementKind"), t("di.export.quantity"), t("di.export.unit"), t("di.export.weightGrams")], seizureRows)}<p class="note">${escapeHtml(t("di.export.methodologyCountMass"))}</p>`
    : ""
)}
${numbered(
  t("di.export.sectionLocations"),
  locationRows.length > 0
    ? `${truncationHtml(report.locations, locale)}${table(locationHeaders, locationRows)}<p class="note">${escapeHtml(t("di.export.caseGeoNotResidence"))}</p>`
    : ""
)}
${numbered(
  t("di.export.sectionCaseSignals"),
  `${truncationHtml(report.signals, locale)}${table([t("di.export.boardSectionLegend"), t("di.export.boardNodeType"), t("di.export.boardNodeLabel"), t("di.export.boardQueryCondition")], signalRows)}`
)}
${numbered(
  t("di.export.sectionCaseTimeline"),
  `${truncationHtml(report.timeline, locale)}${table([t("di.field.arrestDate"), t("di.export.boardSectionLegend"), t("di.export.boardNodeLabel")], timelineRows)}`
)}
${numbered(
  t("di.export.sectionCaseMethodology"),
  `<div class="method">
  <ol>
    <li>${escapeHtml(t("di.export.caseMethodSource"))}</li>
    <li>${escapeHtml(t("di.export.caseMethodNoGuilt"))}</li>
    <li>${escapeHtml(t("di.export.caseMethodNoCollab"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendFact"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendInferred"))}</li>
    <li>${semanticBadge(t("di.export.personLegendAnalytic"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendQuery"))}</li>
    <li>${escapeHtml(t("di.export.caseGeoNotResidence"))}</li>
    <li>${escapeHtml(t("di.export.notRiskScore"))}</li>
  </ol>
</div>`
)}
<footer>
  <p>${escapeHtml(t("di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
  <p>${escapeHtml(t("di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)} · ${escapeHtml(maskingLabel)}</p>
  <p>${escapeHtml(t("di.export.dataCurrent"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(report.systemName)} · ${escapeHtml(official)}</p>
</footer>
</body>
</html>`;
}
