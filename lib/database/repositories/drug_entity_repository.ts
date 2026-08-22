/**
 * DrugEntityRepository (Phase DI-1 — Drug Intelligence Core Data Model).
 *
 * Repository-pattern data access for the reusable entities (DrugPhoneNumber,
 * DrugSim, DrugDevice, DrugVehicle, DrugLocation) plus their case-linking
 * junction rows (DrugCasePhone/DrugCaseSim/DrugCaseDevice/DrugCaseVehicle/
 * DrugCaseLocation and the durable DrugPersonDevice/DrugPersonVehicle
 * relationships). Every entity is found-or-created by its natural matching
 * key (Section 6: normalizedNumber; Section 7: iccid; Section 8: imei1/
 * imei2/serialNumber; Section 9: registrationNumber/vin) — never duplicated
 * — while every LINK row is always freshly created with its own provenance
 * (Section 12), because the same entity legitimately appears in many
 * different case/person contexts over time.
 */

import type {
  DatabaseClient,
  DrugPhoneNumber,
  DrugSim,
  DrugDevice,
  DrugVehicle,
  DrugLocation,
} from "@/lib/database/database_types";

export class DrugEntityRepository {
  constructor(private readonly db: DatabaseClient) {}

  // ── Phone Number (Section 6) ──────────────────────────────────────────
  async findOrCreatePhoneNumber(normalizedNumber: string, createdBy: string): Promise<DrugPhoneNumber> {
    const existing = await this.db.drugPhoneNumber.findUnique({ where: { normalizedNumber } });
    if (existing) return existing;
    return this.db.drugPhoneNumber.create({ data: { normalizedNumber, createdBy, notes: null } });
  }

  findPhoneNumberById(id: string): Promise<DrugPhoneNumber | null> {
    return this.db.drugPhoneNumber.findUnique({ where: { id } });
  }

  /** Existence-only lookup for a real-time "พบหมายเลขนี้ในระบบแล้ว" reuse indicator (Section 9) — never blocks, only informs. */
  findPhoneNumberByNormalized(normalizedNumber: string): Promise<DrugPhoneNumber | null> {
    return this.db.drugPhoneNumber.findUnique({ where: { normalizedNumber } });
  }

  async linkCasePhone(input: {
    caseId: string;
    personId: string;
    phoneNumberId: string;
    originalInput: string | null;
    status: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugCasePhone.create({ data: input });
  }

  // ── SIM (Section 7) ───────────────────────────────────────────────────
  async findOrCreateSim(input: { iccid: string | null; imsi: string | null; carrier: string | null; createdBy: string }): Promise<DrugSim> {
    if (input.iccid) {
      const existing = await this.db.drugSim.findUnique({ where: { iccid: input.iccid } });
      if (existing) return existing;
    }
    return this.db.drugSim.create({ data: { ...input, notes: null } });
  }

  async linkCaseSim(input: {
    caseId: string;
    personId: string | null;
    simId: string;
    status: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugCaseSim.create({ data: input });
  }

  // ── Device / IMEI (Section 8) ─────────────────────────────────────────
  /**
   * Section 8: a device is matched by IMEI1 (the primary hardware
   * identifier) when present, else by serialNumber — never assumes a device
   * is new just because it arrives with a different person/case context
   * (that is exactly the "same device, different person in a different
   * year" case Section 8 requires the schema to support).
   */
  async findOrCreateDevice(input: {
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    imei1: string | null;
    imei2: string | null;
    createdBy: string;
  }): Promise<DrugDevice> {
    if (input.imei1) {
      const matches = await this.db.drugDevice.findMany({ where: { imei1: input.imei1 } });
      if (matches.length > 0) return matches[0];
    }
    if (input.serialNumber) {
      const matches = await this.db.drugDevice.findMany({ where: { serialNumber: input.serialNumber } });
      if (matches.length > 0) return matches[0];
    }
    return this.db.drugDevice.create({ data: { ...input, notes: null } });
  }

  findDeviceById(id: string): Promise<DrugDevice | null> {
    return this.db.drugDevice.findUnique({ where: { id } });
  }

  /** Existence-only lookup for a real-time "พบ IMEI นี้ในข้อมูลเดิม" reuse indicator (Section 10) — never blocks, only informs. */
  async findDeviceByImeiOrSerial(imei1: string | null, serialNumber: string | null): Promise<DrugDevice | null> {
    if (imei1) {
      const matches = await this.db.drugDevice.findMany({ where: { imei1 } });
      if (matches.length > 0) return matches[0];
    }
    if (serialNumber) {
      const matches = await this.db.drugDevice.findMany({ where: { serialNumber } });
      if (matches.length > 0) return matches[0];
    }
    return null;
  }

  async linkPersonDevice(input: {
    personId: string;
    deviceId: string;
    status: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    sourceCaseId: string | null;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugPersonDevice.create({ data: input });
  }

  /** Section 18's Person Detail Drawer — every device durably linked to this person (across all cases). */
  personDevicesForPerson(personId: string) {
    return this.db.drugPersonDevice.findMany({ where: { personId } });
  }

  async linkCaseDevice(input: {
    caseId: string;
    personId: string | null;
    deviceId: string;
    status: string;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugCaseDevice.create({ data: input });
  }

  // ── Vehicle (Section 9) ───────────────────────────────────────────────
  async findOrCreateVehicle(input: {
    registrationNumber: string | null;
    registrationProvince: string | null;
    vehicleType: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    vin: string | null;
    createdBy: string;
  }): Promise<DrugVehicle> {
    if (input.registrationNumber && input.registrationProvince) {
      const matches = await this.db.drugVehicle.findMany({
        where: { registrationNumber: input.registrationNumber, registrationProvince: input.registrationProvince },
      });
      if (matches.length > 0) return matches[0];
    }
    if (input.vin) {
      const matches = await this.db.drugVehicle.findMany({ where: { vin: input.vin } });
      if (matches.length > 0) return matches[0];
    }
    return this.db.drugVehicle.create({ data: { ...input, notes: null } });
  }

  findVehicleById(id: string): Promise<DrugVehicle | null> {
    return this.db.drugVehicle.findUnique({ where: { id } });
  }

  async linkPersonVehicle(input: {
    personId: string;
    vehicleId: string;
    status: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    sourceCaseId: string | null;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugPersonVehicle.create({ data: input });
  }

  /** Section 18's Person Detail Drawer — every vehicle durably linked to this person (across all cases). */
  personVehiclesForPerson(personId: string) {
    return this.db.drugPersonVehicle.findMany({ where: { personId } });
  }

  async linkCaseVehicle(input: {
    caseId: string;
    personId: string | null;
    vehicleId: string;
    status: string;
    recordedBy: string;
    notes: string | null;
  }) {
    return this.db.drugCaseVehicle.create({ data: input });
  }

  // ── Location (Section 10) ─────────────────────────────────────────────
  /**
   * Locations are NOT deduplicated by address text — Section 10 explicitly
   * warns against assuming shared location implies a shared network, and
   * free-text addresses are too unreliable to match confidently. Every
   * Create Case submission creates a fresh DrugLocation row for the
   * addresses it enters; consolidating near-duplicate locations is
   * explicitly deferred (DI-2's entity resolution scope), never guessed at
   * here.
   */
  async createLocation(input: {
    name: string | null;
    addressText: string | null;
    province: string | null;
    district: string | null;
    subdistrict: string | null;
    latitude: number | null;
    longitude: number | null;
    createdBy: string;
  }): Promise<DrugLocation> {
    return this.db.drugLocation.create({ data: { ...input, notes: null } });
  }

  async linkCaseLocation(input: { caseId: string; locationId: string; role: string; recordedBy: string; notes: string | null }) {
    return this.db.drugCaseLocation.create({ data: input });
  }

  findLocationById(id: string): Promise<DrugLocation | null> {
    return this.db.drugLocation.findUnique({ where: { id } });
  }

  // ── DI-3: Global Search read-only lookups ──────────────────────────────
  // Indexed exact-match lookups the search service tries FIRST (Section
  // 25/26 — never a full-table scan for a value the schema can already
  // answer in O(1)/O(log n)). Broader substring scans (name/text) still go
  // through findMany({}) + in-memory filter, same DI-1/DI-2-established
  // shape, since the ModelDelegate contract has no `contains` operator.

  findSimById(id: string): Promise<DrugSim | null> {
    return this.db.drugSim.findUnique({ where: { id } });
  }

  findSimByIccid(iccid: string): Promise<DrugSim | null> {
    return this.db.drugSim.findUnique({ where: { iccid } });
  }

  async findSimsByImsi(imsi: string): Promise<DrugSim[]> {
    return this.db.drugSim.findMany({ where: { imsi } });
  }

  async findDevicesByImei(imei: string): Promise<DrugDevice[]> {
    const [byImei1, byImei2] = await Promise.all([
      this.db.drugDevice.findMany({ where: { imei1: imei } }),
      this.db.drugDevice.findMany({ where: { imei2: imei } }),
    ]);
    const seen = new Set<string>();
    const merged: DrugDevice[] = [];
    for (const d of [...byImei1, ...byImei2]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }

  findDevicesBySerialNumber(serialNumber: string): Promise<DrugDevice[]> {
    return this.db.drugDevice.findMany({ where: { serialNumber } });
  }

  findVehiclesByRegistrationNumber(registrationNumber: string): Promise<DrugVehicle[]> {
    return this.db.drugVehicle.findMany({ where: { registrationNumber } });
  }

  findVehiclesByVin(vin: string): Promise<DrugVehicle[]> {
    return this.db.drugVehicle.findMany({ where: { vin } });
  }

  /** DI-3 Section 25: every phone/sim/device/vehicle, for the broader in-memory text scan — same "load then filter" shape as DrugPersonRepository.search()/findAllActive(). */
  findAllPhoneNumbers(): Promise<DrugPhoneNumber[]> {
    return this.db.drugPhoneNumber.findMany({});
  }
  findAllSims(): Promise<DrugSim[]> {
    return this.db.drugSim.findMany({});
  }
  findAllDevices(): Promise<DrugDevice[]> {
    return this.db.drugDevice.findMany({});
  }
  findAllVehicles(): Promise<DrugVehicle[]> {
    return this.db.drugVehicle.findMany({});
  }

  countCasePhonesForPhoneNumber(phoneNumberId: string): Promise<number> {
    return this.db.drugCasePhone.count({ where: { phoneNumberId } });
  }
  countCaseSimsForSim(simId: string): Promise<number> {
    return this.db.drugCaseSim.count({ where: { simId } });
  }
  countCaseDevicesForDevice(deviceId: string): Promise<number> {
    return this.db.drugCaseDevice.count({ where: { deviceId } });
  }
  countPersonDevicesForDevice(deviceId: string): Promise<number> {
    return this.db.drugPersonDevice.count({ where: { deviceId } });
  }
  countCaseVehiclesForVehicle(vehicleId: string): Promise<number> {
    return this.db.drugCaseVehicle.count({ where: { vehicleId } });
  }
  countPersonVehiclesForVehicle(vehicleId: string): Promise<number> {
    return this.db.drugPersonVehicle.count({ where: { vehicleId } });
  }

  casePhonesForPhoneNumber(phoneNumberId: string) {
    return this.db.drugCasePhone.findMany({ where: { phoneNumberId } });
  }
  caseSimsForSim(simId: string) {
    return this.db.drugCaseSim.findMany({ where: { simId } });
  }
  caseDevicesForDevice(deviceId: string) {
    return this.db.drugCaseDevice.findMany({ where: { deviceId } });
  }
  personDevicesForDevice(deviceId: string) {
    return this.db.drugPersonDevice.findMany({ where: { deviceId } });
  }
  caseVehiclesForVehicle(vehicleId: string) {
    return this.db.drugCaseVehicle.findMany({ where: { vehicleId } });
  }
  personVehiclesForVehicle(vehicleId: string) {
    return this.db.drugPersonVehicle.findMany({ where: { vehicleId } });
  }

  // ── Seized Items (Section 11) ─────────────────────────────────────────
  async addSeizedItem(input: {
    caseId: string;
    drugCategory: string;
    otherDrugCategoryLabel: string | null;
    measurementKind: string;
    drugType: string;
    subtype: string | null;
    quantity: number | null;
    unit: string | null;
    weightGrams: number | null;
    packageCount: number | null;
    notes: string | null;
    createdBy: string;
  }) {
    return this.db.drugSeizedItem.create({ data: input });
  }
}
