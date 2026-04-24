-- CreateEnum
CREATE TYPE "AppointmentModality" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'PAYMENT_REMINDER';

-- AlterTable: Professional
ALTER TABLE "Professional" ADD COLUMN "paymentAlias" TEXT;

-- AlterTable: Appointment
ALTER TABLE "Appointment" ADD COLUMN "modality" "AppointmentModality" NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE "Appointment" ADD COLUMN "paymentReminderSentAt" TIMESTAMP(3);

-- AlterTable: Revenue
ALTER TABLE "Revenue" ADD COLUMN "paymentMethod" "PaymentMethod";
