-- Reminder sweeper: claim/lock multi-instancia + intentos + skip permanente.
-- Sin esto, el sweeper reintenta en silencio por siempre (reminderSentAt queda null)
-- y dos instancias pueden enviar el mismo recordatorio duplicado.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderLastError" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderSkippedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderClaimId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderClaimedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Appointment_status_reminderSentAt_reminderScheduledFor_idx" ON "Appointment"("status", "reminderSentAt", "reminderScheduledFor");
