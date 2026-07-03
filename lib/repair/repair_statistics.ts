/**
 * RepairStatistics (Phase 10C).
 *
 * Aggregates per-image RepairReports into logs/repair_summary.json, in the
 * shape the phase requires: total images, repaired images, validation before
 * vs. after, per-type repair counts, and the top repairs. A small stateful
 * builder fed one report at a time (like the OCR/feature-score builders), so
 * the runner records each image as it finishes.
 *
 * Pure aggregation — no I/O (the runner writes the file), no globals.
 */

import type { RepairReport } from "@/lib/repair/repair_types";
import { recoveredValidation, repairTypeCounts, wasRepaired } from "@/lib/repair/repair_report";

export interface TopRepair {
  type: string;
  /** Total occurrences of this repair type across all images. */
  count: number;
  /** Number of images that received at least one repair of this type. */
  images: number;
}

export interface RepairSummary {
  total_images: number;
  repaired_images: number;
  /** Images whose validation was rescued from invalid → valid by repair. */
  validation_recovered: number;
  /** Count of images that passed validation BEFORE repair. */
  validation_before: number;
  /** Count of images that passed validation AFTER repair. */
  validation_after: number;
  /** Per-type total occurrence counts. */
  repair_types: Record<string, number>;
  /** Repairs ranked by total occurrences, most first. */
  top_repairs: TopRepair[];
}

export interface RepairStatisticsBuilder {
  add(report: RepairReport): void;
  build(): RepairSummary;
}

export class DefaultRepairStatisticsBuilder implements RepairStatisticsBuilder {
  private totalImages = 0;
  private repairedImages = 0;
  private validationRecovered = 0;
  private validBefore = 0;
  private validAfter = 0;
  private readonly typeCounts = new Map<string, number>();
  private readonly typeImages = new Map<string, number>();

  add(report: RepairReport): void {
    this.totalImages += 1;

    if (wasRepaired(report)) this.repairedImages += 1;
    if (recoveredValidation(report)) this.validationRecovered += 1;
    if (report.beforeValidation.valid) this.validBefore += 1;
    if (report.afterValidation.valid) this.validAfter += 1;

    const perReport = repairTypeCounts(report);
    for (const [type, count] of Object.entries(perReport)) {
      this.typeCounts.set(type, (this.typeCounts.get(type) ?? 0) + count);
      this.typeImages.set(type, (this.typeImages.get(type) ?? 0) + 1);
    }
  }

  build(): RepairSummary {
    const repair_types: Record<string, number> = {};
    for (const [type, count] of this.typeCounts) {
      repair_types[type] = count;
    }

    const top_repairs: TopRepair[] = Array.from(this.typeCounts.entries())
      .map(([type, count]) => ({ type, count, images: this.typeImages.get(type) ?? 0 }))
      .sort((a, b) => b.count - a.count || b.images - a.images);

    return {
      total_images: this.totalImages,
      repaired_images: this.repairedImages,
      validation_recovered: this.validationRecovered,
      validation_before: this.validBefore,
      validation_after: this.validAfter,
      repair_types,
      top_repairs,
    };
  }
}
