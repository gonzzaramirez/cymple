-- Add variant columns to MessageTemplate
ALTER TABLE "MessageTemplate"
  ADD COLUMN "bodyV2" TEXT,
  ADD COLUMN "bodyV3" TEXT;
