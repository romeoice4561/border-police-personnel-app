/**
 * Near-duplicate detection architecture (Phase 48B — spec §6).
 *
 * fingerprint.ts's SHA-256 hash already handles EXACT duplicates (byte-
 * identical files) — this module prepares the interface for NEAR
 * duplicates (the same physical document photographed twice, rescanned at
 * a different resolution, or re-saved through a different app, none of
 * which produce identical bytes but all of which are "the same document").
 *
 * Per explicit instruction: interfaces only. No perceptual-hash, OpenCV, or
 * embedding-similarity algorithm is implemented here — only the contract a
 * future provider would satisfy, plus a trivial ExactOnlyNearDuplicateDetector
 * that honestly reports "no near-duplicate capability yet" rather than
 * silently returning false negatives from a fake similarity check.
 *
 * Pure typing + one honest stub implementation — no image processing, no
 * I/O beyond what's passed in.
 */

export interface NearDuplicateCandidate {
  /** The fingerprint (fingerprint.ts's fingerprintBytes output) of the other, already-processed document being compared against. */
  candidateFingerprint: string;
  /** 0-1. 1.0 = certain match. Meaning is provider-specific (perceptual-hash distance, embedding cosine similarity, etc.) — callers should not compare scores ACROSS providers. */
  similarityScore: number;
}

export interface NearDuplicateDetectionResult {
  /** True when at least one candidate scored at or above the provider's own match threshold. */
  isLikelyDuplicate: boolean;
  candidates: NearDuplicateCandidate[];
  /** Which detection technique produced this result — surfaced so the review UI/logs never present a near-duplicate claim without attribution. */
  method: NearDuplicateDetectionMethod;
}

export type NearDuplicateDetectionMethod =
  | "EXACT_HASH_ONLY"
  | "PERCEPTUAL_HASH"
  | "OPENCV_FEATURE_MATCH"
  | "VISION_EMBEDDING";

/**
 * Contract a future near-duplicate provider implements. `candidateFingerprints`
 * is the pool of already-known document fingerprints to compare against —
 * callers own how that pool is sourced (e.g. from the extraction cache or a
 * future persisted document index); this interface has no opinion on
 * storage.
 */
export interface NearDuplicateDetector {
  readonly method: NearDuplicateDetectionMethod;
  detect(imageBytes: Uint8Array, candidateFingerprints: readonly string[]): Promise<NearDuplicateDetectionResult>;
}

/**
 * The only implementation shipped this phase: honestly reports that no
 * near-duplicate detection beyond exact-hash matching is available, rather
 * than a fake always-false (which could be silently mistaken for "checked,
 * no match found") or a random/heuristic guess. Callers relying on near-
 * duplicate detection should treat every result from this class as "not
 * evaluated," not "evaluated and clean."
 */
export class ExactOnlyNearDuplicateDetector implements NearDuplicateDetector {
  readonly method: NearDuplicateDetectionMethod = "EXACT_HASH_ONLY";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match the NearDuplicateDetector interface even though this stub ignores its inputs.
  async detect(imageBytes: Uint8Array, candidateFingerprints: readonly string[]): Promise<NearDuplicateDetectionResult> {
    return { isLikelyDuplicate: false, candidates: [], method: "EXACT_HASH_ONLY" };
  }
}
