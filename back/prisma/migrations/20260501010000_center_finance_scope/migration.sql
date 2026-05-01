-- Allow center-wide finance movements while preserving existing professional movements.
ALTER TABLE "Revenue" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "organizationId" TEXT;

-- Backfill organizationId for existing movements associated with center professionals.
UPDATE "Revenue" r
SET "organizationId" = p."organizationId"
FROM "Professional" p
WHERE r."professionalId" = p."id"
  AND p."organizationId" IS NOT NULL;

UPDATE "Expense" e
SET "organizationId" = p."organizationId"
FROM "Professional" p
WHERE e."professionalId" = p."id"
  AND p."organizationId" IS NOT NULL;

ALTER TABLE "Revenue" ALTER COLUMN "professionalId" DROP NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "professionalId" DROP NOT NULL;

CREATE INDEX "Revenue_organizationId_occurredAt_idx" ON "Revenue"("organizationId", "occurredAt");
CREATE INDEX "Expense_organizationId_occurredAt_idx" ON "Expense"("organizationId", "occurredAt");

ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
