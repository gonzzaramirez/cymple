-- Add BOOKING_UNCONFIRMED_WARNING to MessageType enum
ALTER TYPE "MessageType" ADD VALUE 'BOOKING_UNCONFIRMED_WARNING';

-- Add bookingAutoCancelHours to Professional
ALTER TABLE "Professional" ADD COLUMN "bookingAutoCancelHours" INTEGER NOT NULL DEFAULT 8;

-- Add unconfirmedWarningSentAt to PublicBooking
ALTER TABLE "PublicBooking" ADD COLUMN "unconfirmedWarningSentAt" TIMESTAMP(3);
