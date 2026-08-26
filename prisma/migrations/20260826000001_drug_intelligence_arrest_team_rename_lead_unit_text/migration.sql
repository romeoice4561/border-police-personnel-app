-- Renames DrugCase.leadUnitManualText -> leadUnitText to match
-- reportingUnitText's existing convention exactly: always populated by the
-- client (manual fallback OR canonical picker's resolved label), never a
-- manual-only field resolved via a server-side org-table join. Same-session
-- follow-up to 20260826000000_drug_intelligence_arrest_team, which has zero
-- existing rows depending on the old name (migration applied moments ago,
-- column always NULL until this phase's Create Case UI ships).
ALTER TABLE "DrugCase" RENAME COLUMN "leadUnitManualText" TO "leadUnitText";
