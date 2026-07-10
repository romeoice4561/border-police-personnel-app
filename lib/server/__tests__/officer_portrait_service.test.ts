/**
 * Officer portrait resolver tests (Phase 23B bug #2; Phase 24B-3 simplified
 * 4-tier priority: Manual Upload -> Verified Manual Match -> Google Drive
 * Portrait -> Placeholder; Phase 26A stabilization bug #3: classification
 * gates Tier 3 ONLY — a Drive match confirmed non-portrait (MAP/ORGANIZATION/
 * DOCUMENT/PROFILE_CARD) is skipped, verified explicitly below). Verified
 * over a fake ProfilePhoto client that evaluates the actual where-clause
 * shape the resolver sends, so each tier's query is exercised for real, not
 * just its outcome.
 *
 * Run with:
 *   npx tsx --test lib/server/__tests__/officer_portrait_service.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveOfficerPortraitWith, resolveOfficerPortraitsBatchWith, type PortraitDbClient } from "@/lib/server/officer_portrait_service";
import { MatchStatus, PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

interface Row {
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  matchStatus: string;
  matchedOfficerId: string | null;
  sourceType?: string;
  isProfile?: boolean;
  classification?: string;
  updatedAt?: string;
}

function fullRow(r: Row) {
  return {
    ...r,
    sourceType: r.sourceType ?? "DRIVE_SCAN",
    isProfile: r.isProfile ?? false,
    classification: r.classification ?? PortraitClassification.Unknown,
    updatedAt: r.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function matchesValue(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object") {
    const c = cond as Record<string, unknown>;
    if ("notIn" in c) return !(c.notIn as unknown[]).includes(actual);
    if ("in" in c) return (c.in as unknown[]).includes(actual);
  }
  return actual === cond;
}

function fakeClient(rows: Row[]): PortraitDbClient {
  const full = rows.map(fullRow);
  function filterSorted(where: Record<string, unknown>) {
    return full
      .filter((r) => Object.entries(where).every(([k, v]) => matchesValue((r as unknown as Record<string, unknown>)[k], v)))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  return {
    profilePhoto: {
      async findFirst(args) {
        return filterSorted(args.where as Record<string, unknown>)[0] ?? null;
      },
      async findMany(args) {
        return filterSorted(args.where as Record<string, unknown>);
      },
    },
  };
}

/** Phase 26A: a fake client that ALSO supports the officer.officialPortrait lookup (Tier 0). */
function fakeClientWithOfficial(rows: Row[], officialByOfficerId: Record<string, Row | undefined>): PortraitDbClient {
  const base = fakeClient(rows);
  return {
    ...base,
    officer: {
      async findUnique(args) {
        const officerId = (args.where as { officerId?: string }).officerId;
        if (!officerId) return null;
        const official = officialByOfficerId[officerId];
        return { officerId, officialPortrait: official ? fullRow(official) : null };
      },
      async findMany(args) {
        const officerIds = (args.where as { officerId?: { in?: string[] } }).officerId?.in ?? [];
        return officerIds.map((officerId) => ({
          officerId,
          officialPortrait: officialByOfficerId[officerId] ? fullRow(officialByOfficerId[officerId]!) : null,
        }));
      },
    },
  };
}

const PLACEHOLDER = { driveFileId: null, thumbnailUrl: null, webViewUrl: null, source: "PLACEHOLDER" };

test("returns the placeholder result when no ProfilePhoto is matched to the officer", async () => {
  const db = fakeClient([]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, PLACEHOLDER);
});

test("Tier 3 — Google Drive Portrait: AUTO_MATCHED resolves with source DRIVE_PORTRAIT", async () => {
  const db = fakeClient([
    { driveFileId: "PP1", thumbnailUrl: "t1", webViewUrl: "w1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, { driveFileId: "PP1", thumbnailUrl: "t1", webViewUrl: "w1", source: "DRIVE_PORTRAIT" });
});

test("Tier 2 — Verified Manual Match: MANUAL_MATCHED resolves with source MANUAL_MATCH", async () => {
  const db = fakeClient([
    { driveFileId: "PP2", thumbnailUrl: "t2", webViewUrl: "w2", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, "PP2");
  assert.equal(result.source, "MANUAL_MATCH");
});

test("NEVER returns an UNASSIGNED ProfilePhoto (untrusted) as a portrait", async () => {
  const db = fakeClient([
    { driveFileId: "PP3", thumbnailUrl: "t3", webViewUrl: "w3", matchStatus: MatchStatus.Unassigned, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, PLACEHOLDER);
});

test("does not return a photo matched to a DIFFERENT officer", async () => {
  const db = fakeClient([
    { driveFileId: "PP4", thumbnailUrl: "t4", webViewUrl: "w4", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 1/5" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, null);
});

test("Tier 1 — Manual Upload beats every other tier", async () => {
  const db = fakeClient([
    { driveFileId: "SCAN", thumbnailUrl: "ts", webViewUrl: "ws", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 4/108" },
    {
      driveFileId: "upload:xyz",
      thumbnailUrl: "tu",
      webViewUrl: "wu",
      matchStatus: MatchStatus.ManualMatched,
      matchedOfficerId: "ภาค 4/108",
      sourceType: "UPLOAD",
      isProfile: true,
    },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, "upload:xyz");
  assert.equal(result.source, "UPLOADED");
});

test("priority order: Verified Manual Match beats Google Drive Portrait when both exist", async () => {
  const db = fakeClient([
    { driveFileId: "AI", thumbnailUrl: "a", webViewUrl: "a", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1" },
    { driveFileId: "MANUAL", thumbnailUrl: "m", webViewUrl: "m", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "off-1" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "MANUAL");
  assert.equal(result.source, "MANUAL_MATCH");
});

test("Phase 26A stabilization (bug #3): a MAP-classified AUTO_MATCHED photo is SKIPPED by Tier 3, falling through to placeholder when nothing else matches", async () => {
  const db = fakeClient([
    {
      driveFileId: "MAP",
      thumbnailUrl: "m",
      webViewUrl: "m",
      matchStatus: MatchStatus.AutoMatched,
      matchedOfficerId: "off-1",
      classification: PortraitClassification.Map,
    },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.deepEqual(result, PLACEHOLDER);
});

test("Phase 26A stabilization (bug #3): every NON_PORTRAIT_CLASSIFICATIONS value (ORGANIZATION/DOCUMENT/PROFILE_CARD) is skipped by Tier 3, not just MAP", async () => {
  for (const classification of [PortraitClassification.Organization, PortraitClassification.Document, PortraitClassification.ProfileCard]) {
    const db = fakeClient([
      { driveFileId: "BAD", thumbnailUrl: "b", webViewUrl: "b", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1", classification },
    ]);
    const result = await resolveOfficerPortraitWith(db, "off-1");
    assert.deepEqual(result, PLACEHOLDER, `expected placeholder for classification=${classification}`);
  }
});

test("Phase 26A stabilization (bug #3): a non-portrait Tier-3 match falls through to a REAL Tier-3 match for the SAME officer when one exists", async () => {
  const db = fakeClient([
    { driveFileId: "MAP", thumbnailUrl: "m", webViewUrl: "m", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1", classification: PortraitClassification.Map, updatedAt: "2026-02-01T00:00:00.000Z" },
    { driveFileId: "REAL", thumbnailUrl: "r", webViewUrl: "r", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1", classification: PortraitClassification.RealPerson, updatedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "REAL");
  assert.equal(result.source, "DRIVE_PORTRAIT");
});

test("an unclassified (UNKNOWN) matched photo still resolves normally — the classification gate only excludes confirmed non-portraits", async () => {
  const db = fakeClient([
    {
      driveFileId: "PP5",
      thumbnailUrl: "t5",
      webViewUrl: "w5",
      matchStatus: MatchStatus.AutoMatched,
      matchedOfficerId: "off-1",
      classification: PortraitClassification.Unknown,
    },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "PP5");
});

test("a REAL_PERSON-classified matched photo resolves normally", async () => {
  const db = fakeClient([
    { driveFileId: "PP6", thumbnailUrl: "t6", webViewUrl: "w6", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1", classification: PortraitClassification.RealPerson },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "PP6");
  assert.equal(result.source, "DRIVE_PORTRAIT");
});

test("Phase 26A stabilization (bug #3): classification NEVER gates Tier 1 (Manual Upload) — a human's explicit upload always wins regardless of classification", async () => {
  const db = fakeClient([
    {
      driveFileId: "upload:x",
      thumbnailUrl: "u",
      webViewUrl: "u",
      matchStatus: MatchStatus.ManualMatched,
      matchedOfficerId: "off-1",
      sourceType: "UPLOAD",
      isProfile: true,
      classification: PortraitClassification.Map,
    },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "upload:x");
  assert.equal(result.source, "UPLOADED");
});

test("Phase 26A stabilization (bug #3): classification NEVER gates Tier 2 (Verified Manual Match) — a human's explicit link always wins regardless of classification", async () => {
  const db = fakeClient([
    {
      driveFileId: "manual:x",
      thumbnailUrl: "m",
      webViewUrl: "m",
      matchStatus: MatchStatus.ManualMatched,
      matchedOfficerId: "off-1",
      classification: PortraitClassification.Organization,
    },
  ]);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "manual:x");
  assert.equal(result.source, "MANUAL_MATCH");
});

// ── Batch resolver: SAME priority, many officers at once ────────────────────

test("batch resolver returns an entry for every requested officer, even with no data at all", async () => {
  const db = fakeClient([]);
  const result = await resolveOfficerPortraitsBatchWith(db, ["off-1", "off-2"]);
  assert.equal(result.size, 2);
  assert.deepEqual(result.get("off-1"), PLACEHOLDER);
  assert.deepEqual(result.get("off-2"), PLACEHOLDER);
});

test("batch resolver applies the same 4-tier priority per officer independently", async () => {
  const db = fakeClient([
    { driveFileId: "A_DRIVE", thumbnailUrl: "a", webViewUrl: "a", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-A" },
    { driveFileId: "B_MANUAL", thumbnailUrl: "b", webViewUrl: "b", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "off-B" },
    {
      driveFileId: "upload:c",
      thumbnailUrl: "c",
      webViewUrl: "c",
      matchStatus: MatchStatus.ManualMatched,
      matchedOfficerId: "off-C",
      sourceType: "UPLOAD",
      isProfile: true,
    },
  ]);
  const result = await resolveOfficerPortraitsBatchWith(db, ["off-A", "off-B", "off-C", "off-D"]);
  assert.equal(result.get("off-A")?.source, "DRIVE_PORTRAIT");
  assert.equal(result.get("off-B")?.source, "MANUAL_MATCH");
  assert.equal(result.get("off-C")?.source, "UPLOADED");
  assert.deepEqual(result.get("off-D"), PLACEHOLDER);
});

test("Phase 26A stabilization (bug #3): batch resolver applies the same Tier-3 classification gate as the single resolver", async () => {
  const db = fakeClient([
    {
      driveFileId: "MAP",
      thumbnailUrl: "m",
      webViewUrl: "m",
      matchStatus: MatchStatus.AutoMatched,
      matchedOfficerId: "off-1",
      classification: PortraitClassification.Map,
    },
  ]);
  const result = await resolveOfficerPortraitsBatchWith(db, ["off-1"]);
  assert.deepEqual(result.get("off-1"), PLACEHOLDER);
});

test("Phase 26A stabilization (bug #3): batch resolver still resolves an unclassified/REAL_PERSON match normally", async () => {
  const db = fakeClient([
    { driveFileId: "OK", thumbnailUrl: "o", webViewUrl: "o", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1", classification: PortraitClassification.RealPerson },
  ]);
  const result = await resolveOfficerPortraitsBatchWith(db, ["off-1"]);
  assert.equal(result.get("off-1")?.driveFileId, "OK");
  assert.equal(result.get("off-1")?.source, "DRIVE_PORTRAIT");
});

test("batch resolver matches resolveOfficerPortraitWith's per-officer result exactly (parity check)", async () => {
  const rows: Row[] = [
    { driveFileId: "AI1", thumbnailUrl: "a1", webViewUrl: "a1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1" },
    { driveFileId: "MANUAL2", thumbnailUrl: "m2", webViewUrl: "m2", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "off-2" },
    { driveFileId: "UNMATCHED3", thumbnailUrl: "v3", webViewUrl: "v3", matchStatus: MatchStatus.Unassigned, matchedOfficerId: "off-3" },
  ];
  const officerIds = ["off-1", "off-2", "off-3", "off-4"];
  const batch = await resolveOfficerPortraitsBatchWith(fakeClient(rows), officerIds);
  for (const id of officerIds) {
    const single = await resolveOfficerPortraitWith(fakeClient(rows), id);
    assert.deepEqual(batch.get(id), single, `mismatch for ${id}`);
  }
});

// ── Phase 26A: Tier 0 — Official Portrait ────────────────────────────────────

test("Tier 0 — Official Portrait beats every automatic tier, including Manual Upload", async () => {
  const db = fakeClientWithOfficial(
    [
      {
        driveFileId: "upload:xyz",
        thumbnailUrl: "tu",
        webViewUrl: "wu",
        matchStatus: MatchStatus.ManualMatched,
        matchedOfficerId: "off-1",
        sourceType: "UPLOAD",
        isProfile: true,
      },
    ],
    { "off-1": { driveFileId: "OFFICIAL1", thumbnailUrl: "to", webViewUrl: "wo", matchStatus: MatchStatus.Unassigned, matchedOfficerId: null } }
  );
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "OFFICIAL1");
  assert.equal(result.source, "OFFICIAL_PORTRAIT");
});

test("Tier 0 is skipped (falls through to automatic tiers) when the officer has no officialPortrait set", async () => {
  const db = fakeClientWithOfficial(
    [{ driveFileId: "AI1", thumbnailUrl: "a1", webViewUrl: "a1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1" }],
    { "off-1": undefined }
  );
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.driveFileId, "AI1");
  assert.equal(result.source, "DRIVE_PORTRAIT");
});

test("Tier 0 is a no-op when the client does not implement the officer lookup (pre-26A fake client)", async () => {
  const db = fakeClient([
    { driveFileId: "AI1", thumbnailUrl: "a1", webViewUrl: "a1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1" },
  ]);
  assert.equal(db.officer, undefined);
  const result = await resolveOfficerPortraitWith(db, "off-1");
  assert.equal(result.source, "DRIVE_PORTRAIT");
});

test("batch resolver: Tier 0 Official Portrait beats every automatic tier per officer", async () => {
  const db = fakeClientWithOfficial(
    [
      { driveFileId: "A_DRIVE", thumbnailUrl: "a", webViewUrl: "a", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-A" },
      { driveFileId: "B_MANUAL", thumbnailUrl: "b", webViewUrl: "b", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "off-B" },
    ],
    {
      "off-A": { driveFileId: "OFFICIAL_A", thumbnailUrl: "oa", webViewUrl: "oa", matchStatus: MatchStatus.Unassigned, matchedOfficerId: null },
      "off-B": undefined,
    }
  );
  const result = await resolveOfficerPortraitsBatchWith(db, ["off-A", "off-B", "off-C"]);
  assert.equal(result.get("off-A")?.source, "OFFICIAL_PORTRAIT");
  assert.equal(result.get("off-A")?.driveFileId, "OFFICIAL_A");
  assert.equal(result.get("off-B")?.source, "MANUAL_MATCH", "off-B has no official portrait, falls through to Tier 2");
  assert.deepEqual(result.get("off-C"), PLACEHOLDER);
});

test("batch resolver Tier 0 matches resolveOfficerPortraitWith's per-officer result exactly (parity check)", async () => {
  const rows: Row[] = [
    { driveFileId: "AI1", thumbnailUrl: "a1", webViewUrl: "a1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "off-1" },
  ];
  const official = {
    "off-1": { driveFileId: "OFFICIAL1", thumbnailUrl: "o1", webViewUrl: "o1", matchStatus: MatchStatus.Unassigned, matchedOfficerId: null },
  };
  const officerIds = ["off-1", "off-2"];
  const batch = await resolveOfficerPortraitsBatchWith(fakeClientWithOfficial(rows, official), officerIds);
  for (const id of officerIds) {
    const single = await resolveOfficerPortraitWith(fakeClientWithOfficial(rows, official), id);
    assert.deepEqual(batch.get(id), single, `mismatch for ${id}`);
  }
});
