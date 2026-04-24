-- Add daily digest fields and auto-confirm hours to Professional
ALTER TABLE "Professional"
ADD COLUMN "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dailyDigestTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN "autoConfirmHours" INTEGER;
