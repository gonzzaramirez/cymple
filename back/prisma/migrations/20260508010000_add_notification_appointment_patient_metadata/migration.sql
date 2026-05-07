-- AlterTable: Add appointmentId, patientId, metadata to Notification
ALTER TABLE "Notification" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "patientId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "Notification_appointmentId_idx" ON "Notification"("appointmentId");
CREATE INDEX "Notification_patientId_idx" ON "Notification"("patientId");

-- AddForeignKey: Notification -> Appointment
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Notification -> Patient
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;