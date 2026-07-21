import { test } from "node:test";
import assert from "node:assert/strict";

import { ExactOnlyNearDuplicateDetector, type NearDuplicateDetector } from "@/lib/extraction/near_duplicate_detection";

test("ExactOnlyNearDuplicateDetector reports method EXACT_HASH_ONLY", () => {
  const detector = new ExactOnlyNearDuplicateDetector();
  assert.equal(detector.method, "EXACT_HASH_ONLY");
});

test("ExactOnlyNearDuplicateDetector always reports isLikelyDuplicate=false with zero candidates (honest 'not evaluated', not a fake match)", async () => {
  const detector = new ExactOnlyNearDuplicateDetector();
  const result = await detector.detect(new Uint8Array([1, 2, 3]), ["fp-a", "fp-b", "fp-c"]);
  assert.equal(result.isLikelyDuplicate, false);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.method, "EXACT_HASH_ONLY");
});

test("NearDuplicateDetector interface is satisfied by any object implementing method+detect (structural typing check)", async () => {
  const fake: NearDuplicateDetector = {
    method: "PERCEPTUAL_HASH",
    async detect(imageBytes, candidateFingerprints) {
      return {
        isLikelyDuplicate: candidateFingerprints.length > 0,
        candidates: candidateFingerprints.map((fp) => ({ candidateFingerprint: fp, similarityScore: 0.5 })),
        method: "PERCEPTUAL_HASH",
      };
    },
  };
  const result = await fake.detect(new Uint8Array(), ["x"]);
  assert.equal(result.isLikelyDuplicate, true);
  assert.equal(result.candidates.length, 1);
});
