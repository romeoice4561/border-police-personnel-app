/**
 * Create Case draft types (Phase DI-1 Round 2, Section 6-14).
 *
 * Client-side draft shape for the multi-step Create Case form — every field
 * is a plain string/primitive (dates as DD/MM/YYYY Thai strings, matching
 * ThaiDatePicker's wire format) until submit time, when
 * buildCreateCaseRequest() converts the whole draft into the
 * DrugCaseCreateRequest the API expects. Mirrors useOfficerWorkspace's
 * ProfileDraft convention: draft state stays string-typed and UI-friendly;
 * parsing/typing happens once, at the boundary.
 */

import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import { kilogramsToGrams } from "@/lib/drug_intelligence/drug_seized_item_analytics";
import type { DrugCaseCreateRequest, DrugCaseCreatePersonInput } from "@/lib/drug_intelligence/drug_intelligence_client";

let draftKeyCounter = 0;
/** Stable React keys for repeatable rows — never persisted, never sent to the API. */
export function nextDraftKey(): string {
  draftKeyCounter += 1;
  return `draft-${draftKeyCounter}-${Date.now()}`;
}

export interface PhoneDraft {
  key: string;
  rawInput: string;
  firstSeenAt: string;
  lastSeenAt: string;
  notes: string;
}

export interface SimDraft {
  key: string;
  iccid: string;
  imsi: string;
  carrier: string;
  firstSeenAt: string;
  lastSeenAt: string;
  notes: string;
}

export interface DeviceDraft {
  key: string;
  brand: string;
  model: string;
  serialNumber: string;
  imei1: string;
  imei2: string;
  firstSeenAt: string;
  lastSeenAt: string;
  notes: string;
}

export interface VehicleDraft {
  key: string;
  registrationNumber: string;
  registrationProvince: string;
  vehicleType: string;
  brand: string;
  model: string;
  color: string;
  vin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  notes: string;
}

export interface IdentifierDraft {
  key: string;
  type: string;
  value: string;
  notes: string;
}

export interface PersonDraft {
  key: string;
  /** Set once the duplicate-check dialog resolves to "use existing" — clears newPerson fields from the submit payload. */
  existingPersonId: string | null;
  existingPersonLabel: string | null;
  primaryFullName: string;
  nationality: string;
  dateOfBirth: string;
  role: string;
  linkedOfficerId: string;
  notes: string;
  identifiers: IdentifierDraft[];
  phones: PhoneDraft[];
  sims: SimDraft[];
  devices: DeviceDraft[];
  vehicles: VehicleDraft[];
}

export interface SeizedItemDraft {
  key: string;
  /** Canonical analytics key (Phase DI-3.1) — a DrugCategory value, or "" until chosen. */
  drugCategory: string;
  /** Free-text substance name, populated only when drugCategory = "OTHER". */
  otherDrugCategoryLabel: string;
  /** COUNT or MASS — which of quantity/weightKilograms below the user is entering. */
  measurementKind: string;
  drugType: string;
  subtype: string;
  quantity: string;
  unit: string;
  /** Kilograms, as the user types it — converted to grams at submit time (Section 7: never store kilograms). */
  weightKilograms: string;
  packageCount: string;
  notes: string;
}

export interface LocationDraft {
  key: string;
  name: string;
  addressText: string;
  province: string;
  district: string;
  subdistrict: string;
  latitude: string;
  longitude: string;
  role: string;
  notes: string;
}

export interface CreateCaseDraft {
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: string;
  arrestTime: string;
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  province: string;
  district: string;
  subdistrict: string;
  locationName: string;
  latitude: string;
  longitude: string;
  narrative: string;
  persons: PersonDraft[];
  seizedItems: SeizedItemDraft[];
  locations: LocationDraft[];
}

export function createEmptyPersonDraft(): PersonDraft {
  return {
    key: nextDraftKey(),
    existingPersonId: null,
    existingPersonLabel: null,
    primaryFullName: "",
    nationality: "",
    dateOfBirth: "",
    role: "SUSPECT",
    linkedOfficerId: "",
    notes: "",
    identifiers: [],
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

export function createEmptySeizedItemDraft(): SeizedItemDraft {
  return {
    key: nextDraftKey(),
    drugCategory: "",
    otherDrugCategoryLabel: "",
    measurementKind: "",
    drugType: "",
    subtype: "",
    quantity: "",
    unit: "",
    weightKilograms: "",
    packageCount: "",
    notes: "",
  };
}

export function createEmptyLocationDraft(): LocationDraft {
  return { key: nextDraftKey(), name: "", addressText: "", province: "", district: "", subdistrict: "", latitude: "", longitude: "", role: "ARREST_LOCATION", notes: "" };
}

export function createEmptyDraft(): CreateCaseDraft {
  return {
    caseNumber: "",
    title: "",
    status: "OPEN",
    arrestDate: "",
    arrestTime: "",
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    province: "",
    district: "",
    subdistrict: "",
    locationName: "",
    latitude: "",
    longitude: "",
    narrative: "",
    persons: [],
    seizedItems: [],
    locations: [],
  };
}

/**
 * Normalizes a ThaiDatePicker draft value into the wire format the API's
 * Zod `thaiPersonnelDate` schema accepts (DD/MM/YYYY Buddhist-Era — the
 * SAME "for API payloads" format normalizeThaiPersonnelDateForSave produces
 * for every other Thai-date field in this codebase, e.g. Manual Personnel
 * Entry's dateOfBirth/appointmentDate — never converted to ISO client-side).
 */
function toApiDate(thaiDate: string): string | null {
  if (!thaiDate.trim()) return null;
  return normalizeThaiPersonnelDateForSave(thaiDate);
}

function toNumberOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Section 14/2's validation set — every case this UI must reject BEFORE calling the API, so the user never round-trips to the server for an obvious mistake. */
export interface ValidationError {
  step: string;
  message: string;
}

export function validateDraft(draft: CreateCaseDraft): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!draft.caseNumber.trim()) errors.push({ step: "arrest", message: "กรุณากรอกเลขคดี" });
  if (!draft.title.trim()) errors.push({ step: "arrest", message: "กรุณากรอกชื่อ/หัวข้อคดี" });

  draft.persons.forEach((person, index) => {
    if (!person.existingPersonId && !person.primaryFullName.trim()) {
      errors.push({ step: "persons", message: `บุคคลลำดับที่ ${index + 1}: กรุณากรอกชื่อ-นามสกุล` });
    }
  });

  draft.seizedItems.forEach((item, index) => {
    if (!item.drugType.trim()) errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาระบุประเภท` });
    if (!item.drugCategory) errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาเลือกประเภทของกลาง` });
    if (item.drugCategory === "OTHER" && !item.otherDrugCategoryLabel.trim()) {
      errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาระบุชื่อสารเมื่อเลือก "อื่น ๆ"` });
    }
    if (!item.measurementKind) {
      errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาเลือกหน่วยวัด (จำนวนนับ/น้ำหนัก)` });
    } else if (item.measurementKind === "COUNT" && !item.quantity.trim()) {
      errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาระบุจำนวน` });
    } else if (item.measurementKind === "MASS" && !item.weightKilograms.trim()) {
      errors.push({ step: "seized", message: `ของกลางลำดับที่ ${index + 1}: กรุณาระบุน้ำหนัก` });
    }
  });

  return errors;
}

function personToRequest(person: PersonDraft): DrugCaseCreatePersonInput {
  const base = {
    role: person.role,
    linkedOfficerId: person.linkedOfficerId.trim() || null,
    notes: person.notes.trim() || null,
    phones: person.phones
      .filter((p) => p.rawInput.trim())
      .map((p) => ({
        rawInput: p.rawInput.trim(),
        firstSeenAt: toApiDate(p.firstSeenAt),
        lastSeenAt: toApiDate(p.lastSeenAt),
        notes: p.notes.trim() || null,
      })),
    sims: person.sims
      .filter((s) => s.iccid.trim() || s.imsi.trim())
      .map((s) => ({
        iccid: s.iccid.trim() || null,
        imsi: s.imsi.trim() || null,
        carrier: s.carrier.trim() || null,
        firstSeenAt: toApiDate(s.firstSeenAt),
        lastSeenAt: toApiDate(s.lastSeenAt),
        notes: s.notes.trim() || null,
      })),
    devices: person.devices
      .filter((d) => d.imei1.trim() || d.imei2.trim() || d.serialNumber.trim())
      .map((d) => ({
        brand: d.brand.trim() || null,
        model: d.model.trim() || null,
        serialNumber: d.serialNumber.trim() || null,
        imei1: d.imei1.trim() || null,
        imei2: d.imei2.trim() || null,
        firstSeenAt: toApiDate(d.firstSeenAt),
        lastSeenAt: toApiDate(d.lastSeenAt),
        notes: d.notes.trim() || null,
      })),
    vehicles: person.vehicles
      .filter((v) => v.registrationNumber.trim() || v.vin.trim())
      .map((v) => ({
        registrationNumber: v.registrationNumber.trim() || null,
        registrationProvince: v.registrationProvince.trim() || null,
        vehicleType: v.vehicleType.trim() || null,
        brand: v.brand.trim() || null,
        model: v.model.trim() || null,
        color: v.color.trim() || null,
        vin: v.vin.trim() || null,
        firstSeenAt: toApiDate(v.firstSeenAt),
        lastSeenAt: toApiDate(v.lastSeenAt),
        notes: v.notes.trim() || null,
      })),
  };

  if (person.existingPersonId) {
    return { ...base, existingPersonId: person.existingPersonId };
  }

  return {
    ...base,
    newPerson: {
      primaryFullName: person.primaryFullName.trim(),
      nationality: person.nationality.trim() || null,
      dateOfBirth: toApiDate(person.dateOfBirth),
      notes: null,
      identifiers: person.identifiers.filter((i) => i.value.trim()).map((i) => ({ type: i.type, value: i.value.trim(), notes: i.notes.trim() || null })),
    },
  };
}

export function buildCreateCaseRequest(draft: CreateCaseDraft, actorId: string, actorName: string): DrugCaseCreateRequest {
  return {
    caseNumber: draft.caseNumber.trim(),
    title: draft.title.trim(),
    status: draft.status,
    arrestDate: toApiDate(draft.arrestDate),
    arrestTime: draft.arrestTime.trim() || null,
    headquartersId: draft.headquartersId,
    regionId: draft.regionId,
    battalionId: draft.battalionId,
    companyId: draft.companyId,
    reportingUnitText: draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || null,
    province: draft.province.trim() || null,
    district: draft.district.trim() || null,
    subdistrict: draft.subdistrict.trim() || null,
    locationName: draft.locationName.trim() || null,
    latitude: toNumberOrNull(draft.latitude),
    longitude: toNumberOrNull(draft.longitude),
    narrative: draft.narrative.trim() || null,
    persons: draft.persons.map(personToRequest),
    seizedItems: draft.seizedItems
      .filter((item) => item.drugType.trim())
      .map((item) => {
        const isCount = item.measurementKind === "COUNT";
        const weightKilograms = toNumberOrNull(item.weightKilograms);
        return {
          drugCategory: item.drugCategory,
          otherDrugCategoryLabel: item.drugCategory === "OTHER" ? item.otherDrugCategoryLabel.trim() || null : null,
          measurementKind: item.measurementKind,
          drugType: item.drugType.trim(),
          subtype: item.subtype.trim() || null,
          quantity: isCount ? toNumberOrNull(item.quantity) : null,
          unit: item.unit.trim() || null,
          // Section 7: the UI collects mass in kilograms; the client boundary converts to
          // the single canonical persisted unit (grams) here — never stored as kilograms.
          weightGrams: !isCount && weightKilograms !== null ? kilogramsToGrams(weightKilograms) : null,
          packageCount: item.packageCount.trim() ? Number(item.packageCount) : null,
          notes: item.notes.trim() || null,
        };
      }),
    locations: draft.locations.map((loc) => ({
      name: loc.name.trim() || null,
      addressText: loc.addressText.trim() || null,
      province: loc.province.trim() || null,
      district: loc.district.trim() || null,
      subdistrict: loc.subdistrict.trim() || null,
      latitude: toNumberOrNull(loc.latitude),
      longitude: toNumberOrNull(loc.longitude),
      role: loc.role,
      notes: loc.notes.trim() || null,
    })),
    actorId,
    actorName,
  };
}
