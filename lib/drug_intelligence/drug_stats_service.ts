/**
 * DrugStatsService (Phase DI-1 Round 2 — Landing Page KPIs, Section 4).
 *
 * A single, minimal read-only aggregate for the Drug Intelligence landing
 * page: total case/person/phone/device/vehicle counts across the whole
 * module. Deliberately NOT a general-purpose analytics/dashboard engine
 * (that's DI-8's scope) — five `count()` calls, nothing derived, nothing
 * trend-based.
 */

import type { DatabaseClient } from "@/lib/database/database_types";

export interface DrugIntelligenceStats {
  totalCases: number;
  totalPersons: number;
  totalPhones: number;
  totalDevices: number;
  totalVehicles: number;
}

export class DrugStatsService {
  constructor(private readonly db: DatabaseClient) {}

  async getStats(): Promise<DrugIntelligenceStats> {
    const [totalCases, totalPersons, totalPhones, totalDevices, totalVehicles] = await Promise.all([
      this.db.drugCase.count({}),
      this.db.drugPerson.count({}),
      this.db.drugPhoneNumber.count({}),
      this.db.drugDevice.count({}),
      this.db.drugVehicle.count({}),
    ]);
    return { totalCases, totalPersons, totalPhones, totalDevices, totalVehicles };
  }
}
