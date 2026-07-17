/**
 * Profile completeness calculator (Phase 21A; Phase 23A extends contact/
 * education/training to real data — Section 6).
 *
 * Pure derivation of a percentage + checklist for the Officer Profile
 * Completeness card. Scored ONLY from data that actually exists (basic info,
 * current position, career timeline, official portrait via the existing
 * Drive photo fields, and — since Phase 23A — contact channels, education,
 * and training rows). Awards/documents/GP7 still have no backing model, so
 * they always render unchecked — never invented, never guessed.
 *
 * No I/O, no React, no globals.
 *
 * TECHNICAL DEBT (Phase 40A hardening pass): this file contains domain/
 * calculation logic (a derived completeness score) but lives under
 * `lib/ui/`, not `lib/intelligence/`. It should be migrated behind
 * `lib/intelligence/document` during Phase 46, reusing this exact scoring
 * logic without changing behavior — see docs/INTELLIGENCE_ROADMAP.md
 * (Document Intelligence) and docs/Personnel_Intelligence_Architecture.md
 * (Risks). Not moved in this pass.
 */

import type { OfficerWithRelations } from "@/lib/database/query_types";

export type ProfileCompletenessItemId =
  | "basicInformation"
  | "currentPosition"
  | "careerTimeline"
  | "officialPortrait"
  | "contactInformation"
  | "education"
  | "trainingCourses"
  | "awards"
  | "documents"
  | "gp7";

export interface ProfileCompletenessItem {
  id: ProfileCompletenessItemId;
  label: string;
  complete: boolean;
}

export interface ProfileCompleteness {
  /** 0-100, rounded. */
  percent: number;
  items: ProfileCompletenessItem[];
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/**
 * Computes the checklist + overall percentage. Each item is independently
 * derived from existing persisted fields; items with no backing data source
 * yet (contact/education/training/awards/documents/GP7) are always `false`
 * until a future phase adds that data — this function never marks them
 * complete speculatively.
 */
export function computeProfileCompleteness(officer: OfficerWithRelations): ProfileCompleteness {
  const items: ProfileCompletenessItem[] = [
    {
      id: "basicInformation",
      label: "Basic Information",
      complete: !isBlank(officer.rank) && !isBlank(officer.firstName) && !isBlank(officer.lastName),
    },
    {
      id: "currentPosition",
      label: "Current Position",
      complete: !isBlank(officer.currentPosition) && !isBlank(officer.currentUnit),
    },
    {
      id: "careerTimeline",
      label: "Career Timeline",
      complete: officer.timeline.length > 0,
    },
    {
      // Phase 21A: no dedicated "official portrait" field exists yet — the
      // extracted Drive photo is the closest available signal. A true Official
      // Portrait upload is future work (Part 4/5); until then this reflects
      // whether ANY portrait (extracted) is on file.
      id: "officialPortrait",
      label: "Official Portrait",
      complete: !isBlank(officer.thumbnailUrl),
    },
    {
      // Phase 23A: real contact channels (phone remains the pre-existing
      // baseline; email/LINE/Facebook are the new fields added this phase).
      id: "contactInformation",
      label: "Contact Information",
      complete: !isBlank(officer.phone) || !isBlank(officer.email) || !isBlank(officer.lineId) || !isBlank(officer.facebookUrl),
    },
    { id: "education", label: "Education", complete: officer.education.length > 0 },
    { id: "trainingCourses", label: "Training Courses", complete: officer.training.length > 0 },
    { id: "awards", label: "Awards", complete: false },
    { id: "documents", label: "Documents", complete: false },
    { id: "gp7", label: "GP7", complete: false },
  ];

  const percent = Math.round((items.filter((i) => i.complete).length / items.length) * 100);

  return { percent, items };
}
