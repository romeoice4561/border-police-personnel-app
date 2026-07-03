/**
 * DatabaseStatistics (Phase 12).
 *
 * Read-only aggregate counts over the persisted tables, via the repositories
 * (no direct client access, no business logic duplication). Used for
 * reporting after an import. Constructor-injected repositories; no globals.
 */

import type { OfficerRepository } from "@/lib/database/repositories/officer_repository";
import type { UnitRepository } from "@/lib/database/repositories/unit_repository";
import type { ImportJobRepository } from "@/lib/database/repositories/import_job_repository";

export interface DatabaseCounts {
  officers: number;
  units: number;
  import_jobs: number;
}

export interface DatabaseStatisticsDependencies {
  officers: OfficerRepository;
  units: UnitRepository;
  jobs: ImportJobRepository;
}

export class DatabaseStatistics {
  private readonly officers: OfficerRepository;
  private readonly units: UnitRepository;
  private readonly jobs: ImportJobRepository;

  constructor(dependencies: DatabaseStatisticsDependencies) {
    this.officers = dependencies.officers;
    this.units = dependencies.units;
    this.jobs = dependencies.jobs;
  }

  async counts(): Promise<DatabaseCounts> {
    const [officers, units, import_jobs] = await Promise.all([
      this.officers.count(),
      this.units.count(),
      this.jobs.count(),
    ]);
    return { officers, units, import_jobs };
  }
}
