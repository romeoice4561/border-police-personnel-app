-- Phase 27 Bug #4/#5/#7: reconcile the seeded Company table with the
-- official nationwide Border Patrol structure (66 companies).
--
-- Root cause: organization_seed.ts's prior OBSERVED_STRUCTURE diverged from
-- the official list — it included 8 non-official codes (123, 143, 223, 241,
-- 255, 311, 313, 331) that don't fit the real hierarchy, and was missing 2
-- official codes (448, 449) under battalion 44. Confirmed via query: zero
-- live FK references (Officer.companyId / Timeline.companyId /
-- Asset.companyId) to any of the 8 non-official codes before this
-- migration, so removing them as Company rows is safe.
--
-- This migration:
--   1. Preserves the 8 non-official codes as OrganizationAlias rows
--      (mapped to their real battalion) so any OCR/import text still
--      bearing one of those codes keeps resolving, instead of silently
--      failing to resolve at all.
--   2. Removes the 8 non-official Company rows.
--   3. Adds the 2 missing official Company rows (448, 449) under
--      battalion 44.
--
-- End state: exactly 66 Company rows, matching organization_master.ts /
-- organization_seed.ts's OFFICIAL_STRUCTURE.

INSERT INTO "OrganizationAlias" ("aliasText", "canonicalBattalionId", "source")
SELECT c.code, c."battalionId", 'legacy-seed-migration'
FROM "Company" c
WHERE c.code IN ('123', '143', '223', '241', '255', '311', '313', '331');

DELETE FROM "Company"
WHERE code IN ('123', '143', '223', '241', '255', '311', '313', '331');

INSERT INTO "Company" (code, "nameTh", "battalionId", "displayOrder", "updatedAt")
SELECT '448', 'ตชด.448', b.id, 4, CURRENT_TIMESTAMP FROM "Battalion" b WHERE b.code = '44'
UNION ALL
SELECT '449', 'ตชด.449', b.id, 5, CURRENT_TIMESTAMP FROM "Battalion" b WHERE b.code = '44';
