-- Phase DI-7.4 — Advanced Person Search Indexes
--
-- ADDITIVE ONLY. No DROP TABLE, no DROP COLUMN, no destructive ALTER.
-- No existing rows are touched.
--
-- These indexes support the new DrugPersonAdvancedSearchService filter paths
-- introduced in DI-7.4. Each index is justified below:
--
-- 1. DrugPerson.nationality
--    Query: nationality filter in advanced person search
--    DrugPerson has ~O(N) persons; without an index, nationality filtering
--    is a full sequential scan. nationality is a frequently used analyst
--    filter ("show Thai / Myanmar / Lao persons") and is already indexed
--    on the Officer table for the same reason.
--
-- 2. DrugCasePerson.role
--    Query: case-role filter ("show persons who appeared as SUSPECT")
--    DrugCasePerson has case_count × persons_per_case rows; role is a
--    closed enum (SUSPECT / ACCUSED / ARRESTED_PERSON / etc.) with high
--    cardinality skew (SUSPECT / ARRESTED_PERSON dominate). Without an
--    index, filtering by role requires a full scan of all case-person
--    links. This is separate from DrugPersonNetworkRole.role (already
--    indexed in DI-7.3 migration) — the two filters are never combined.

-- CreateIndex: nationality on DrugPerson
CREATE INDEX "DrugPerson_nationality_idx" ON "DrugPerson"("nationality");

-- CreateIndex: role on DrugCasePerson (procedural case role)
CREATE INDEX "DrugCasePerson_role_idx" ON "DrugCasePerson"("role");
