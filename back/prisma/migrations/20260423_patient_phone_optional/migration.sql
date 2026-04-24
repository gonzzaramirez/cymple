-- Make patient phone optional
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL;
