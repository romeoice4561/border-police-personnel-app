-- Phase 24B-2: Legacy Portrait Verification & Drive Cleanup (additive,
-- non-destructive).
--
-- Adds image-content classification to ProfilePhoto so the resolver can tell
-- a real portrait apart from a map/org-chart/document/profile-card scan,
-- independent of matchStatus (who it's linked to) or sourceType (how it
-- entered the system). No existing column changed; no row deleted; every
-- existing row defaults to classification='UNKNOWN' (safe, requires human
-- review before it can ever become a "Verified Drive Portrait").

ALTER TABLE "ProfilePhoto" ADD COLUMN "classification" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ProfilePhoto" ADD COLUMN "classifiedBy" TEXT;
ALTER TABLE "ProfilePhoto" ADD COLUMN "classifiedAt" TIMESTAMP(3);

CREATE INDEX "ProfilePhoto_classification_idx" ON "ProfilePhoto"("classification");
