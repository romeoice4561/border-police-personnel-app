/**
 * Profile completeness calculator (Phase 21A).
 *
 * Pure derivation of a percentage + checklist for the Officer Profile
 * Completeness card. Scored ONLY from data that actually exists today
 * (basic info, current position, career timeline, official portrait via the
 * existing Drive photo fields). Future fields (contact, education, training,
 * awards, documents, GP7) have no backing data yet, so they always render
 * unchecked — never invented, never guessed.
 *
 * No I/O, no React, no globals.
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
    { id: "contactInformation", label: "Contact Information", complete: false },
    { id: "education", label: "Education", complete: false },
    { id: "trainingCourses", label: "Training Courses", complete: false },
    { id: "awards", label: "Awards", complete: false },
    { id: "documents", label: "Documents", complete: false },
    { id: "gp7", label: "GP7", complete: false },
  ];

  const percent = Math.round((items.filter((i) => i.complete).length / items.length) * 100);

  return { percent, items };
}
