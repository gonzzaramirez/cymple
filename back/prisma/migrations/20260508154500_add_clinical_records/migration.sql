-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL_NOTE', 'APPOINTMENT_REASON');

-- CreateTable
CREATE TABLE "ClinicalRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "organizationId" TEXT,
    "appointmentId" TEXT,
    "recordType" "NoteType" NOT NULL,
    "content" JSONB NOT NULL,
    "plainTextPreview" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalRecord_appointmentId_recordType_key" ON "ClinicalRecord"("appointmentId", "recordType");
CREATE INDEX "ClinicalRecord_patientId_createdAt_idx" ON "ClinicalRecord"("patientId", "createdAt");
CREATE INDEX "ClinicalRecord_professionalId_createdAt_idx" ON "ClinicalRecord"("professionalId", "createdAt");
CREATE INDEX "ClinicalRecord_organizationId_createdAt_idx" ON "ClinicalRecord"("organizationId", "createdAt");
CREATE INDEX "ClinicalRecord_appointmentId_idx" ON "ClinicalRecord"("appointmentId");
CREATE INDEX "ClinicalRecord_deletedAt_idx" ON "ClinicalRecord"("deletedAt");

-- AddForeignKey
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
