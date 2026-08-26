-- Renames DrugCaseParticipatingUnit.manualUnitText -> unitText to match
-- DrugCase.leadUnitText/reportingUnitText's convention exactly: always
-- populated by the client (manual fallback OR canonical picker's resolved
-- label), never resolved via a server-side org-table join. Same-session
-- follow-up to 20260826000000_drug_intelligence_arrest_team — zero existing
-- rows depend on the old name (table created moments ago, still empty).
ALTER TABLE "DrugCaseParticipatingUnit" RENAME COLUMN "manualUnitText" TO "unitText";
