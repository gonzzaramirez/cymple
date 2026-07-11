-- Remove confirmationDeadline from Appointment (no longer used)
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "confirmationDeadline";

-- Remove confirmationWindowMinutes from Professional (no longer used)
ALTER TABLE "Professional" DROP COLUMN IF EXISTS "confirmationWindowMinutes";
