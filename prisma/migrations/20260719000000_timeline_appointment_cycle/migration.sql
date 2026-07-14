ALTER TABLE "Timeline" ADD COLUMN "appointmentCycle" INTEGER;
CREATE INDEX "Timeline_appointmentCycle_idx" ON "Timeline"("appointmentCycle");
