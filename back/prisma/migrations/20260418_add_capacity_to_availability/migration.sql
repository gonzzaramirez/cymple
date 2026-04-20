-- Add optional capacity at range level
ALTER TABLE "AvailabilityRange"
ADD COLUMN "capacity" INTEGER;

-- Add optional per-slot capacity overrides for specific dates
CREATE TABLE "AvailabilitySlotCapacity" (
    "id" TEXT NOT NULL,
    "specificDateAvailabilityId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlotCapacity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvailabilitySlotCapacity_specificDateAvailabilityId_startTime_key"
ON "AvailabilitySlotCapacity"("specificDateAvailabilityId", "startTime");

CREATE INDEX "AvailabilitySlotCapacity_specificDateAvailabilityId_idx"
ON "AvailabilitySlotCapacity"("specificDateAvailabilityId");

ALTER TABLE "AvailabilitySlotCapacity"
ADD CONSTRAINT "AvailabilitySlotCapacity_specificDateAvailabilityId_fkey"
FOREIGN KEY ("specificDateAvailabilityId") REFERENCES "SpecificDateAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
