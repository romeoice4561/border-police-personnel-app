/**
 * Case Report V1 — factual case-linked data only (DI-10C).
 * Analyst board arrows, relationship-search questions, and Commander
 * observations are never included.
 *
 * Coordinate policy: MASKED omits precise lat/lng; province/district/name remain.
 * FULL includes coordinates only when the actor has drug.edit (already gated).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCaseNotFoundError } from "@/lib/drug_intelligence/drug_case_types";
import { presentExportIdentifier, presentExportPhone } from "@/lib/drug_intelligence/drug_export_masking";
import type { DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";
import { DRUG_CATEGORY_LABELS, isValidDrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { formatCsvIsoDate } from "@/lib/export/csv";
import { escapeHtml, escapeHtmlMultiline } from "@/lib/export/html";
import { translate, type Language } from "@/lib/i18n/dictionary";

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
  people: Array<{
    personId: string;
    displayName: string;
    role: string;
    aliases: string[];
    identifiers: Array<{ type: string; value: string }>;
  }>;
  phones: Array<{ number: string; personName: string }>;
  sims: Array<{ iccid: string; imsi: string; carrier: string; personName: string }>;
  devices: Array<{ brand: string; model: string; imei1: string; imei2: string; serial: string; personName: string }>;
  vehicles: Array<{ plate: string; province: string; vin: string; type: string; personName: string }>;
  locations: Array<{
    role: string;
    name: string;
    province: string;
    district: string;
    latitude: string;
    longitude: string;
  }>;
  seizures: Array<{
    category: string;
    measurementKind: string;
    quantity: string;
    unit: string;
    weightGrams: string;
  }>;
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

function coordText(value: unknown, mode: DrugExportMaskingMode): string {
  if (mode !== "FULL" || value == null) return "";
  return String(value);
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
  const caseService = new DrugCaseService({ db });
  let detail: Awaited<ReturnType<DrugCaseService["getCase"]>>;
  try {
    detail = await caseService.getCase(input.caseId);
  } catch (error) {
    if (error instanceof DrugCaseNotFoundError) throw new DrugExportCaseNotFoundError();
    throw error;
  }

  const personIds = detail.persons.map((row) => row.personId);
  const personRepo = new DrugPersonRepository(db);
  const entityRepo = new DrugEntityRepository(db);
  const uniqueSimIds = [...new Set(detail.sims.map((row) => row.simId))];
  const [aliases, identifiers, sims] = await Promise.all([
    personIds.length > 0 ? personRepo.aliasesForPersons(personIds) : Promise.resolve([]),
    personIds.length > 0 ? personRepo.identifiersForPersons(personIds) : Promise.resolve([]),
    Promise.all(uniqueSimIds.map((id) => entityRepo.findSimById(id))),
  ]);

  const aliasesByPerson = new Map<string, string[]>();
  for (const row of aliases as Array<{ personId: string; fullName: string }>) {
    const list = aliasesByPerson.get(row.personId) ?? [];
    list.push(row.fullName);
    aliasesByPerson.set(row.personId, list);
  }
  const identifiersByPerson = new Map<string, Array<{ type: string; value: string }>>();
  for (const row of identifiers as Array<{ personId: string; type: string; value: string }>) {
    const list = identifiersByPerson.get(row.personId) ?? [];
    list.push({ type: row.type, value: presentExportIdentifier(row.value, input.maskingMode) });
    identifiersByPerson.set(row.personId, list);
  }
  const simById = new Map(sims.filter((row): row is NonNullable<typeof row> => row != null).map((row) => [row.id, row]));

  return {
    schemaVersion: CASE_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    locale: input.locale,
    generatedBy: input.generatedBy,
    maskingMode: input.maskingMode,
    systemName: CASE_REPORT_SYSTEM_NAME,
    case: {
      id: detail.case.id,
      caseNumber: detail.case.caseNumber,
      title: detail.case.title,
      status: detail.case.status,
      arrestDate: formatCsvIsoDate(detail.case.arrestDate),
      arrestTime: detail.case.arrestTime ?? "",
      reportingUnit: detail.case.reportingUnitText ?? "",
      leadUnit: detail.case.leadUnitText ?? "",
      province: detail.case.province ?? "",
      district: detail.case.district ?? "",
      locationName: detail.case.locationName ?? "",
      narrative: detail.case.narrative ?? "",
    },
    people: detail.persons.map((row) => ({
      personId: row.personId,
      displayName: row.person?.primaryFullName ?? "",
      role: labelRole(row.role, input.locale),
      aliases: aliasesByPerson.get(row.personId) ?? [],
      identifiers: identifiersByPerson.get(row.personId) ?? [],
    })),
    phones: detail.phones.map((row) => ({
      number: presentExportPhone(row.phoneNumber?.normalizedNumber ?? row.originalInput ?? "", input.maskingMode),
      personName: row.person?.primaryFullName ?? "",
    })),
    sims: detail.sims.map((row) => {
      const sim = simById.get(row.simId);
      return {
        iccid: presentExportIdentifier(sim?.iccid ?? "", input.maskingMode),
        imsi: presentExportIdentifier(sim?.imsi ?? "", input.maskingMode),
        carrier: sim?.carrier ?? "",
        personName: row.person?.primaryFullName ?? "",
      };
    }),
    devices: detail.devices.map((row) => ({
      brand: row.device?.brand ?? "",
      model: row.device?.model ?? "",
      imei1: presentExportIdentifier(row.device?.imei1 ?? "", input.maskingMode),
      imei2: presentExportIdentifier(row.device?.imei2 ?? "", input.maskingMode),
      serial: row.device?.serialNumber ?? "",
      personName: row.person?.primaryFullName ?? "",
    })),
    vehicles: detail.vehicles.map((row) => ({
      plate: presentExportIdentifier(row.vehicle?.registrationNumber ?? "", input.maskingMode),
      province: row.vehicle?.registrationProvince ?? "",
      vin: presentExportIdentifier(row.vehicle?.vin ?? "", input.maskingMode),
      type: row.vehicle?.vehicleType ?? "",
      personName: row.person?.primaryFullName ?? "",
    })),
    locations: detail.locations.map((row) => ({
      role: labelLocationRole(row.role, input.locale),
      name: row.location?.name ?? "",
      province: row.location?.province ?? "",
      district: row.location?.district ?? "",
      latitude: coordText(row.location?.latitude, input.maskingMode),
      longitude: coordText(row.location?.longitude, input.maskingMode),
    })),
    seizures: detail.seizedItems.map((row) => ({
      category: labelCategory(row.drugCategory, input.locale),
      measurementKind: row.measurementKind,
      quantity: row.quantity != null ? String(row.quantity) : "",
      unit: row.unit ?? "",
      weightGrams: row.weightGrams != null ? String(row.weightGrams) : "",
    })),
  };
}

function dash(value: string): string {
  return value.trim() ? escapeHtml(value) : "—";
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p class="empty">${escapeHtml("—")}</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

export function renderDrugCaseReportHtml(report: DrugCaseReportV1): string {
  const locale = report.locale;
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const maskingLabel = report.maskingMode === "FULL" ? t("di.export.full") : t("di.export.masked");
  const official = t("di.export.officialUse");
  const noData = t("di.export.noData");

  const peopleRows = report.people.map((row) => [
    dash(row.displayName),
    dash(row.role),
    dash(row.aliases.join(", ")),
    dash(row.identifiers.map((id) => `${id.type}: ${id.value}`).join(" · ")),
  ]);
  const phoneRows = report.phones.map((row) => [dash(row.number), dash(row.personName)]);
  const simRows = report.sims.map((row) => [dash(row.iccid), dash(row.imsi), dash(row.carrier), dash(row.personName)]);
  const deviceRows = report.devices.map((row) => [
    dash([row.brand, row.model].filter(Boolean).join(" ")),
    dash(row.imei1),
    dash(row.imei2),
    dash(row.serial),
    dash(row.personName),
  ]);
  const vehicleRows = report.vehicles.map((row) => [dash(row.plate), dash(row.province), dash(row.vin), dash(row.type), dash(row.personName)]);
  const locationRows = report.locations.map((row) => [
    dash(row.role),
    dash(row.name),
    dash(row.province),
    dash(row.district),
    dash(row.latitude),
    dash(row.longitude),
  ]);
  const seizureRows = report.seizures.map((row) => [
    dash(row.category),
    dash(row.measurementKind),
    dash(row.quantity),
    dash(row.unit),
    dash(row.weightGrams),
  ]);

  const empty = (rows: string[][]) => (rows.length === 0 ? `<p class="empty">${escapeHtml(noData)}</p>` : "");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t("di.export.caseReport"))} — ${escapeHtml(report.case.caseNumber)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; @bottom-right { content: counter(page); } }
  body { font-family: "Sarabun", "Noto Sans Thai", "Thonburi", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 18px 0 8px; page-break-after: avoid; }
  .meta, footer { color: #333; font-size: 11px; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; font-weight: 600; }
  .empty { color: #555; margin: 0 0 8px; }
  footer { border-top: 1px solid #111; margin-top: 24px; padding-top: 8px; }
  @media print { header, h2 { page-break-after: avoid; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(t("di.export.caseReportTitle"))}</h1>
  <p class="meta">${escapeHtml(report.case.caseNumber)} · ${escapeHtml(report.case.status)} · ${escapeHtml(maskingLabel)}</p>
  <p class="meta">${escapeHtml(t("di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
</header>
<section>
  <h2>1. ${escapeHtml(t("di.export.sectionCase"))}</h2>
  <table>
    <tbody>
      <tr><th scope="row">${escapeHtml(t("di.export.caseNumber"))}</th><td>${dash(report.case.caseNumber)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.caseTitle"))}</th><td>${dash(report.case.title)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.status"))}</th><td>${dash(report.case.status)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.arrestDate"))}</th><td>${dash([report.case.arrestDate, report.case.arrestTime].filter(Boolean).join(" "))}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.reportingUnit"))}</th><td>${dash(report.case.reportingUnit)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.leadUnit"))}</th><td>${dash(report.case.leadUnit)}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.field.province"))}</th><td>${dash([report.case.province, report.case.district, report.case.locationName].filter(Boolean).join(" / "))}</td></tr>
      <tr><th scope="row">${escapeHtml(t("di.export.caseSummary"))}</th><td>${report.case.narrative ? escapeHtmlMultiline(report.case.narrative) : "—"}</td></tr>
    </tbody>
  </table>
</section>
<section>
  <h2>2. ${escapeHtml(t("di.export.sectionPeople"))}</h2>
  ${peopleRows.length ? table([t("di.export.personName"), t("di.export.role"), t("di.export.aliases"), t("di.export.identifiers")], peopleRows) : empty(peopleRows)}
</section>
<section>
  <h2>3. ${escapeHtml(t("di.export.sectionPhones"))}</h2>
  ${phoneRows.length ? table([t("di.export.phones"), t("di.export.personName")], phoneRows) : empty(phoneRows)}
  <h2>${escapeHtml(t("di.export.sectionSims"))}</h2>
  ${simRows.length ? table(["ICCID", "IMSI", t("di.export.carrier"), t("di.export.personName")], simRows) : empty(simRows)}
  <h2>${escapeHtml(t("di.export.sectionDevices"))}</h2>
  ${deviceRows.length ? table([t("di.export.device"), "IMEI1", "IMEI2", t("di.export.serial"), t("di.export.personName")], deviceRows) : empty(deviceRows)}
</section>
<section>
  <h2>4. ${escapeHtml(t("di.export.sectionVehicles"))}</h2>
  ${vehicleRows.length ? table([t("di.export.plate"), t("di.field.province"), "VIN", t("di.export.vehicleType"), t("di.export.personName")], vehicleRows) : empty(vehicleRows)}
  <h2>${escapeHtml(t("di.export.sectionLocations"))}</h2>
  ${locationRows.length ? table([t("di.export.role"), t("di.export.locationName"), t("di.field.province"), t("di.export.district"), t("di.export.latitude"), t("di.export.longitude")], locationRows) : empty(locationRows)}
</section>
<section>
  <h2>5. ${escapeHtml(t("di.export.sectionSeizures"))}</h2>
  ${seizureRows.length ? table([t("di.export.category"), t("di.export.measurementKind"), t("di.export.quantity"), t("di.export.unit"), t("di.export.weightGrams")], seizureRows) : empty(seizureRows)}
</section>
<section>
  <h2>6. ${escapeHtml(t("di.export.sectionDerived"))}</h2>
  <p class="empty">${escapeHtml(t("di.export.noInferredIncluded"))}</p>
</section>
<footer>
  <p>${escapeHtml(t("di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
  <p>${escapeHtml(t("di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)} · ${escapeHtml(maskingLabel)}</p>
  <p>${escapeHtml(t("di.export.dataCurrent"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(report.systemName)} · ${escapeHtml(official)}</p>
</footer>
</body>
</html>`;
}
