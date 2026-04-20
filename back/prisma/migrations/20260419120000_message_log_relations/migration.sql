-- Add optional relations from MessageLog to Patient and Appointment for historial queries.

CREATE INDEX "MessageLog_professionalId_patientId_createdAt_idx" ON "public"."MessageLog"("professionalId", "patientId", "createdAt");

ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
