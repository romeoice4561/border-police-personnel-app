/**
 * Officer portrait resolver tests (Phase 23B — bug #2).
 *
 * The resolver must return a portrait ONLY from a trusted ProfilePhoto match
 * (AUTO_MATCHED / MANUAL_MATCHED, matchedOfficerId set) and NEVER from a legacy
 * officer image. Verified over a fake ProfilePhoto client.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveOfficerPortraitWith, type PortraitDbClient } from "@/lib/server/officer_portrait_service";
import { MatchStatus } from "@/lib/profile_photo/profile_photo_types";

interface Row {
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  matchStatus: string;
  matchedOfficerId: string | null;
  isProfile?: boolean;
}

function fakeClient(rows: Row[]): PortraitDbClient {
  return {
    profilePhoto: {
      async findFirst(args) {
        const where = args.where as {
          matchedOfficerId?: string;
          matchStatus?: { in?: string[] };
          isProfile?: boolean;
        };
        // Phase 24B-1: the resolver first queries isProfile=true, then falls
        // back to a trusted-match query. Honor whichever shape is asked.
        if (where.isProfile === true) {
          const match = rows.find((r) => r.matchedOfficerId === where.matchedOfficerId && r.isProfile === true);
          return match ?? null;
        }
        const wanted = where.matchStatus?.in ?? [];
        const match = rows.find(
          (r) => r.matchedOfficerId === where.matchedOfficerId && wanted.includes(r.matchStatus)
        );
        return match ?? null;
      },
    },
  };
}

test("returns all-null when no ProfilePhoto is matched to the officer", async () => {
  const db = fakeClient([]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, { driveFileId: null, thumbnailUrl: null, webViewUrl: null });
});

test("returns the matched ProfilePhoto's image when AUTO_MATCHED", async () => {
  const db = fakeClient([
    { driveFileId: "PP1", thumbnailUrl: "t1", webViewUrl: "w1", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, { driveFileId: "PP1", thumbnailUrl: "t1", webViewUrl: "w1" });
});

test("returns the matched ProfilePhoto's image when MANUAL_MATCHED", async () => {
  const db = fakeClient([
    { driveFileId: "PP2", thumbnailUrl: "t2", webViewUrl: "w2", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, "PP2");
});

test("NEVER returns an UNASSIGNED ProfilePhoto (untrusted) as a portrait", async () => {
  const db = fakeClient([
    { driveFileId: "PP3", thumbnailUrl: "t3", webViewUrl: "w3", matchStatus: MatchStatus.Unassigned, matchedOfficerId: "ภาค 4/108" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.deepEqual(result, { driveFileId: null, thumbnailUrl: null, webViewUrl: null });
});

test("does not return a photo matched to a DIFFERENT officer", async () => {
  const db = fakeClient([
    { driveFileId: "PP4", thumbnailUrl: "t4", webViewUrl: "w4", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 1/5" },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, null);
});

test("Phase 24B-1: an uploaded isProfile=true portrait is preferred over other trusted matches", async () => {
  const db = fakeClient([
    // An older auto-matched scan photo AND a newer uploaded current portrait.
    { driveFileId: "SCAN", thumbnailUrl: "ts", webViewUrl: "ws", matchStatus: MatchStatus.AutoMatched, matchedOfficerId: "ภาค 4/108" },
    { driveFileId: "upload:xyz", thumbnailUrl: "tu", webViewUrl: "wu", matchStatus: MatchStatus.ManualMatched, matchedOfficerId: "ภาค 4/108", isProfile: true },
  ]);
  const result = await resolveOfficerPortraitWith(db, "ภาค 4/108");
  assert.equal(result.driveFileId, "upload:xyz");
  assert.equal(result.thumbnailUrl, "tu");
});
