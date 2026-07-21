-- Phase 49A.3: Timeline appointment order + work line (additive, non-destructive).
--
-- appointmentOrder — official order/reference text ("ตามคำสั่ง")
-- workLine — career work-line label ("สายงาน"), standard or custom free text
--
-- No existing column is altered or dropped. Nullable so pre-existing rows remain valid.

ALTER TABLE "Timeline" ADD COLUMN "appointmentOrder" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "workLine" TEXT;
