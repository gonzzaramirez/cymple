-- Create ShortUrl table for the URL shortener feature
CREATE TABLE "ShortUrl" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "professionalId" TEXT,
    "organizationId" TEXT,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortUrl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortUrl_code_key" ON "ShortUrl"("code");
CREATE INDEX "ShortUrl_code_idx" ON "ShortUrl"("code");
CREATE INDEX "ShortUrl_professionalId_idx" ON "ShortUrl"("professionalId");
CREATE INDEX "ShortUrl_expiresAt_idx" ON "ShortUrl"("expiresAt");
