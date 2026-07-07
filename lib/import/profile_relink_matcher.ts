/**
 * ProfileRelinkMatcher (Phase 21B-2 — dry-run investigation only).
 *
 * Pure, read-only scoring logic that matches a new Drive Profile image's OCR
 * text against an existing Officer record using MULTIPLE signals together
 * (name, rank, unit/company/battalion/region, phone, timeline units) rather
 * than filename alone. Used exclusively by the dry-run report script
 * (scripts/profile_relink_dry_run.ts) — it never writes to the database, never
 * calls OpenAI, and is not wired into any real import path.
 *
 * Scoring is a simple, explainable weighted-signal sum (not a black box):
 * each signal that matches contributes points and a human-readable reason;
 * the total is clamped to 0-100. This mirrors the classifier's existing
 * "explainable rules" philosophy (lib/classifier/classification_rules.ts)
 * rather than introducing a new ML/black-box scoring method.
 *
 * No I/O, no OCR engine import, no Prisma import — takes already-fetched
 * plain data. Fully unit-testable.
 */

export interface OfficerSignals {
  officerId: string;
  fullName: string;
  rank: string | null;
  currentUnit: string | null;
  region: string | null;
  phone: string | null;
  timelineUnits: string[];
  extraPhones: string[];
}

export interface ProfileImageSignals {
  fileId: string;
  filename: string;
  driveFolder: string;
  ocrText: string;
}

export interface SignalMatch {
  signal: string;
  points: number;
  reason: string;
}

export interface OfficerMatchScore {
  officerId: string;
  fullName: string;
  confidence: number;
  matches: SignalMatch[];
}

const WEIGHTS = {
  fullName: 55,
  rank: 10,
  unit: 20,
  region: 5,
  phone: 25,
  timelineUnit: 12,
} as const;

/** Collapses whitespace and lowercases for tolerant substring comparison. Never strips Thai characters. */
function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function digitsOnly(text: string | null | undefined): string {
  return (text ?? "").replace(/\D/g, "");
}

/** True when `needle` (non-empty, length >= minLength) appears inside `haystack`. */
function containsToken(haystack: string, needle: string, minLength = 2): boolean {
  const n = normalize(needle);
  return n.length >= minLength && haystack.includes(n);
}

/**
 * Scores one officer against one Profile image's OCR text + Drive folder
 * path. Returns the total confidence (0-100, clamped) and the list of
 * signals that matched, each with its point contribution and an
 * explanation — so every score is auditable in the report, not a mystery
 * number.
 */
export function scoreOfficerAgainstProfileImage(
  officer: OfficerSignals,
  image: ProfileImageSignals
): OfficerMatchScore {
  const text = normalize(image.ocrText);
  const folder = normalize(image.driveFolder);
  const matches: SignalMatch[] = [];

  // Full name: the strongest single signal. Requires the OCR text to contain
  // the officer's full name as a substring (tolerant of OCR spacing noise via
  // the whitespace-collapse in normalize()).
  if (officer.fullName.trim().length > 0 && containsToken(text, officer.fullName, 4)) {
    matches.push({ signal: "fullName", points: WEIGHTS.fullName, reason: `OCR text contains the officer's full name "${officer.fullName}"` });
  }

  if (officer.rank && containsToken(text, officer.rank, 2)) {
    matches.push({ signal: "rank", points: WEIGHTS.rank, reason: `OCR text contains the officer's rank "${officer.rank}"` });
  }

  if (officer.currentUnit && (containsToken(text, officer.currentUnit, 3) || containsToken(folder, officer.currentUnit, 3))) {
    matches.push({ signal: "unit", points: WEIGHTS.unit, reason: `OCR text/Drive folder references the officer's current unit "${officer.currentUnit}"` });
  }

  // Region alone is a very weak signal — a Drive folder/region string like
  // "ภาค 1" is shared by every officer in that region (often 70-100+
  // people), so on its own it is nearly meaningless and would otherwise
  // give hundreds of unrelated officers a trivial nonzero score, flooding
  // the report with noise. It only counts as corroboration ON TOP OF at
  // least one other, more specific signal already having matched.
  const regionMatches =
    officer.region && (containsToken(text, officer.region, 3) || containsToken(folder, officer.region, 3));
  if (regionMatches && matches.length > 0) {
    matches.push({ signal: "region", points: WEIGHTS.region, reason: `OCR text/Drive folder references the officer's region "${officer.region}"` });
  }

  const officerPhones = [officer.phone, ...officer.extraPhones].map(digitsOnly).filter((d) => d.length >= 9);
  const textDigitRuns = text.match(/\d[\d\s-]{7,}\d/g) ?? [];
  const textPhoneDigits = textDigitRuns.map(digitsOnly);
  const phoneHit = officerPhones.find((p) => textPhoneDigits.some((t) => t.includes(p) || p.includes(t)));
  if (phoneHit) {
    matches.push({ signal: "phone", points: WEIGHTS.phone, reason: `OCR text contains a phone number matching the officer's on-file number (…${phoneHit.slice(-4)})` });
  }

  const timelineHit = officer.timelineUnits.find((u) => containsToken(text, u, 3) || containsToken(folder, u, 3));
  if (timelineHit) {
    matches.push({ signal: "timelineUnit", points: WEIGHTS.timelineUnit, reason: `OCR text/Drive folder references a unit from the officer's career timeline ("${timelineHit}")` });
  }

  const total = Math.min(100, matches.reduce((sum, m) => sum + m.points, 0));

  return { officerId: officer.officerId, fullName: officer.fullName, confidence: total, matches };
}

/** Classification bucket for one Profile image, per the Phase 21B-2 spec. */
export type RelinkClassification = "safe_match" | "needs_review" | "duplicate_candidate" | "unknown_officer" | "conflict";

export interface ProfileImageClassification {
  fileId: string;
  filename: string;
  driveFolder: string;
  classification: RelinkClassification;
  /** All officer candidates that scored above zero, sorted by confidence descending. */
  candidates: OfficerMatchScore[];
  /** Why this classification was chosen (for the non-safe-match cases especially). */
  explanation: string;
}

const SAFE_MATCH_THRESHOLD = 98;
const NEEDS_REVIEW_THRESHOLD = 80;
/** Two candidates are considered a genuine tie (ambiguous) when within this many points of each other. */
const CONFLICT_MARGIN = 10;

/**
 * Classifies one Profile image's candidate scores (already computed against
 * every officer) into exactly one of the five Phase 21B-2 buckets:
 *   - safe_match: a single clear top candidate >= 98
 *   - needs_review: a single clear top candidate in [80, 98)
 *   - conflict: two or more candidates within CONFLICT_MARGIN of each other
 *     and both >= NEEDS_REVIEW_THRESHOLD (ambiguous — could be either)
 *   - duplicate_candidate: the top candidate already has ANOTHER Profile
 *     image also scoring >= NEEDS_REVIEW_THRESHOLD against it (handled by the
 *     caller, which passes `alreadyClaimedBy` — see classifyProfileImages)
 *   - unknown_officer: no candidate reaches NEEDS_REVIEW_THRESHOLD at all
 */
export function classifyCandidates(
  image: ProfileImageSignals,
  candidates: OfficerMatchScore[]
): Omit<ProfileImageClassification, "fileId" | "filename" | "driveFolder"> {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];

  if (!top || top.confidence < NEEDS_REVIEW_THRESHOLD) {
    return {
      classification: "unknown_officer",
      candidates: sorted,
      explanation: top
        ? `Best candidate (${top.fullName}, ${top.officerId}) scored only ${top.confidence}%, below the ${NEEDS_REVIEW_THRESHOLD}% review threshold.`
        : "No officer signal (name/rank/unit/region/phone/timeline) matched anything in the OCR text.",
    };
  }

  const runnerUp = sorted[1];
  const isAmbiguous = Boolean(runnerUp && top.confidence - runnerUp.confidence <= CONFLICT_MARGIN && runnerUp.confidence >= NEEDS_REVIEW_THRESHOLD);

  if (isAmbiguous) {
    return {
      classification: "conflict",
      candidates: sorted,
      explanation: `Top two candidates are within ${CONFLICT_MARGIN} points of each other (${top.fullName} ${top.confidence}% vs ${runnerUp!.fullName} ${runnerUp!.confidence}%) — cannot safely disambiguate automatically.`,
    };
  }

  if (top.confidence >= SAFE_MATCH_THRESHOLD) {
    return {
      classification: "safe_match",
      candidates: sorted,
      explanation: `Single clear top candidate at ${top.confidence}% confidence (>= ${SAFE_MATCH_THRESHOLD}%), no close runner-up.`,
    };
  }

  return {
    classification: "needs_review",
    candidates: sorted,
    explanation: `Single clear top candidate at ${top.confidence}% confidence — between ${NEEDS_REVIEW_THRESHOLD}% and ${SAFE_MATCH_THRESHOLD}%, so a human should confirm before linking.`,
  };
}

/**
 * Second pass over every image's classification: reclassifies as
 * "duplicate_candidate" any image whose top candidate (officerId) is ALSO the
 * top candidate of another image at >= NEEDS_REVIEW_THRESHOLD confidence —
 * i.e. two different new Profile photos both plausibly belong to the same
 * existing officer, which must be resolved by a human rather than linked
 * automatically (only the highest-confidence one of the group keeps its
 * original classification; the rest become duplicate_candidate).
 */
export function flagDuplicateCandidates(
  classifications: ProfileImageClassification[]
): ProfileImageClassification[] {
  const claimsByOfficer = new Map<string, ProfileImageClassification[]>();

  for (const c of classifications) {
    const top = c.candidates[0];
    if (!top || top.confidence < NEEDS_REVIEW_THRESHOLD) continue;
    if (c.classification === "conflict" || c.classification === "unknown_officer") continue;
    const list = claimsByOfficer.get(top.officerId) ?? [];
    list.push(c);
    claimsByOfficer.set(top.officerId, list);
  }

  const duplicateFileIds = new Set<string>();
  for (const claims of claimsByOfficer.values()) {
    if (claims.length <= 1) continue;
    const sortedClaims = [...claims].sort((a, b) => (b.candidates[0]?.confidence ?? 0) - (a.candidates[0]?.confidence ?? 0));
    for (const dup of sortedClaims.slice(1)) duplicateFileIds.add(dup.fileId);
  }

  return classifications.map((c) =>
    duplicateFileIds.has(c.fileId)
      ? {
          ...c,
          classification: "duplicate_candidate" as const,
          explanation: `Another Profile image also matches "${c.candidates[0]?.fullName}" (${c.candidates[0]?.officerId}) at equal or higher confidence — only one image can be the real match; both are held for manual review.`,
        }
      : c
  );
}
