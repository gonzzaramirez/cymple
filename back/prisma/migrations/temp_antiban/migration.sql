-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "public"."AvailabilitySource" AS ENUM ('WEEKLY', 'SPECIFIC_DATE');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ATTENDED', 'ABSENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WaStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');

-- CreateEnum
CREATE TYPE "public"."MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'PATIENT_REPLY', 'PAYMENT_REMINDER', 'SYSTEM', 'BOOKING_CONFIRMED', 'BOOKING_UNCONFIRMED_WARNING', 'DEPOSIT_REMINDER', 'DEPOSIT_EXPIRED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING_WA_CONFIRMATION', 'WA_CONTACTED', 'BOOKED', 'INTAKE_SENT', 'INTAKE_COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."DepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."AppointmentModality" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "public"."NoteType" AS ENUM ('GENERAL_NOTE', 'APPOINTMENT_REASON', 'INTAKE_FORM');

-- CreateEnum
CREATE TYPE "public"."AccountRole" AS ENUM ('INDEPENDENT', 'CENTER_ADMIN', 'CENTER_MEMBER');

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "waInstanceName" TEXT,
    "waStatus" "public"."WaStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "waConnectedSince" TIMESTAMP(3),
    "waDailyMsgCount" INTEGER NOT NULL DEFAULT 0,
    "waDailyCountDate" TEXT,
    "waCircuitBreakerUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicBookingSlug" TEXT,
    "depositAmount" DECIMAL(10,2),
    "depositWindowHours" INTEGER NOT NULL DEFAULT 24,
    "bookingAutoCancel" BOOLEAN NOT NULL DEFAULT true,
    "bookingAutoCancelHours" INTEGER NOT NULL DEFAULT 8,
    "maxActiveBookings" INTEGER NOT NULL DEFAULT 5,
    "waPublicBookingPhone" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Professional" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "consultationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "minRescheduleHours" INTEGER NOT NULL DEFAULT 4,
    "standardFee" DECIMAL(10,2) NOT NULL,
    "reminderHours" INTEGER NOT NULL DEFAULT 24,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyDigestTime" TEXT NOT NULL DEFAULT '08:00',
    "autoConfirmHours" INTEGER,
    "confirmationWindowMinutes" INTEGER NOT NULL DEFAULT 60,
    "paymentAlias" TEXT,
    "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicBookingSlug" TEXT,
    "depositAmount" DECIMAL(10,2),
    "depositWindowHours" INTEGER NOT NULL DEFAULT 24,
    "waPublicBookingPhone" TEXT,
    "bookingAutoCancel" BOOLEAN NOT NULL DEFAULT true,
    "bookingAutoCancelHours" INTEGER NOT NULL DEFAULT 8,
    "maxActiveBookings" INTEGER NOT NULL DEFAULT 5,
    "waInstanceName" TEXT,
    "waStatus" "public"."WaStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "waConnectedSince" TIMESTAMP(3),
    "waDailyMsgCount" INTEGER NOT NULL DEFAULT 0,
    "waDailyCountDate" TEXT,
    "waCircuitBreakerUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyAvailability" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "weekday" "public"."Weekday" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecificDateAvailability" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecificDateAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AvailabilityRange" (
    "id" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER,
    "weeklyAvailabilityId" TEXT,
    "specificDateAvailabilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AvailabilitySlotCapacity" (
    "id" TEXT NOT NULL,
    "specificDateAvailabilityId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlotCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Patient" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dni" TEXT,
    "birthDate" DATE,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "organizationId" TEXT,
    "patientId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "modality" "public"."AppointmentModality" NOT NULL DEFAULT 'PRESENCIAL',
    "fee" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "attendedAt" TIMESTAMP(3),
    "reminderScheduledFor" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "reminderJobId" TEXT,
    "paymentReminderSentAt" TIMESTAMP(3),
    "confirmationDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicBooking" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "slotDate" DATE NOT NULL,
    "slotStart" TEXT NOT NULL,
    "slotEnd" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "intakeToken" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING_WA_CONFIRMATION',
    "depositStatus" "public"."DepositStatus" NOT NULL DEFAULT 'PENDING',
    "depositAmount" DECIMAL(10,2),
    "depositPaidAt" TIMESTAMP(3),
    "depositPaidBy" TEXT,
    "intakeCompleted" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "waContactedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "waMessageId" TEXT,
    "notes" TEXT,
    "notifiedExpiry" BOOLEAN NOT NULL DEFAULT false,
    "unconfirmedWarningSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Revenue" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "appointmentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "paymentMethod" "public"."PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageLog" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "organizationId" TEXT,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "direction" "public"."MessageDirection" NOT NULL,
    "messageType" "public"."MessageType" NOT NULL,
    "toPhone" TEXT,
    "fromPhone" TEXT,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEventLog" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appointmentId" TEXT,
    "patientId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageTemplate" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "messageType" "public"."MessageType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClinicalRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "organizationId" TEXT,
    "appointmentId" TEXT,
    "recordType" "public"."NoteType" NOT NULL,
    "title" TEXT,
    "content" JSONB NOT NULL,
    "plainTextPreview" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_key" ON "public"."Organization"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_publicBookingSlug_key" ON "public"."Organization"("publicBookingSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_slug_key" ON "public"."Professional"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_email_key" ON "public"."Professional"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_publicBookingSlug_key" ON "public"."Professional"("publicBookingSlug");

-- CreateIndex
CREATE INDEX "Professional_organizationId_idx" ON "public"."Professional"("organizationId");

-- CreateIndex
CREATE INDEX "WeeklyAvailability_professionalId_idx" ON "public"."WeeklyAvailability"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAvailability_professionalId_weekday_key" ON "public"."WeeklyAvailability"("professionalId", "weekday");

-- CreateIndex
CREATE INDEX "SpecificDateAvailability_professionalId_date_idx" ON "public"."SpecificDateAvailability"("professionalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificDateAvailability_professionalId_date_key" ON "public"."SpecificDateAvailability"("professionalId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityRange_weeklyAvailabilityId_idx" ON "public"."AvailabilityRange"("weeklyAvailabilityId");

-- CreateIndex
CREATE INDEX "AvailabilityRange_specificDateAvailabilityId_idx" ON "public"."AvailabilityRange"("specificDateAvailabilityId");

-- CreateIndex
CREATE INDEX "AvailabilitySlotCapacity_specificDateAvailabilityId_idx" ON "public"."AvailabilitySlotCapacity"("specificDateAvailabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlotCapacity_specificDateAvailabilityId_startTi_key" ON "public"."AvailabilitySlotCapacity"("specificDateAvailabilityId", "startTime");

-- CreateIndex
CREATE INDEX "Patient_professionalId_lastName_firstName_idx" ON "public"."Patient"("professionalId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Patient_professionalId_createdAt_idx" ON "public"."Patient"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "Patient_organizationId_lastName_firstName_idx" ON "public"."Patient"("organizationId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Patient_organizationId_createdAt_idx" ON "public"."Patient"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "public"."Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_organizationId_phone_idx" ON "public"."Patient"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_professionalId_phone_key" ON "public"."Patient"("professionalId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_professionalId_dni_key" ON "public"."Patient"("professionalId", "dni");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_phone_key" ON "public"."Patient"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_dni_key" ON "public"."Patient"("organizationId", "dni");

-- CreateIndex
CREATE INDEX "Appointment_professionalId_startAt_idx" ON "public"."Appointment"("professionalId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_professionalId_status_startAt_idx" ON "public"."Appointment"("professionalId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startAt_idx" ON "public"."Appointment"("patientId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startAt_idx" ON "public"."Appointment"("organizationId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_status_startAt_idx" ON "public"."Appointment"("organizationId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicBooking_appointmentId_key" ON "public"."PublicBooking"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicBooking_token_key" ON "public"."PublicBooking"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PublicBooking_intakeToken_key" ON "public"."PublicBooking"("intakeToken");

-- CreateIndex
CREATE INDEX "PublicBooking_professionalId_status_slotDate_idx" ON "public"."PublicBooking"("professionalId", "status", "slotDate");

-- CreateIndex
CREATE INDEX "PublicBooking_token_idx" ON "public"."PublicBooking"("token");

-- CreateIndex
CREATE INDEX "PublicBooking_intakeToken_idx" ON "public"."PublicBooking"("intakeToken");

-- CreateIndex
CREATE INDEX "PublicBooking_expiresAt_idx" ON "public"."PublicBooking"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicBooking_professionalId_slotDate_idx" ON "public"."PublicBooking"("professionalId", "slotDate");

-- CreateIndex
CREATE UNIQUE INDEX "Revenue_appointmentId_key" ON "public"."Revenue"("appointmentId");

-- CreateIndex
CREATE INDEX "Revenue_professionalId_occurredAt_idx" ON "public"."Revenue"("professionalId", "occurredAt");

-- CreateIndex
CREATE INDEX "Revenue_organizationId_occurredAt_idx" ON "public"."Revenue"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "Expense_professionalId_occurredAt_idx" ON "public"."Expense"("professionalId", "occurredAt");

-- CreateIndex
CREATE INDEX "Expense_organizationId_occurredAt_idx" ON "public"."Expense"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "MessageLog_professionalId_createdAt_idx" ON "public"."MessageLog"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_professionalId_messageType_idx" ON "public"."MessageLog"("professionalId", "messageType");

-- CreateIndex
CREATE INDEX "MessageLog_professionalId_patientId_createdAt_idx" ON "public"."MessageLog"("professionalId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_organizationId_createdAt_idx" ON "public"."MessageLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_organizationId_patientId_createdAt_idx" ON "public"."MessageLog"("organizationId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_appointmentId_idx" ON "public"."MessageLog"("appointmentId");

-- CreateIndex
CREATE INDEX "WebhookEventLog_professionalId_createdAt_idx" ON "public"."WebhookEventLog"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEventLog_organizationId_createdAt_idx" ON "public"."WebhookEventLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEventLog_source_eventType_idx" ON "public"."WebhookEventLog"("source", "eventType");

-- CreateIndex
CREATE INDEX "Notification_professionalId_readAt_createdAt_idx" ON "public"."Notification"("professionalId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_readAt_createdAt_idx" ON "public"."Notification"("organizationId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_appointmentId_idx" ON "public"."Notification"("appointmentId");

-- CreateIndex
CREATE INDEX "Notification_patientId_idx" ON "public"."Notification"("patientId");

-- CreateIndex
CREATE INDEX "MessageTemplate_professionalId_idx" ON "public"."MessageTemplate"("professionalId");

-- CreateIndex
CREATE INDEX "MessageTemplate_organizationId_idx" ON "public"."MessageTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_professionalId_messageType_key" ON "public"."MessageTemplate"("professionalId", "messageType");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizationId_messageType_key" ON "public"."MessageTemplate"("organizationId", "messageType");

-- CreateIndex
CREATE INDEX "ClinicalRecord_patientId_createdAt_idx" ON "public"."ClinicalRecord"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalRecord_professionalId_createdAt_idx" ON "public"."ClinicalRecord"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalRecord_organizationId_createdAt_idx" ON "public"."ClinicalRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalRecord_appointmentId_idx" ON "public"."ClinicalRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalRecord_deletedAt_idx" ON "public"."ClinicalRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalRecord_appointmentId_recordType_key" ON "public"."ClinicalRecord"("appointmentId", "recordType");

-- AddForeignKey
ALTER TABLE "public"."Professional" ADD CONSTRAINT "Professional_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecificDateAvailability" ADD CONSTRAINT "SpecificDateAvailability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityRange" ADD CONSTRAINT "AvailabilityRange_weeklyAvailabilityId_fkey" FOREIGN KEY ("weeklyAvailabilityId") REFERENCES "public"."WeeklyAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilityRange" ADD CONSTRAINT "AvailabilityRange_specificDateAvailabilityId_fkey" FOREIGN KEY ("specificDateAvailabilityId") REFERENCES "public"."SpecificDateAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AvailabilitySlotCapacity" ADD CONSTRAINT "AvailabilitySlotCapacity_specificDateAvailabilityId_fkey" FOREIGN KEY ("specificDateAvailabilityId") REFERENCES "public"."SpecificDateAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicBooking" ADD CONSTRAINT "PublicBooking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicBooking" ADD CONSTRAINT "PublicBooking_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicBooking" ADD CONSTRAINT "PublicBooking_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revenue" ADD CONSTRAINT "Revenue_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revenue" ADD CONSTRAINT "Revenue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revenue" ADD CONSTRAINT "Revenue_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookEventLog" ADD CONSTRAINT "WebhookEventLog_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookEventLog" ADD CONSTRAINT "WebhookEventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageTemplate" ADD CONSTRAINT "MessageTemplate_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageTemplate" ADD CONSTRAINT "MessageTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
