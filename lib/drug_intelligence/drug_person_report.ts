/**
 * Person Intelligence Report V1 (DI-10E.2).
 * Factual person-linked records only. Association does not imply guilt.
 * Network-role rows and alerts are labeled ANALYTIC SIGNAL, never FACT.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { presentExportIdentifier, presentExportPhone } from "@/lib/drug_intelligence/drug_export_masking";
import {
  DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION,
  DRUG_EXPORT_PERSON_REPORT_SOFT_PER_SECTION,
} from "@/lib/drug_intelligence/drug_export_limits";
import type { PERSON_REPORT_SECTIONS } from "@/lib/drug_intelligence/drug_export_types";
import type { DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";
import {
  DRUG_CASE_PERSON_ROLE_LABELS,
  DRUG_NETWORK_ROLE_LABELS,
  DRUG_NETWORK_ROLE_SOURCE_LABELS,
  DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS,
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  DRUG_PERSON_SEX_LABELS,
  isValidDrugCasePersonRole,
  isValidDrugNetworkRole,
  isValidDrugNetworkRoleSource,
  isValidDrugNetworkRoleVerificationStatus,
  isValidDrugPersonIdentifierType,
  isValidDrugPersonSex,
} from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { formatCsvIsoDate } from "@/lib/export/csv";
import { escapeHtml } from "@/lib/export/html";
import { translate, type Language, type TranslationKey } from "@/lib/i18n/dictionary";

export const PERSON_REPORT_SCHEMA_VERSION = 1 as const;
export const PERSON_REPORT_SYSTEM_NAME = "BPPIS Drug Intelligence";

export class DrugExportPersonNotFoundError extends Error {
  readonly code = "PERSON_NOT_FOUND";
  constructor() {
    super("person not found");
  }
}

export class DrugExportInvalidPersonError extends Error {
  readonly code = "INVALID_PERSON";
  constructor() {
    super("person id required");
  }
}

export class DrugExportTooManyPersonRowsError extends Error {
  readonly code = "TOO_MANY_ROWS";
  constructor() {
    super("too many rows");
  }
}

export const PERSON_REPORT_SECTION_KEYS: Record<(typeof PERSON_REPORT_SECTIONS)[number], TranslationKey> = {
  summary: "di.export.sectionPersonSummary",
  cases: "di.export.sectionPersonCases",
  identifiers: "di.export.identifiers",
  phones: "di.export.sectionPhones",
  sims: "di.export.sectionSims",
  devices: "di.export.sectionDevices",
  vehicles: "di.export.sectionVehicles",
  signals: "di.export.sectionPersonSignals",
  timeline: "di.export.sectionPersonTimeline",
  geography: "di.export.sectionPersonGeography",
  methodology: "di.export.sectionPersonMethodology",
};

interface Bounded<T> {
  shown: T[];
  total: number;
  truncated: boolean;
}

export interface DrugPersonReportV1 {
  schemaVersion: 1;
  generatedAt: string;
  locale: Language;
  generatedBy: string;
  maskingMode: DrugExportMaskingMode;
  systemName: string;
  person: {
    id: string;
    displayName: string;
    nickname: string;
    status: string;
    nationality: string;
    sex: string;
    aliases: Bounded<string>;
  };
  cases: Bounded<{
    caseNumber: string;
    arrestDate: string;
    role: string;
    reportingUnit: string;
    leadUnit: string;
    province: string;
    status: string;
  }>;
  identifiers: Bounded<{ type: string; value: string }>;
  phones: Bounded<{ number: string; caseNumber: string; firstSeen: string; lastSeen: string }>;
  sims: Bounded<{ iccid: string; imsi: string; carrier: string; caseNumber: string }>;
  devices: Bounded<{ label: string; imei1: string; imei2: string; serial: string }>;
  vehicles: Bounded<{ plate: string; province: string; vin: string; type: string }>;
  signals: Bounded<{ kind: string; category: string; label: string; detail: string }>;
  timeline: Bounded<{ date: string; kind: string; detail: string }>;
  geography: Bounded<{ province: string; district: string; source: string }>;
}

function boundList<T>(rows: T[]): Bounded<T> {
  const total = rows.length;
  if (total > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION) {
    throw new DrugExportTooManyPersonRowsError();
  }
  const shown = rows.slice(0, DRUG_EXPORT_PERSON_REPORT_SOFT_PER_SECTION);
  return { shown, total, truncated: total > shown.length };
}

function labelRole(role: string, locale: Language): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  return locale === "th" ? DRUG_CASE_PERSON_ROLE_LABELS[role].labelTh : DRUG_CASE_PERSON_ROLE_LABELS[role].labelEn;
}

function labelIdentifierType(type: string, locale: Language): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  return locale === "th" ? DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type].labelTh : DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type].labelEn;
}

function labelSex(value: string | null, locale: Language): string {
  if (!value || !isValidDrugPersonSex(value)) return "";
  return locale === "th" ? DRUG_PERSON_SEX_LABELS[value].labelTh : DRUG_PERSON_SEX_LABELS[value].labelEn;
}

function labelLocationRole(role: string, locale: Language): string {
  if (!isValidDrugLocationRole(role)) return role;
  return locale === "th" ? DRUG_LOCATION_ROLE_LABELS[role].labelTh : DRUG_LOCATION_ROLE_LABELS[role].labelEn;
}

function labelNetworkRole(role: string, locale: Language): string {
  if (!isValidDrugNetworkRole(role)) return role;
  return locale === "th" ? DRUG_NETWORK_ROLE_LABELS[role].labelTh : DRUG_NETWORK_ROLE_LABELS[role].labelEn;
}

function labelNetworkSource(source: string | null, locale: Language): string {
  if (!source || !isValidDrugNetworkRoleSource(source)) return source ?? "";
  return locale === "th" ? DRUG_NETWORK_ROLE_SOURCE_LABELS[source].labelTh : DRUG_NETWORK_ROLE_SOURCE_LABELS[source].labelEn;
}

function labelNetworkVerification(status: string, locale: Language): string {
  if (!isValidDrugNetworkRoleVerificationStatus(status)) return status;
  return locale === "th"
    ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[status].labelTh
    : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[status].labelEn;
}

export function personReportRecordCount(report: DrugPersonReportV1): number {
  return (
    1 +
    report.person.aliases.total +
    report.cases.total +
    report.identifiers.total +
    report.phones.total +
    report.sims.total +
    report.devices.total +
    report.vehicles.total +
    report.signals.total +
    report.timeline.total +
    report.geography.total
  );
}

export async function buildDrugPersonReportV1(
  db: DatabaseClient,
  input: {
    personId: string;
    locale: Language;
    generatedAt: string;
    generatedBy: string;
    maskingMode: DrugExportMaskingMode;
  }
): Promise<DrugPersonReportV1> {
  if (!input.personId.trim()) throw new DrugExportInvalidPersonError();
  const personRepo = new DrugPersonRepository(db);
  const entityRepo = new DrugEntityRepository(db);
  const take = DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION + 1;

  const person = await personRepo.findById(input.personId);
  if (!person) throw new DrugExportPersonNotFoundError();

  const [aliases, identifiers, caseLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks, alerts, networkRoles] =
    await Promise.all([
      db.drugPersonAlias.findMany({ where: { personId: input.personId }, take }),
      db.drugPersonIdentifier.findMany({ where: { personId: input.personId }, take }),
      db.drugCasePerson.findMany({ where: { personId: input.personId }, take }),
      db.drugCasePhone.findMany({ where: { personId: input.personId }, take }),
      db.drugCaseSim.findMany({ where: { personId: input.personId }, take }),
      db.drugPersonDevice.findMany({ where: { personId: input.personId }, take }),
      db.drugPersonVehicle.findMany({ where: { personId: input.personId }, take }),
      db.drugIntelligenceAlert.findMany({ where: { entityType: "PERSON", entityId: input.personId }, take }),
      db.drugPersonNetworkRole.findMany({ where: { personId: input.personId }, take }),
    ]);

  const typedCaseLinks = caseLinks as Array<{ caseId: string; role: string }>;
  const typedPhoneLinks = phoneLinks as Array<{
    caseId: string;
    phoneNumberId: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
  }>;
  const typedSimLinks = simLinks as Array<{ caseId: string; simId: string }>;
  const typedDeviceLinks = deviceLinks as Array<{ deviceId: string; firstSeenAt: Date | null; lastSeenAt: Date | null }>;
  const typedVehicleLinks = vehicleLinks as Array<{ vehicleId: string; firstSeenAt: Date | null; lastSeenAt: Date | null }>;

  if (
    typedCaseLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    typedPhoneLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    typedSimLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    typedDeviceLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    typedVehicleLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    identifiers.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    aliases.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    (alerts as unknown[]).length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION ||
    (networkRoles as unknown[]).length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION
  ) {
    throw new DrugExportTooManyPersonRowsError();
  }

  const caseIds = [...new Set(typedCaseLinks.map((row) => row.caseId))];
  const phoneIds = [...new Set(typedPhoneLinks.map((row) => row.phoneNumberId))];
  const simIds = [...new Set(typedSimLinks.map((row) => row.simId))];
  const deviceIds = [...new Set(typedDeviceLinks.map((row) => row.deviceId))];
  const vehicleIds = [...new Set(typedVehicleLinks.map((row) => row.vehicleId))];

  const [cases, phones, sims, devices, vehicles, locationLinks] = await Promise.all([
    caseIds.length > 0 ? db.drugCase.findMany({ where: { id: { in: caseIds } } }) : Promise.resolve([]),
    entityRepo.findByIdsPhones(phoneIds),
    entityRepo.findByIdsSims(simIds),
    entityRepo.findByIdsDevices(deviceIds),
    entityRepo.findByIdsVehicles(vehicleIds),
    caseIds.length > 0
      ? db.drugCaseLocation.findMany({ where: { caseId: { in: caseIds } }, take })
      : Promise.resolve([]),
  ]);

  const typedCases = cases as Array<{
    id: string;
    caseNumber: string;
    arrestDate: Date | null;
    reportingUnitText: string | null;
    leadUnitText: string | null;
    province: string | null;
    district: string | null;
    locationName: string | null;
    status: string;
  }>;
  const caseById = new Map(typedCases.map((row) => [row.id, row]));
  const phoneById = new Map(phones.map((row) => [row.id, row]));
  const simById = new Map(sims.map((row) => [row.id, row]));
  const deviceById = new Map(devices.map((row) => [row.id, row]));
  const vehicleById = new Map(vehicles.map((row) => [row.id, row]));

  const typedLocationLinks = locationLinks as Array<{ caseId: string; locationId: string; role: string }>;
  if (typedLocationLinks.length > DRUG_EXPORT_PERSON_REPORT_HARD_PER_SECTION) {
    throw new DrugExportTooManyPersonRowsError();
  }
  const locationIds = [...new Set(typedLocationLinks.map((row) => row.locationId))];
  const locations = await entityRepo.findByIdsLocations(locationIds);
  const locationById = new Map(locations.map((row) => [row.id, row]));

  const caseRows = typedCaseLinks.map((link) => {
    const found = caseById.get(link.caseId);
    return {
      caseNumber: found?.caseNumber ?? "",
      arrestDate: formatCsvIsoDate(found?.arrestDate ?? null),
      role: labelRole(link.role, input.locale),
      reportingUnit: found?.reportingUnitText ?? "",
      leadUnit: found?.leadUnitText ?? "",
      province: [found?.province, found?.district, found?.locationName].filter(Boolean).join(" / "),
      status: found?.status ?? "",
    };
  });

  const phoneRows = typedPhoneLinks.map((link) => {
    const phone = phoneById.get(link.phoneNumberId);
    const foundCase = caseById.get(link.caseId);
    return {
      number: presentExportPhone(phone?.normalizedNumber ?? "", input.maskingMode),
      caseNumber: foundCase?.caseNumber ?? "",
      firstSeen: formatCsvIsoDate(link.firstSeenAt),
      lastSeen: formatCsvIsoDate(link.lastSeenAt),
    };
  });

  const simRows = typedSimLinks.map((link) => {
    const sim = simById.get(link.simId);
    const foundCase = caseById.get(link.caseId);
    return {
      iccid: presentExportIdentifier(sim?.iccid ?? "", input.maskingMode),
      imsi: presentExportIdentifier(sim?.imsi ?? "", input.maskingMode),
      carrier: sim?.carrier ?? "",
      caseNumber: foundCase?.caseNumber ?? "",
    };
  });

  const deviceRows = typedDeviceLinks.map((link) => {
    const device = deviceById.get(link.deviceId);
    return {
      label: [device?.brand, device?.model].filter(Boolean).join(" "),
      imei1: presentExportIdentifier(device?.imei1 ?? "", input.maskingMode),
      imei2: presentExportIdentifier(device?.imei2 ?? "", input.maskingMode),
      serial: presentExportIdentifier(device?.serialNumber ?? "", input.maskingMode),
    };
  });

  const vehicleRows = typedVehicleLinks.map((link) => {
    const vehicle = vehicleById.get(link.vehicleId);
    return {
      plate: presentExportIdentifier(vehicle?.registrationNumber ?? "", input.maskingMode),
      province: vehicle?.registrationProvince ?? "",
      vin: presentExportIdentifier(vehicle?.vin ?? "", input.maskingMode),
      type: vehicle?.vehicleType ?? "",
    };
  });

  const analytic = translate("di.export.personSignalAnalytic", input.locale);
  const fact = translate("di.export.boardFact", input.locale);
  const signalRows: Array<{ kind: string; category: string; label: string; detail: string }> = [];
  const typedRoles = networkRoles as Array<{
    role: string;
    source: string | null;
    verificationStatus: string;
  }>;
  for (const role of typedRoles) {
    signalRows.push({
      kind: analytic,
      category: "NETWORK_ROLE",
      label: labelNetworkRole(role.role, input.locale),
      detail: [labelNetworkSource(role.source, input.locale), labelNetworkVerification(role.verificationStatus, input.locale)]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const alert of alerts as Array<{ alertType: string; severity: string; status: string; occurrenceCount: number }>) {
    signalRows.push({
      kind: analytic,
      category: alert.alertType,
      label: alert.severity,
      detail: `${alert.status} · ${alert.occurrenceCount}`,
    });
  }

  const timelineRows: Array<{ date: string; kind: string; detail: string }> = [];
  for (const row of caseRows) {
    if (row.arrestDate) {
      timelineRows.push({
        date: row.arrestDate,
        kind: fact,
        detail: `${row.caseNumber} · ${row.role}`,
      });
    }
  }
  for (const row of phoneRows) {
    if (row.firstSeen) timelineRows.push({ date: row.firstSeen, kind: fact, detail: translate("di.export.sectionPhones", input.locale) });
    if (row.lastSeen && row.lastSeen !== row.firstSeen) {
      timelineRows.push({ date: row.lastSeen, kind: fact, detail: translate("di.export.sectionPhones", input.locale) });
    }
  }
  timelineRows.sort((a, b) => a.date.localeCompare(b.date));

  const geoMap = new Map<string, { province: string; district: string; source: string }>();
  for (const found of typedCases) {
    const province = found.province ?? "";
    const district = found.district ?? "";
    if (!province && !district) continue;
    const key = `${province}|${district}|CASE`;
    geoMap.set(key, {
      province,
      district,
      source: translate("di.export.personGeoFromCase", input.locale),
    });
  }
  for (const link of typedLocationLinks) {
    const loc = locationById.get(link.locationId);
    const province = loc?.province ?? "";
    const district = loc?.district ?? "";
    if (!province && !district) continue;
    const key = `${province}|${district}|LOC`;
    geoMap.set(key, {
      province,
      district,
      source: labelLocationRole(link.role, input.locale),
    });
  }

  return {
    schemaVersion: PERSON_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    locale: input.locale,
    generatedBy: input.generatedBy,
    maskingMode: input.maskingMode,
    systemName: PERSON_REPORT_SYSTEM_NAME,
    person: {
      id: person.id,
      displayName: person.primaryFullName,
      nickname: person.nickname ?? "",
      status: person.status,
      nationality: person.nationality ?? "",
      sex: labelSex(person.sex, input.locale),
      aliases: boundList((aliases as Array<{ fullName: string }>).map((row) => row.fullName)),
    },
    cases: boundList(caseRows),
    identifiers: boundList(
      (identifiers as Array<{ type: string; value: string }>).map((row) => ({
        type: labelIdentifierType(row.type, input.locale),
        value: presentExportIdentifier(row.value, input.maskingMode),
      }))
    ),
    phones: boundList(phoneRows),
    sims: boundList(simRows),
    devices: boundList(deviceRows),
    vehicles: boundList(vehicleRows),
    signals: boundList(signalRows),
    timeline: boundList(timelineRows),
    geography: boundList([...geoMap.values()]),
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

export function renderDrugPersonReportHtml(report: DrugPersonReportV1): string {
  const locale = report.locale;
  const t = (key: TranslationKey) => translate(key, locale);
  const maskingLabel = report.maskingMode === "FULL" ? t("di.export.full") : t("di.export.masked");
  const official = t("di.export.officialUse");

  const caseRows = report.cases.shown.map((row) => [
    dash(row.caseNumber),
    dash(row.arrestDate),
    dash(row.role),
    dash(row.reportingUnit),
    dash(row.leadUnit),
    dash(row.province),
    dash(row.status),
  ]);
  const identifierRows = report.identifiers.shown.map((row) => [dash(row.type), dash(row.value)]);
  const phoneRows = report.phones.shown.map((row) => [dash(row.number), dash(row.caseNumber), dash(row.firstSeen), dash(row.lastSeen)]);
  const simRows = report.sims.shown.map((row) => [dash(row.iccid), dash(row.imsi), dash(row.carrier), dash(row.caseNumber)]);
  const deviceRows = report.devices.shown.map((row) => [dash(row.label), dash(row.imei1), dash(row.imei2), dash(row.serial)]);
  const vehicleRows = report.vehicles.shown.map((row) => [dash(row.plate), dash(row.province), dash(row.vin), dash(row.type)]);
  const signalRows = report.signals.shown.map((row) => [semanticBadge(row.kind), dash(row.category), dash(row.label), dash(row.detail)]);
  const timelineRows = report.timeline.shown.map((row) => [dash(row.date), semanticBadge(row.kind), dash(row.detail)]);
  const geoRows = report.geography.shown.map((row) => [dash(row.province), dash(row.district), dash(row.source)]);

  const section = (title: string, body: string) =>
    body
      ? `<section>
  <h2>${escapeHtml(title)}</h2>
  ${body}
</section>`
      : "";
  let sectionNo = 1;
  const numbered = (title: string, body: string) => {
    if (!body) return "";
    const html = section(`${sectionNo}. ${title}`, body);
    sectionNo += 1;
    return html;
  };
  const summaryRows = [
    `<tr><th scope="row">${escapeHtml(t("di.export.personName"))}</th><td>${dash(report.person.displayName)}</td></tr>`,
    report.person.nickname.trim()
      ? `<tr><th scope="row">${escapeHtml(t("di.person.nickname"))}</th><td>${dash(report.person.nickname)}</td></tr>`
      : "",
    report.person.aliases.shown.length > 0 || report.person.aliases.truncated
      ? `<tr><th scope="row">${escapeHtml(t("di.export.aliases"))}</th><td>${dash(report.person.aliases.shown.join(", "))}</td></tr>`
      : "",
    `<tr><th scope="row">${escapeHtml(t("di.field.status"))}</th><td>${dash(report.person.status)}</td></tr>`,
    report.person.nationality.trim()
      ? `<tr><th scope="row">${escapeHtml(t("di.person.nationality"))}</th><td>${dash(report.person.nationality)}</td></tr>`
      : "",
    report.person.sex.trim()
      ? `<tr><th scope="row">${escapeHtml(t("di.person.sex"))}</th><td>${dash(report.person.sex)}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const kpiHtml = [
    kpiBox(t("di.export.personKpiCases"), report.cases.total),
    kpiBox(t("di.export.personKpiPhones"), report.phones.total),
    kpiBox(t("di.export.personKpiSims"), report.sims.total),
    kpiBox(t("di.export.personKpiDevices"), report.devices.total),
    kpiBox(t("di.export.personKpiVehicles"), report.vehicles.total),
    kpiBox(t("di.export.personKpiSignals"), report.signals.total),
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t("di.export.personReportTitle"))} — ${escapeHtml(report.person.displayName)}</title>
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
  <h1>${escapeHtml(t("di.export.personReportTitle"))}</h1>
  <p class="subtitle">${escapeHtml(t("di.export.personReportEnglishTitle"))}</p>
  <p class="system">${escapeHtml(t("di.export.personReportSystem"))}</p>
  <div class="meta-grid">
    <div><span class="meta-label">${escapeHtml(t("di.export.personName"))}:</span> ${dash(report.person.displayName)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.field.status"))}:</span> ${dash(report.person.status)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.export.generatedAt"))}:</span> ${escapeHtml(report.generatedAt)}</div>
    <div><span class="meta-label">${escapeHtml(t("di.export.generatedBy"))}:</span> ${dash(report.generatedBy)}</div>
    <div><span class="meta-label">${escapeHtml(official)}</span></div>
    <div><span class="meta-label">${escapeHtml(t("di.export.maskingMode"))}:</span> ${escapeHtml(maskingLabel)}</div>
  </div>
</header>
${
  kpiHtml
    ? numbered(t("di.export.sectionPersonCounts"), `<div class="kpi-row">${kpiHtml}</div><p class="note">${escapeHtml(t("di.export.personScope"))}</p>`)
    : ""
}
${numbered(
  t("di.export.sectionPersonSummary"),
  `<table class="kv">
    <tbody>
      ${summaryRows}
    </tbody>
  </table>${truncationHtml(report.person.aliases, locale)}`
)}
${numbered(
  t("di.export.sectionPersonCases"),
  `${truncationHtml(report.cases, locale)}${table(
    [t("di.export.caseNumber"), t("di.field.arrestDate"), t("di.export.role"), t("di.field.reportingUnit"), t("di.export.leadUnit"), t("di.field.province"), t("di.field.status")],
    caseRows
  )}`
)}
${numbered(
  t("di.export.identifiers"),
  `${truncationHtml(report.identifiers, locale)}${table([t("di.export.boardNodeType"), t("di.export.identifiers")], identifierRows)}`
)}
${numbered(
  t("di.export.sectionPhones"),
  `${truncationHtml(report.phones, locale)}${table([t("di.export.phones"), t("di.export.caseNumber"), t("di.profile.firstSeen"), t("di.profile.lastSeen")], phoneRows)}`
)}
${numbered(
  t("di.export.sectionSims"),
  `${truncationHtml(report.sims, locale)}${table(["ICCID", "IMSI", t("di.export.carrier"), t("di.export.caseNumber")], simRows)}`
)}
${numbered(
  t("di.export.sectionDevices"),
  `${truncationHtml(report.devices, locale)}${table([t("di.export.device"), "IMEI1", "IMEI2", t("di.export.serial")], deviceRows)}`
)}
${numbered(
  t("di.export.sectionVehicles"),
  `${truncationHtml(report.vehicles, locale)}${table([t("di.export.plate"), t("di.field.province"), "VIN", t("di.export.vehicleType")], vehicleRows)}`
)}
${numbered(
  t("di.export.sectionPersonSignals"),
  `${truncationHtml(report.signals, locale)}${table([t("di.export.boardSectionLegend"), t("di.export.boardNodeType"), t("di.export.boardNodeLabel"), t("di.export.boardQueryCondition")], signalRows)}`
)}
${numbered(
  t("di.export.sectionPersonTimeline"),
  `${truncationHtml(report.timeline, locale)}${table([t("di.field.arrestDate"), t("di.export.boardSectionLegend"), t("di.export.boardNodeLabel")], timelineRows)}`
)}
${numbered(
  t("di.export.sectionPersonGeography"),
  geoRows.length > 0
    ? `${truncationHtml(report.geography, locale)}${table([t("di.field.province"), t("di.export.district"), t("di.export.boardSource")], geoRows)}<p class="note">${escapeHtml(t("di.export.personGeoNotResidence"))}</p>`
    : ""
)}
${numbered(
  t("di.export.sectionPersonMethodology"),
  `<div class="method">
  <ol>
    <li>${escapeHtml(t("di.export.personMethodSource"))}</li>
    <li>${escapeHtml(t("di.export.personMethodNoGuilt"))}</li>
    <li>${escapeHtml(t("di.export.personMethodNoCollab"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendFact"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendInferred"))}</li>
    <li>${semanticBadge(t("di.export.personLegendAnalytic"))}</li>
    <li>${semanticBadge(t("di.export.boardLegendQuery"))}</li>
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
