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

export interface AliasDraft {
  key: string;
  /** The alias text — trimmed before sending to the API. */
  fullName: string;
}

export interface IdentifierDraft {
  key: string;
  type: string;
  value: string;
  notes: string;
}

export interface NetworkRoleDraft {
  key: string;
  role: string;
  source: string;
  verificationStatus: string;
  note: string;
}

export interface NetworkMembershipDraft {
  key: string;
  /** Resolved canonical group id — null if not yet resolved or manual. */
  networkGroupId: string | null;
  /** Display name for the group (resolved from id or typed manually). */
  networkGroupName: string;
  source: string;
  note: string;
}

export interface PersonDraft {
  key: string;
  /** Set once the duplicate-check dialog resolves to "use existing" — clears newPerson fields from the submit payload. */
  existingPersonId: string | null;
  existingPersonLabel: string | null;
  primaryFullName: string;
  /** DI-7.2: dedicated "ชื่อเล่น" — separate from aliases. */
  nickname: string;
  nationality: string;
  /** DI-7.2: MALE / FEMALE / UNKNOWN — never inferred. */
  sex: string;
  dateOfBirth: string;
  /** DI-7.2: used only when dateOfBirth is unknown. */
  approximateAge: string;
  role: string;
  linkedOfficerId: string;
  notes: string;
  /** DI-7.1 fix: secondary aliases — each persisted as DrugPersonAlias, never comma-joined. */
  aliases: AliasDraft[];
  identifiers: IdentifierDraft[];
  phones: PhoneDraft[];
  sims: SimDraft[];
  devices: DeviceDraft[];
  vehicles: VehicleDraft[];
  /** DI-7.3: network-role assertions (each with provenance + verification). */
  networkRoles: NetworkRoleDraft[];
  /** DI-7.2: network/group memberships. */
  networkMemberships: NetworkMembershipDraft[];
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

/** DI-7.6: หน่วยร่วมจับกุม — one canonical-or-manual unit row, with a role/note. */
export interface ParticipatingUnitDraft {
  key: string;
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  useManualUnit: boolean;
  manualUnitText: string;
  role: string;
  note: string;
}

/** DI-7.6: ชุดจับกุม member — internal officer (by officerId) or manual external fields. */
export interface CaseOfficerDraft {
  key: string;
  /** When set, this row is an internal officer picked via "เลือกจากกำลังพล". */
  officerId: string | null;
  /** Display label for the picked internal officer (rank + name + unit) — never sent to the API, UI convenience only. */
  officerLabel: string | null;
  manualRank: string;
  manualFullName: string;
  manualPosition: string;
  manualUnitText: string;
  role: string;
  note: string;
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
  /**
   * DI-7.1: "หน่วยอื่น / ไม่พบหน่วย" fallback.
   * When true, the canonical org hierarchy IDs are cleared and `manualUnitText` is
   * persisted as `reportingUnitText`. Never creates an org master record.
   */
  useManualUnit: boolean;
  /** Free text displayed with "ข้อมูลหน่วยที่กรอกเอง" label — only used when useManualUnit is true. */
  manualUnitText: string;
  /**
   * DI-7.6: หน่วยจับกุมหลัก — a DISTINCT concept from the reporting-unit
   * fields above (Section 0: reporting unit vs. lead arrest unit). Same
   * canonical-picker + manual-fallback shape. `sameAsReportingUnit` is a
   * convenience toggle (Section 7's "ใช้หน่วยเดียวกับหน่วยรายงาน") — when
   * true, buildCreateCaseRequest() copies the reporting-unit fields into the
   * lead-unit wire fields at submit time rather than duplicating state here.
   */
  sameAsReportingUnit: boolean;
  leadHeadquartersId: number | null;
  leadHeadquartersText: string;
  leadRegionId: number | null;
  leadRegionText: string;
  leadBattalionId: number | null;
  leadBattalionText: string;
  leadCompanyId: number | null;
  leadCompanyText: string;
  useLeadManualUnit: boolean;
  leadManualUnitText: string;
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
  /** DI-7.6: หน่วยร่วมจับกุม — zero or many. */
  participatingUnits: ParticipatingUnitDraft[];
  /** DI-7.6: ชุดจับกุม — zero or many, entirely optional (Section 9). */
  officers: CaseOfficerDraft[];
}

export function createEmptyPersonDraft(): PersonDraft {
  return {
    key: nextDraftKey(),
    existingPersonId: null,
    existingPersonLabel: null,
    primaryFullName: "",
    nickname: "",
    nationality: "",
    sex: "",
    dateOfBirth: "",
    approximateAge: "",
    role: "SUSPECT",
    linkedOfficerId: "",
    notes: "",
    aliases: [],
    identifiers: [],
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
    networkRoles: [],
    networkMemberships: [],
  };
}

export function createEmptyAliasDraft(): AliasDraft {
  return { key: nextDraftKey(), fullName: "" };
}

export function createEmptyNetworkRoleDraft(): NetworkRoleDraft {
  return { key: nextDraftKey(), role: "", source: "", verificationStatus: "UNVERIFIED", note: "" };
}

export function createEmptyNetworkMembershipDraft(): NetworkMembershipDraft {
  return { key: nextDraftKey(), networkGroupId: null, networkGroupName: "", source: "", note: "" };
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

export function createEmptyParticipatingUnitDraft(): ParticipatingUnitDraft {
  return {
    key: nextDraftKey(),
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    useManualUnit: false,
    manualUnitText: "",
    role: "PARTICIPATING",
    note: "",
  };
}

export function createEmptyCaseOfficerDraft(): CaseOfficerDraft {
  return {
    key: nextDraftKey(),
    officerId: null,
    officerLabel: null,
    manualRank: "",
    manualFullName: "",
    manualPosition: "",
    manualUnitText: "",
    role: "ARRESTING_OFFICER",
    note: "",
  };
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
    useManualUnit: false,
    manualUnitText: "",
    sameAsReportingUnit: false,
    leadHeadquartersId: null,
    leadHeadquartersText: "",
    leadRegionId: null,
    leadRegionText: "",
    leadBattalionId: null,
    leadBattalionText: "",
    leadCompanyId: null,
    leadCompanyText: "",
    useLeadManualUnit: false,
    leadManualUnitText: "",
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
    participatingUnits: [],
    officers: [],
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

  const approximateAgeNum = toNumberOrNull(person.approximateAge);

  return {
    ...base,
    newPerson: {
      primaryFullName: person.primaryFullName.trim(),
      nickname: person.nickname.trim() || null,
      nationality: person.nationality.trim() || null,
      sex: person.sex.trim() || null,
      dateOfBirth: toApiDate(person.dateOfBirth),
      approximateAge: approximateAgeNum,
      notes: null,
      aliases: person.aliases.filter((a) => a.fullName.trim()).map((a) => ({ fullName: a.fullName.trim() })),
      identifiers: person.identifiers.filter((i) => i.value.trim()).map((i) => ({ type: i.type, value: i.value.trim(), notes: i.notes.trim() || null })),
      networkRoles: person.networkRoles
        .filter((r) => r.role.trim())
        .map((r) => ({
          role: r.role.trim(),
          source: r.source.trim() || null,
          verificationStatus: r.verificationStatus || "UNVERIFIED",
          note: r.note.trim() || null,
        })),
      networkMemberships: person.networkMemberships
        .filter((m) => m.networkGroupId || m.networkGroupName.trim())
        .map((m) => ({
          networkGroupId: m.networkGroupId || null,
          networkGroupName: m.networkGroupName.trim(),
          source: m.source.trim() || null,
          note: m.note.trim() || null,
        })),
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
    // DI-7.1: when the operator chose "หน่วยอื่น / ไม่พบหน่วย", clear canonical IDs and use the manual text only.
    headquartersId: draft.useManualUnit ? null : draft.headquartersId,
    regionId: draft.useManualUnit ? null : draft.regionId,
    battalionId: draft.useManualUnit ? null : draft.battalionId,
    companyId: draft.useManualUnit ? null : draft.companyId,
    reportingUnitText: draft.useManualUnit
      ? (draft.manualUnitText.trim() || null)
      : (draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || null),
    // DI-7.6 Section 7: "ใช้หน่วยเดียวกับหน่วยรายงาน" — when checked, copy the
    // ALREADY-RESOLVED reporting-unit fields verbatim rather than requiring
    // the operator to duplicate the picker selection.
    ...(draft.sameAsReportingUnit
      ? {
          leadHeadquartersId: draft.useManualUnit ? null : draft.headquartersId,
          leadRegionId: draft.useManualUnit ? null : draft.regionId,
          leadBattalionId: draft.useManualUnit ? null : draft.battalionId,
          leadCompanyId: draft.useManualUnit ? null : draft.companyId,
          leadUnitText: draft.useManualUnit
            ? (draft.manualUnitText.trim() || null)
            : (draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || null),
        }
      : {
          leadHeadquartersId: draft.useLeadManualUnit ? null : draft.leadHeadquartersId,
          leadRegionId: draft.useLeadManualUnit ? null : draft.leadRegionId,
          leadBattalionId: draft.useLeadManualUnit ? null : draft.leadBattalionId,
          leadCompanyId: draft.useLeadManualUnit ? null : draft.leadCompanyId,
          leadUnitText: draft.useLeadManualUnit
            ? (draft.leadManualUnitText.trim() || null)
            : (draft.leadCompanyText || draft.leadBattalionText || draft.leadRegionText || draft.leadHeadquartersText || null),
        }),
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
    participatingUnits: draft.participatingUnits
      // A row with no unit chosen (canonical or manual) and no id at all is
      // an untouched "+ เพิ่มหน่วยร่วมจับกุม" row — dropped rather than sent as
      // an ambiguous empty unit (mirrors the seizedItems filter above).
      .filter((u) => (u.useManualUnit ? u.manualUnitText.trim() : u.headquartersId || u.regionId || u.battalionId || u.companyId))
      .map((u) => ({
        headquartersId: u.useManualUnit ? null : u.headquartersId,
        regionId: u.useManualUnit ? null : u.regionId,
        battalionId: u.useManualUnit ? null : u.battalionId,
        companyId: u.useManualUnit ? null : u.companyId,
        unitText: u.useManualUnit
          ? (u.manualUnitText.trim() || null)
          : (u.companyText || u.battalionText || u.regionText || u.headquartersText || null),
        role: u.role,
        note: u.note.trim() || null,
      })),
    officers: draft.officers
      // An untouched "+ เพิ่มเจ้าหน้าที่" row (no internal officer picked, no manual name typed) is dropped — Section 9: the team section is entirely optional.
      .filter((o) => o.officerId || o.manualFullName.trim())
      .map((o) => ({
        officerId: o.officerId,
        manualRank: o.officerId ? null : (o.manualRank.trim() || null),
        manualFullName: o.officerId ? null : (o.manualFullName.trim() || null),
        manualPosition: o.officerId ? null : (o.manualPosition.trim() || null),
        manualUnitText: o.officerId ? null : (o.manualUnitText.trim() || null),
        role: o.role,
        note: o.note.trim() || null,
      })),
    actorId,
    actorName,
  };
}
