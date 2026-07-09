/**
 * ImageCategory -> PortraitClassification mapping (Phase 24B-3).
 *
 * The existing Smart Image Classification Engine (lib/classifier/*) produces
 * an `ImageCategory` (PERSONNEL_PROFILE/ORGANIZATION_CHART/MAP/...) — a
 * different, older vocabulary than `PortraitClassification` (Phase 24B-2:
 * REAL_PERSON/ORGANIZATION/MAP/DOCUMENT/PROFILE_CARD/UNKNOWN). This module is
 * the single, explicit mapping between the two so no caller re-derives it.
 *
 * PROFILE_CARD has no direct source signal from this classifier (it doesn't
 * distinguish a composite profile card from a clean personnel-profile photo)
 * — that classification is only ever set by a human reviewer via the
 * legacy-cleanup admin tool, never inferred here.
 *
 * Per Phase 24B-3, this mapping is METADATA ONLY — the resolver does not
 * consult classification when deciding what to display.
 */

import type { ImageCategory } from "@/lib/classifier/classification_types";
import { PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

const MAPPING: Record<ImageCategory, PortraitClassification> = {
  PERSONNEL_PROFILE: PortraitClassification.RealPerson,
  ORGANIZATION_CHART: PortraitClassification.Organization,
  MAP: PortraitClassification.Map,
  TIMELINE: PortraitClassification.Document,
  COVER_PAGE: PortraitClassification.Document,
  TITLE_PAGE: PortraitClassification.Document,
  TABLE: PortraitClassification.Document,
  DIAGRAM: PortraitClassification.Document,
  INDEX_PAGE: PortraitClassification.Document,
  UNKNOWN: PortraitClassification.Unknown,
};

/** Maps the classifier's ImageCategory to the ProfilePhoto domain's PortraitClassification. */
export function toPortraitClassification(category: ImageCategory): PortraitClassification {
  return MAPPING[category] ?? PortraitClassification.Unknown;
}
