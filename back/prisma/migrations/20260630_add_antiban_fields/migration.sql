-- Add anti-ban fields to Organization
ALTER TABLE "Organization" 
  ADD COLUMN "waConnectedSince" TIMESTAMPTZ,
  ADD COLUMN "waDailyMsgCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "waDailyCountDate" TEXT,
  ADD COLUMN "waCircuitBreakerUntil" TIMESTAMPTZ;

-- Add anti-ban fields to Professional
ALTER TABLE "Professional" 
  ADD COLUMN "waConnectedSince" TIMESTAMPTZ,
  ADD COLUMN "waDailyMsgCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "waDailyCountDate" TEXT,
  ADD COLUMN "waCircuitBreakerUntil" TIMESTAMPTZ;
