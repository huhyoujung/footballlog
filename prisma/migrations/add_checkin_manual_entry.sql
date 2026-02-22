-- AddColumn: CheckIn.manualEntry
ALTER TABLE "CheckIn" ADD COLUMN "manualEntry" BOOLEAN NOT NULL DEFAULT false;
