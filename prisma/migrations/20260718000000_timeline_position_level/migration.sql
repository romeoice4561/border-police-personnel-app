-- Phase 41 Part 1: Career Position Level (structured, additive, non-destructive).
--
-- Adds Timeline.positionLevel — the AUTHORITATIVE, system-wide source of truth
-- for an officer's position level (Commander Search / Dashboard / Statistics /
-- Charts / Timeline & Promotion Intelligence all read this structured value).
-- After this phase nothing derives the level from the free-text `position` at
-- runtime again.
--
-- No existing column is altered or dropped. The column is nullable; the
-- one-time backfill below maps known `position` titles into a level and sets
-- everything else to 'Unknown' so a human can correct it later. The mapping
-- mirrors lib/commander_query/position_level.ts::mapPositionTextToLevel — a
-- "รอง" (deputy) variant and the higher command levels are matched BEFORE the
-- lower/base ones, so e.g. "รองผู้กำกับการ" is never mis-classified as
-- "ผู้กำกับการ".

ALTER TABLE "Timeline" ADD COLUMN "positionLevel" TEXT;

CREATE INDEX "Timeline_positionLevel_idx" ON "Timeline"("positionLevel");

-- Backfill. `p` is the position text with spaces and dots removed so the
-- abbreviated forms (รอง สว. / ผกก. / …) and full names both match. Ordered
-- most-specific → least-specific via a single CASE.
UPDATE "Timeline"
SET "positionLevel" = CASE
  WHEN pl.p LIKE '%รองผู้บัญชาการ%' OR pl.p LIKE '%รองผบช%' THEN 'รองผู้บัญชาการ'
  WHEN pl.p LIKE '%รองผู้บังคับการ%' OR pl.p LIKE '%รองผบก%' THEN 'รองผู้บังคับการ'
  WHEN pl.p LIKE '%รองผู้กำกับการ%' OR pl.p LIKE '%รองผกก%' THEN 'รองผู้กำกับการ'
  WHEN pl.p LIKE '%รองสารวัตร%' OR pl.p LIKE '%รองสว%' THEN 'รองสารวัตร'
  WHEN pl.p LIKE '%ผู้บังคับการ%' OR pl.p LIKE '%ผบก%' THEN 'ผู้บังคับการ'
  WHEN pl.p LIKE '%ผู้กำกับการ%' OR pl.p LIKE '%ผกก%' THEN 'ผู้กำกับการ'
  WHEN pl.p LIKE '%สารวัตร%' OR pl.p LIKE '%สว%' THEN 'สารวัตร'
  ELSE 'Unknown'
END
FROM (
  SELECT "id", REPLACE(REPLACE(COALESCE("position", ''), ' ', ''), '.', '') AS p
  FROM "Timeline"
) AS pl
WHERE "Timeline"."id" = pl."id"
  AND "Timeline"."positionLevel" IS NULL;
