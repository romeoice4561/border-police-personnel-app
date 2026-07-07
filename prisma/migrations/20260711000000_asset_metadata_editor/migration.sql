-- Phase 22A: Gallery Metadata Editor Foundation (additive, non-destructive).
--
-- Adds user-editable metadata columns to the Asset table. All columns are
-- nullable or have defaults so existing rows keep working without back-fill.
-- No existing columns are removed or renamed. No other tables are touched.

-- Unit organisational text (free text — separate from the org-master fk fields)
ALTER TABLE "Asset" ADD COLUMN "unitName"    TEXT;
ALTER TABLE "Asset" ADD COLUMN "unitNumber"  TEXT;

-- Searchable keywords stored as a comma-joined string (e.g. "แผนที่,หน่วย")
ALTER TABLE "Asset" ADD COLUMN "keywords"    TEXT NOT NULL DEFAULT '';

-- Long-form editorial fields
ALTER TABLE "Asset" ADD COLUMN "description" TEXT;
ALTER TABLE "Asset" ADD COLUMN "remarks"     TEXT;

-- Manual verification flag; defaults to false (unverified)
ALTER TABLE "Asset" ADD COLUMN "verified"    BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for verified-filter queries
CREATE INDEX "Asset_verified_idx"    ON "Asset"("verified");
CREATE INDEX "Asset_unitNumber_idx"  ON "Asset"("unitNumber");
