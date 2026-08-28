/**
 * DI-8.2 — grid-bucket clustering tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrugGeoClusters, drugGeoClusterCellSizeForZoom, shouldClusterAtZoom } from "@/lib/drug_intelligence/drug_geo_cluster";

test("markers far apart at a wide zoom remain in separate clusters", () => {
  const clusters = computeDrugGeoClusters(
    [
      { caseId: "a", latitude: 13.75, longitude: 100.5 }, // Bangkok
      { caseId: "b", latitude: 18.79, longitude: 98.99 }, // Chiang Mai — far away
    ],
    6
  );
  assert.equal(clusters.length, 2);
});

test("markers very close together at a wide zoom collapse into one cluster", () => {
  const clusters = computeDrugGeoClusters(
    [
      { caseId: "a", latitude: 10.4934, longitude: 99.18 },
      { caseId: "b", latitude: 10.4935, longitude: 99.1801 },
      { caseId: "c", latitude: 10.4936, longitude: 99.1802 },
    ],
    6
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].markers.length, 3);
});

test("cluster centroid is the average of member coordinates, not a fabricated point", () => {
  const clusters = computeDrugGeoClusters(
    [
      { caseId: "a", latitude: 10.0, longitude: 99.0 },
      { caseId: "b", latitude: 10.0, longitude: 99.0 },
    ],
    6
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].latitude, 10.0);
  assert.equal(clusters[0].longitude, 99.0);
});

test("a single marker still produces a cluster of size 1", () => {
  const clusters = computeDrugGeoClusters([{ caseId: "a", latitude: 13.75, longitude: 100.5 }], 6);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].markers.length, 1);
});

test("empty input produces no clusters, no crash", () => {
  assert.deepEqual(computeDrugGeoClusters([], 6), []);
});

test("cell size shrinks as zoom increases", () => {
  const wide = drugGeoClusterCellSizeForZoom(4);
  const close = drugGeoClusterCellSizeForZoom(14);
  assert.ok(close < wide);
});

test("cell size is clamped for extreme zoom values, never NaN/negative", () => {
  const veryWide = drugGeoClusterCellSizeForZoom(0);
  const veryClose = drugGeoClusterCellSizeForZoom(30);
  assert.ok(Number.isFinite(veryWide) && veryWide > 0);
  assert.ok(Number.isFinite(veryClose) && veryClose > 0);
});

test("the same markers at a closer zoom produce more (smaller) clusters than at a wide zoom", () => {
  const markers = [
    { caseId: "a", latitude: 10.4934, longitude: 99.18 },
    { caseId: "b", latitude: 10.55, longitude: 99.2 },
    { caseId: "c", latitude: 9.9658, longitude: 98.6348 },
  ];
  const wideZoomClusters = computeDrugGeoClusters(markers, 5);
  const closeZoomClusters = computeDrugGeoClusters(markers, 14);
  assert.ok(closeZoomClusters.length >= wideZoomClusters.length);
});

test("shouldClusterAtZoom is true when zoomed out, false once zoomed in close", () => {
  assert.equal(shouldClusterAtZoom(6), true);
  assert.equal(shouldClusterAtZoom(14), false);
});
