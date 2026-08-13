-- Durable, privacy-preserving submission ledger for retry-safe mutations.
CREATE TYPE "SubmissionOperation" AS ENUM ('TICKET', 'PROPOSAL', 'LOST_FOUND');
CREATE TYPE "SubmissionAttemptState" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'COMPENSATED');

CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "operation" "SubmissionOperation" NOT NULL,
    "keyHash" TEXT NOT NULL,
    "actorHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "state" "SubmissionAttemptState" NOT NULL DEFAULT 'PENDING',
    "entityId" TEXT,
    "stagedDriveFileId" TEXT,
    "stagedDriveResourceKey" TEXT,
    "errorCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubmissionAttempt_operation_keyHash_key" ON "SubmissionAttempt"("operation", "keyHash");
CREATE INDEX "SubmissionAttempt_state_expiresAt_idx" ON "SubmissionAttempt"("state", "expiresAt");
CREATE INDEX "SubmissionAttempt_entityId_idx" ON "SubmissionAttempt"("entityId");
