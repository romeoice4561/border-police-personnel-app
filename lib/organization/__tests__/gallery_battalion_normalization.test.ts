import { test } from "node:test";
import assert from "node:assert/strict";

import { battalionQueryVariants, isBattalionVariantOf } from "@/lib/organization/gallery_battalion_normalization";

test("battalionQueryVariants returns every known text variant for a canonical label", () => {
  const variants = battalionQueryVariants("กก.ตชด.44");
  assert.ok(variants.includes("กก.ตชด.44"));
  assert.ok(variants.includes("กก.ตชด. 44"));
  assert.ok(variants.includes("กก ตชด.44"));
  assert.ok(variants.includes("กองกำกับการ ตชด.44"));
});

test("battalionQueryVariants returns the input unchanged for a non-canonical/custom value", () => {
  assert.deepEqual(battalionQueryVariants("custom legacy text"), ["custom legacy text"]);
});

test("isBattalionVariantOf matches formatting variants of the same battalion", () => {
  assert.equal(isBattalionVariantOf("กก.ตชด. 44", "กก.ตชด.44"), true);
  assert.equal(isBattalionVariantOf("กองกำกับการ ตชด.44", "กก.ตชด.44"), true);
  assert.equal(isBattalionVariantOf("KK.TCD.44", "กก.ตชด.44"), false);
});

test("isBattalionVariantOf does not match a different battalion's text", () => {
  assert.equal(isBattalionVariantOf("กก.ตชด.21", "กก.ตชด.44"), false);
});
