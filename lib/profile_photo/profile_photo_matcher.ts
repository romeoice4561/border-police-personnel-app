/**
 * ProfilePhotoMatcher (Phase 21C — Universal Profile Photo Inbox, Part 5).
 *
 * The matcher NEVER decides whether a ProfilePhoto exists — every discovered
 * image already becomes a ProfilePhoto record before this runs (see
 * profile_photo_importer.ts). This module ONLY decides: should this photo
 * link to an officer, and with what MatchStatus?
 *
 * Reuses the exact multi-signal scoring/classification logic proven in
 * Phase 21B-2's dry run (lib/import/profile_relink_matcher.ts) — same
 * weights, same thresholds, same explainable per-signal reasons — and maps
 * its five dry-run buckets onto the four MatchStatus values a matcher can
 * actually produce automatically:
 *
 *   safe_match          -> AUTO_MATCHED   (matchedOfficerId set, confidence set)
 *   needs_review        -> REVIEW_REQUIRED (candidate found, not linked)
 *   duplicate_candidate -> DUPLICATE       (candidate found, not linked)
 *   conflict            -> CONFLICT        (no single candidate, not linked)
 *   unknown_officer     -> UNKNOWN         (no candidate, not linked)
 *
 * MANUAL_MATCHED and UNASSIGNED are never produced by this module — the
 * former is a future human action (Part 7), the latter is the default state
 * of a photo before the matcher has run at all (set by the importer).
 *
 * No I/O, no DB, no OCR engine import — pure functions over already-fetched
 * plain data, exactly like the module it wraps.
 */

import {
  scoreOfficerAgainstProfileImage,
  classifyCandidates,
  flagDuplicateCandidates,
  type OfficerSignals,
  type ProfileImageSignals,
  type ProfileImageClassification,
} from "@/lib/import/profile_relink_matcher";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

export type { OfficerSignals, ProfileImageSignals };

/** The matcher's decision for one photo: a MatchStatus plus the officer link (if any) and confidence. */
export interface ProfilePhotoMatchResult {
  matchStatus: MatchStatus;
  matchedOfficerId: string | null;
  confidence: number | null;
}

const CLASSIFICATION_TO_STATUS: Record<ProfileImageClassification["classification"], MatchStatus> = {
  safe_match: MatchStatus.AutoMatched,
  needs_review: MatchStatus.ReviewRequired,
  duplicate_candidate: MatchStatus.Duplicate,
  conflict: MatchStatus.Conflict,
  unknown_officer: MatchStatus.Unknown,
};

/**
 * Scores one photo against every officer and returns the matcher's decision.
 * Only `safe_match` (AUTO_MATCHED) carries a `matchedOfficerId` — every other
 * outcome leaves the photo unlinked (matchedOfficerId: null) even when a
 * candidate was found, so only clear, unambiguous matches ever auto-link.
 */
export function decideMatchForPhoto(
  officers: OfficerSignals[],
  image: ProfileImageSignals
): ProfilePhotoMatchResult {
  const scores = officers.map((o) => scoreOfficerAgainstProfileImage(o, image));
  const withSignal = scores.filter((s) => s.confidence > 0);
  const classification = classifyCandidates(image, withSignal);

  return classificationToMatchResult(classification);
}

function classificationToMatchResult(
  classification: Omit<ProfileImageClassification, "fileId" | "filename" | "driveFolder">
): ProfilePhotoMatchResult {
  const top = classification.candidates[0];
  const matchStatus = CLASSIFICATION_TO_STATUS[classification.classification];

  return {
    matchStatus,
    matchedOfficerId: matchStatus === MatchStatus.AutoMatched ? (top?.officerId ?? null) : null,
    confidence: top?.confidence ?? null,
  };
}

/**
 * Batch form: decides the match for every photo, then applies the same
 * cross-photo duplicate detection as the Phase 21B-2 dry run (two photos
 * both plausibly matching the same officer -> the lower-confidence one
 * becomes DUPLICATE instead of AUTO_MATCHED/REVIEW_REQUIRED).
 */
export function decideMatchesForPhotos(
  officers: OfficerSignals[],
  images: ProfileImageSignals[]
): Map<string, ProfilePhotoMatchResult> {
  const classifications: ProfileImageClassification[] = images.map((image) => {
    const scores = officers.map((o) => scoreOfficerAgainstProfileImage(o, image));
    const withSignal = scores.filter((s) => s.confidence > 0);
    const classification = classifyCandidates(image, withSignal);
    return { fileId: image.fileId, filename: image.filename, driveFolder: image.driveFolder, ...classification };
  });

  const deduped = flagDuplicateCandidates(classifications);

  const results = new Map<string, ProfilePhotoMatchResult>();
  for (const c of deduped) {
    results.set(c.fileId, classificationToMatchResult(c));
  }
  return results;
}
