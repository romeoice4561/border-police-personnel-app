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
import { LATITUDE_MIN, LATITUDE_MAX, LONGITUDE_MIN, LONGITUDE_MAX } from "@/lib/drug_intelligence/drug_coordinate_validation";
import { participatingUnitHasSelection } from "@/lib/drug_intelligence/resolve_bpp_org_selection";
import { isValidThaiTime } from "@/lib/drug_intelligence/thai_time";
import { normalizeInvestigatorContactName, normalizeInvestigatorContactPhone } from "@/lib/drug_intelligence/investigator_contact";
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

export interface SeizedVehicleDraft {
  key: string;
  registrationNumber: string;
  registrationProvince: string;
  vehicleType: string;
  brand: string;
  model: string;
  color: string;
  vin: string;
  notes: string;
}

export interface SeizedDeviceDraft {
  key: string;
  brand: string;
  model: string;
  serialNumber: string;
  imei1: string;
  imei2: string;
  associatedPhone: string;
  notes: string;
}

export interface SeizedSimDraft {
  key: string;
  iccid: string;
  imsi: string;
  carrier: string;
  associatedPhone: string;
  notes: string;
}

export interface SeizedFirearmDraft {
  key: string;
  firearmType: string;
  brand: string;
  model: string;
  serialNumber: string;
  caliberOrSize: string;
  quantity: string;
  recordedDescription: string;
  notes: string;
}

export interface SeizedOtherDraft {
  key: string;
  label: string;
  quantity: string;
  unit: string;
  serialNumber: string;
  recordedDescription: string;
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
  /**
   * UI-only: whether our reporting unit was the lead arrest unit or a
   * supporting/integrated unit. Never sent to the API — maps onto
   * `sameAsReportingUnit` plus the existing lead-unit fields.
   */
  ourArrestRole: "" | "LEAD" | "SUPPORTING";
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
  investigatorName: string;
  investigatorPhone: string;
  persons: PersonDraft[];
  seizedItems: SeizedItemDraft[];
  seizedVehicles: SeizedVehicleDraft[];
  seizedDevices: SeizedDeviceDraft[];
  seizedSims: SeizedSimDraft[];
  seizedFirearms: SeizedFirearmDraft[];
  seizedOtherItems: SeizedOtherDraft[];
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

export function createEmptySeizedVehicleDraft(): SeizedVehicleDraft {
  return {
    key: nextDraftKey(),
    registrationNumber: "",
    registrationProvince: "",
    vehicleType: "",
    brand: "",
    model: "",
    color: "",
    vin: "",
    notes: "",
  };
}

export function createEmptySeizedDeviceDraft(): SeizedDeviceDraft {
  return {
    key: nextDraftKey(),
    brand: "",
    model: "",
    serialNumber: "",
    imei1: "",
    imei2: "",
    associatedPhone: "",
    notes: "",
  };
}

export function createEmptySeizedSimDraft(): SeizedSimDraft {
  return { key: nextDraftKey(), iccid: "", imsi: "", carrier: "", associatedPhone: "", notes: "" };
}

export function createEmptySeizedFirearmDraft(): SeizedFirearmDraft {
  return {
    key: nextDraftKey(),
    firearmType: "",
    brand: "",
    model: "",
    serialNumber: "",
    caliberOrSize: "",
    quantity: "",
    recordedDescription: "",
    notes: "",
  };
}

export function createEmptySeizedOtherDraft(): SeizedOtherDraft {
  return { key: nextDraftKey(), label: "", quantity: "", unit: "", serialNumber: "", recordedDescription: "", notes: "" };
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
    ourArrestRole: "",
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
    investigatorName: "",
    investigatorPhone: "",
    persons: [],
    seizedItems: [],
    seizedVehicles: [],
    seizedDevices: [],
    seizedSims: [],
    seizedFirearms: [],
    seizedOtherItems: [],
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

function hasAnyText(...values: string[]): boolean {
  return values.some((value) => value.trim() !== "");
}

export function seizedVehicleHasInput(item: SeizedVehicleDraft): boolean {
  return hasAnyText(item.registrationNumber, item.registrationProvince, item.vehicleType, item.brand, item.model, item.color, item.vin, item.notes);
}

export function seizedDeviceHasInput(item: SeizedDeviceDraft): boolean {
  return hasAnyText(item.brand, item.model, item.serialNumber, item.imei1, item.imei2, item.associatedPhone, item.notes);
}

export function seizedSimHasInput(item: SeizedSimDraft): boolean {
  return hasAnyText(item.iccid, item.imsi, item.carrier, item.associatedPhone, item.notes);
}

export function seizedFirearmHasInput(item: SeizedFirearmDraft): boolean {
  return hasAnyText(item.firearmType, item.brand, item.model, item.serialNumber, item.caliberOrSize, item.quantity, item.recordedDescription, item.notes);
}

export function seizedOtherHasInput(item: SeizedOtherDraft): boolean {
  return hasAnyText(item.label, item.quantity, item.unit, item.serialNumber, item.recordedDescription, item.notes);
}

export interface EvidenceReviewGroup {
  key: string;
  count: number;
  lines: string[];
}

export function evidenceReviewGroups(draft: CreateCaseDraft): EvidenceReviewGroup[] {
  const drugs = draft.seizedItems.filter((item) => item.drugType.trim() || item.drugCategory);
  const vehicles = draft.seizedVehicles.filter(seizedVehicleHasInput);
  const devices = draft.seizedDevices.filter(seizedDeviceHasInput);
  const sims = draft.seizedSims.filter(seizedSimHasInput);
  const firearms = draft.seizedFirearms.filter(seizedFirearmHasInput);
  const other = draft.seizedOtherItems.filter(seizedOtherHasInput);
  return [
    {
      key: "drugs",
      count: drugs.length,
      lines: drugs.map((item) => {
        const amount = item.measurementKind === "MASS" ? (item.weightKilograms ? `${item.weightKilograms} กก.` : "") : `${item.quantity || ""} ${item.unit || ""}`.trim();
        return `${item.drugType || "—"} ${amount}`.trim();
      }),
    },
    {
      key: "vehicles",
      count: vehicles.length,
      lines: vehicles.map((item) => {
        const name = [item.brand, item.model].filter((part) => part.trim()).join(" ") || item.vehicleType || "ยานพาหนะ";
        const plate = item.registrationNumber.trim() || item.vin.trim();
        return plate ? `${name} — ${plate}` : name;
      }),
    },
    {
      key: "devices",
      count: devices.length,
      lines: devices.map((item) => {
        const name = [item.brand, item.model].filter((part) => part.trim()).join(" ") || "อุปกรณ์";
        const id = item.imei1.trim() || item.serialNumber.trim() || item.associatedPhone.trim();
        return id ? `${name} — ${id}` : name;
      }),
    },
    {
      key: "sims",
      count: sims.length,
      lines: sims.map((item) => item.iccid.trim() || item.associatedPhone.trim() || item.imsi.trim() || "SIM"),
    },
    {
      key: "firearms",
      count: firearms.length,
      lines: firearms.map((item) => {
        const qty = item.quantity.trim() ? ` × ${item.quantity.trim()}` : "";
        return `${item.firearmType.trim() || "อาวุธปืน"}${qty}`;
      }),
    },
    {
      key: "other",
      count: other.length,
      lines: other.map((item) => {
        const qty = [item.quantity, item.unit].filter((part) => part.trim()).join(" ");
        return qty ? `${item.label.trim() || "ของกลาง"} — ${qty}` : (item.label.trim() || "ของกลาง");
      }),
    },
  ];
}

/** Section 14/2's validation set — every case this UI must reject BEFORE calling the API, so the user never round-trips to the server for an obvious mistake. */
export interface ValidationError {
  step: string;
  message: string;
  field?: string;
}

/**
 * Thai-friendly pre-flight check for one lat/long pair. Mirrors the RULE
 * enforced by withCoordinatePair() (both-or-neither; -90..90 / -180..180)
 * using its own exported range constants as the single source of truth —
 * this does not re-implement the rule, it only front-runs it with a
 * friendlier message so the user isn't round-tripped to the server for an
 * obvious mistake. The server-side Zod schema remains authoritative.
 */
function validateCoordinatePair(latitude: string, longitude: string, step: string, label: string, errors: ValidationError[]): void {
  const hasLat = latitude.trim() !== "";
  const hasLng = longitude.trim() !== "";
  if (hasLat !== hasLng) {
    errors.push({ step, message: `${label}: ต้องกรอกละติจูดและลองจิจูดพร้อมกันทั้งคู่ หรือเว้นว่างทั้งสองช่อง` });
    return;
  }
  if (hasLat) {
    const lat = Number(latitude);
    if (!Number.isFinite(lat) || lat < LATITUDE_MIN || lat > LATITUDE_MAX) {
      errors.push({ step, message: `${label}: ละติจูดต้องอยู่ระหว่าง ${LATITUDE_MIN} ถึง ${LATITUDE_MAX}` });
    }
  }
  if (hasLng) {
    const lng = Number(longitude);
    if (!Number.isFinite(lng) || lng < LONGITUDE_MIN || lng > LONGITUDE_MAX) {
      errors.push({ step, message: `${label}: ลองจิจูดต้องอยู่ระหว่าง ${LONGITUDE_MIN} ถึง ${LONGITUDE_MAX}` });
    }
  }
}

export function validateDraft(draft: CreateCaseDraft): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!draft.caseNumber.trim()) errors.push({ step: "arrest", field: "caseNumber", message: "กรุณากรอกบันทึกคดี" });
  if (!draft.title.trim()) errors.push({ step: "arrest", field: "title", message: "กรุณากรอกชื่อ/หัวข้อคดี" });
  if (draft.arrestTime.trim() && !isValidThaiTime(draft.arrestTime)) {
    errors.push({ step: "arrest", field: "arrestTime", message: "กรุณาเลือกเวลาให้ถูกต้อง หรือล้างเวลา" });
  }

  validateCoordinatePair(draft.latitude, draft.longitude, "arrest", "พิกัดจุดจับกุม", errors);
  draft.locations.forEach((location, index) => {
    validateCoordinatePair(location.latitude, location.longitude, "locations", `สถานที่ลำดับที่ ${index + 1}`, errors);
  });

  draft.persons.forEach((person, index) => {
    if (!person.existingPersonId && !person.primaryFullName.trim()) {
      errors.push({ step: "persons", message: `บุคคลลำดับที่ ${index + 1}: กรุณากรอกชื่อ-นามสกุล` });
    }
  });

  draft.seizedItems.forEach((item, index) => {
    if (!item.drugType.trim()) errors.push({ step: "seized", message: `ยาเสพติด #${index + 1}: กรุณาระบุประเภท` });
    if (!item.drugCategory) errors.push({ step: "seized", field: `seized.${index}.category`, message: `ยาเสพติด #${index + 1}: กรุณาเลือกประเภทของกลาง` });
    if (item.drugCategory === "OTHER" && !item.otherDrugCategoryLabel.trim()) {
      errors.push({ step: "seized", message: `ยาเสพติด #${index + 1}: กรุณาระบุชื่อสารเมื่อเลือก "อื่น ๆ"` });
    }
    if (!item.measurementKind) {
      errors.push({ step: "seized", message: `ยาเสพติด #${index + 1}: กรุณาเลือกรูปแบบการวัด (จำนวนนับ/น้ำหนัก)` });
    } else if (item.measurementKind === "COUNT" && !item.quantity.trim()) {
      errors.push({ step: "seized", field: `seized.${index}.quantity`, message: `ยาเสพติด #${index + 1}: กรุณากรอกจำนวน` });
    } else if (item.measurementKind === "MASS" && !item.weightKilograms.trim()) {
      errors.push({ step: "seized", field: `seized.${index}.quantity`, message: `ยาเสพติด #${index + 1}: กรุณากรอกน้ำหนัก` });
    } else if (item.measurementKind === "VOLUME") {
      errors.push({ step: "seized", field: `seized.${index}.measurementKind`, message: `ยาเสพติด #${index + 1}: ระบบนี้ยังไม่รองรับการวัดแบบปริมาตร` });
    }
  });

  draft.seizedVehicles.forEach((item, index) => {
    if (!seizedVehicleHasInput(item)) return;
    const hasRegistration = Boolean(item.registrationNumber.trim() && item.registrationProvince.trim());
    if (!hasRegistration && !item.vin.trim()) {
      errors.push({ step: "seized", field: `seizedVehicle.${index}`, message: `ยานพาหนะ #${index + 1}: กรุณาระบุทะเบียนหรือ VIN` });
    }
  });

  draft.seizedDevices.forEach((item, index) => {
    if (!seizedDeviceHasInput(item)) return;
    if (!item.imei1.trim() && !item.imei2.trim() && !item.serialNumber.trim() && !item.associatedPhone.trim()) {
      errors.push({ step: "seized", field: `seizedDevice.${index}`, message: `โทรศัพท์/อุปกรณ์ #${index + 1}: กรุณาระบุ IMEI, Serial หรือหมายเลขโทรศัพท์` });
    }
  });

  draft.seizedSims.forEach((item, index) => {
    if (!seizedSimHasInput(item)) return;
    if (!item.iccid.trim() && !item.imsi.trim() && !item.associatedPhone.trim()) {
      errors.push({ step: "seized", field: `seizedSim.${index}`, message: `SIM #${index + 1}: กรุณาระบุ ICCID, IMSI หรือหมายเลขโทรศัพท์` });
    }
  });

  draft.seizedFirearms.forEach((item, index) => {
    if (!seizedFirearmHasInput(item)) return;
    if (!item.firearmType.trim()) {
      errors.push({ step: "seized", field: `seizedFirearm.${index}`, message: `อาวุธปืน #${index + 1}: กรุณาระบุประเภทอาวุธ` });
    }
  });

  draft.seizedOtherItems.forEach((item, index) => {
    if (!seizedOtherHasInput(item)) return;
    if (!item.label.trim()) {
      errors.push({ step: "seized", field: `seizedOther.${index}`, message: `ของกลางอื่น ๆ #${index + 1}: กรุณาระบุชื่อของกลาง` });
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
    investigatorName: normalizeInvestigatorContactName(draft.investigatorName),
    investigatorPhone: normalizeInvestigatorContactPhone(draft.investigatorPhone),
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
    seizedVehicles: draft.seizedVehicles.filter(seizedVehicleHasInput).map((item) => ({
      registrationNumber: item.registrationNumber.trim() || null,
      registrationProvince: item.registrationProvince.trim() || null,
      vehicleType: item.vehicleType.trim() || null,
      brand: item.brand.trim() || null,
      model: item.model.trim() || null,
      color: item.color.trim() || null,
      vin: item.vin.trim() || null,
      notes: item.notes.trim() || null,
    })),
    seizedDevices: draft.seizedDevices.filter(seizedDeviceHasInput).map((item) => ({
      brand: item.brand.trim() || null,
      model: item.model.trim() || null,
      serialNumber: item.serialNumber.trim() || null,
      imei1: item.imei1.trim() || null,
      imei2: item.imei2.trim() || null,
      associatedPhone: item.associatedPhone.trim() || null,
      notes: item.notes.trim() || null,
    })),
    seizedSims: draft.seizedSims.filter(seizedSimHasInput).map((item) => ({
      iccid: item.iccid.trim() || null,
      imsi: item.imsi.trim() || null,
      carrier: item.carrier.trim() || null,
      associatedPhone: item.associatedPhone.trim() || null,
      notes: item.notes.trim() || null,
    })),
    seizedEvidenceItems: [
      ...draft.seizedFirearms.filter(seizedFirearmHasInput).map((item) => ({
        kind: "FIREARM",
        label: item.firearmType.trim(),
        quantity: toNumberOrNull(item.quantity),
        unit: null,
        serialNumber: item.serialNumber.trim() || null,
        brand: item.brand.trim() || null,
        model: item.model.trim() || null,
        caliberOrSize: item.caliberOrSize.trim() || null,
        recordedDescription: item.recordedDescription.trim() || null,
        notes: item.notes.trim() || null,
      })),
      ...draft.seizedOtherItems.filter(seizedOtherHasInput).map((item) => ({
        kind: "OTHER",
        label: item.label.trim(),
        quantity: toNumberOrNull(item.quantity),
        unit: item.unit.trim() || null,
        serialNumber: item.serialNumber.trim() || null,
        brand: null,
        model: null,
        caliberOrSize: null,
        recordedDescription: item.recordedDescription.trim() || null,
        notes: item.notes.trim() || null,
      })),
    ],
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
      .filter(participatingUnitHasSelection)
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
