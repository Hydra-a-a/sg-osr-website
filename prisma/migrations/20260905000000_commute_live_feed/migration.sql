-- CreateEnum
CREATE TYPE "CommuteAlertKind" AS ENUM ('DELAY', 'CROWDING', 'FLOODING', 'CLOSURE', 'RECOVERY', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "CommuteAlertSeverity" AS ENUM ('INFO', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "CommuteAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'HIDDEN');

-- CreateTable
CREATE TABLE "CommuteAlert" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "corridorLabel" TEXT NOT NULL,
    "kind" "CommuteAlertKind" NOT NULL,
    "severity" "CommuteAlertSeverity" NOT NULL,
    "status" "CommuteAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "reporterEmail" TEXT NOT NULL,
    "privateNote" TEXT NOT NULL DEFAULT '',
    "officialTitle" TEXT NOT NULL DEFAULT '',
    "officialSummary" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "moderatedBy" TEXT NOT NULL DEFAULT '',
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuteAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuteAlertConfirmation" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "confirmerEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommuteAlertConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommuteAlert_alertId_key" ON "CommuteAlert"("alertId");

-- CreateIndex
CREATE INDEX "CommuteAlert_status_expiresAt_createdAt_idx" ON "CommuteAlert"("status", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommuteAlert_corridorId_status_expiresAt_idx" ON "CommuteAlert"("corridorId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CommuteAlert_reporterEmail_createdAt_idx" ON "CommuteAlert"("reporterEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommuteAlertConfirmation_alertId_confirmerEmail_key" ON "CommuteAlertConfirmation"("alertId", "confirmerEmail");

-- CreateIndex
CREATE INDEX "CommuteAlertConfirmation_confirmerEmail_createdAt_idx" ON "CommuteAlertConfirmation"("confirmerEmail", "createdAt");

-- AddForeignKey
ALTER TABLE "CommuteAlertConfirmation" ADD CONSTRAINT "CommuteAlertConfirmation_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "CommuteAlert"("alertId") ON DELETE CASCADE ON UPDATE CASCADE;
