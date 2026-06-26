-- Add new MessageType enum values for booking-related templates
ALTER TYPE "MessageType" ADD VALUE 'BOOKING_CONFIRMED';
ALTER TYPE "MessageType" ADD VALUE 'DEPOSIT_REMINDER';
ALTER TYPE "MessageType" ADD VALUE 'DEPOSIT_EXPIRED';
