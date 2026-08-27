/**
 * DI-8, Section 8 — coordinate-pair validation tests: range bounds and the
 * both-or-neither rule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withCoordinatePair } from "@/lib/drug_intelligence/drug_coordinate_validation";

const schema = withCoordinatePair({ name: z.string().optional() });

test("both latitude and longitude present and in range — accepted", () => {
  const result = schema.safeParse({ latitude: 10.4934, longitude: 99.18 });
  assert.equal(result.success, true);
});

test("both omitted — accepted (no coordinates recorded)", () => {
  const result = schema.safeParse({});
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.latitude, null);
    assert.equal(result.data.longitude, null);
  }
});

test("latitude present without longitude — REJECTED", () => {
  const result = schema.safeParse({ latitude: 10.4934 });
  assert.equal(result.success, false);
});

test("longitude present without latitude — REJECTED", () => {
  const result = schema.safeParse({ longitude: 99.18 });
  assert.equal(result.success, false);
});

test("latitude out of range (> 90) — REJECTED", () => {
  const result = schema.safeParse({ latitude: 91, longitude: 99.18 });
  assert.equal(result.success, false);
});

test("latitude out of range (< -90) — REJECTED", () => {
  const result = schema.safeParse({ latitude: -91, longitude: 99.18 });
  assert.equal(result.success, false);
});

test("longitude out of range (> 180) — REJECTED", () => {
  const result = schema.safeParse({ latitude: 10.4934, longitude: 181 });
  assert.equal(result.success, false);
});

test("longitude out of range (< -180) — REJECTED", () => {
  const result = schema.safeParse({ latitude: 10.4934, longitude: -181 });
  assert.equal(result.success, false);
});

test("boundary values (exactly 90/-90/180/-180) are accepted, not off-by-one rejected", () => {
  assert.equal(schema.safeParse({ latitude: 90, longitude: 180 }).success, true);
  assert.equal(schema.safeParse({ latitude: -90, longitude: -180 }).success, true);
});

test("NaN/malformed string coordinates are rejected", () => {
  const result = schema.safeParse({ latitude: "not-a-number", longitude: 99.18 });
  assert.equal(result.success, false);
});

test("blank string latitude is treated as absent, not zero — pairs correctly with an absent longitude", () => {
  const result = schema.safeParse({ latitude: "", longitude: "" });
  assert.equal(result.success, true);
});
