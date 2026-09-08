

-- CreateTable
CREATE TABLE "TransparencySubmission" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL DEFAULT 'Supreme Student Council',
    "leaderEmail" TEXT NOT NULL,
    "leaderName" TEXT NOT NULL,
    "submittedLink" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseWorkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYearStart" INTEGER NOT NULL,
    "periodKind" TEXT NOT NULL,
    "periodNumber" INTEGER,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "turnIn" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reportId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "classroomSubmissionId" TEXT,
    "classroomState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransparencyReport" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL DEFAULT 'Supreme Student Council',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "academicYearStart" INTEGER NOT NULL,
    "periodKind" TEXT NOT NULL,
    "periodNumber" INTEGER,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "asOfDate" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "preparerEmail" TEXT,
    "publisherEmail" TEXT,
    "preparedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publicReleaseConfirmedAt" TIMESTAMP(3),
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "pdfFileId" TEXT,
    "pdfResourceKey" TEXT NOT NULL DEFAULT '',
    "pdfFileName" TEXT NOT NULL DEFAULT '',
    "pdfSizeBytes" INTEGER,
    "pdfFolderId" TEXT,
    "predecessorId" TEXT,
    "correctionReason" TEXT NOT NULL DEFAULT '',
    "supersededAt" TIMESTAMP(3),
    "withdrawalReason" TEXT NOT NULL DEFAULT '',
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransparencyBudgetLine" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "publicNote" TEXT NOT NULL DEFAULT '',
    "allocated" DECIMAL(14,2) NOT NULL,
    "spent" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TransparencyBudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransparencyFeedback" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT,
    "submitterEmail" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT NOT NULL DEFAULT '',
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransparencySubmission_reportId_key" ON "TransparencySubmission"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "TransparencySubmission_idempotencyKey_key" ON "TransparencySubmission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransparencySubmission_status_createdAt_idx" ON "TransparencySubmission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransparencyReport_slug_key" ON "TransparencyReport"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TransparencyReport_pdfFileId_key" ON "TransparencyReport"("pdfFileId");

-- CreateIndex
CREATE INDEX "TransparencyReport_status_publishedAt_idx" ON "TransparencyReport"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "TransparencyReport_academicYearStart_periodKind_idx" ON "TransparencyReport"("academicYearStart", "periodKind");

-- CreateIndex
CREATE INDEX "TransparencyBudgetLine_reportId_sortOrder_idx" ON "TransparencyBudgetLine"("reportId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransparencyFeedback_submitterEmail_createdAt_idx" ON "TransparencyFeedback"("submitterEmail", "createdAt");

-- CreateIndex
CREATE INDEX "TransparencyFeedback_status_createdAt_idx" ON "TransparencyFeedback"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TransparencySubmission" ADD CONSTRAINT "TransparencySubmission_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TransparencyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyReport" ADD CONSTRAINT "TransparencyReport_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "TransparencyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyBudgetLine" ADD CONSTRAINT "TransparencyBudgetLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TransparencyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyFeedback" ADD CONSTRAINT "TransparencyFeedback_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TransparencyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransparencyFeedback" ADD CONSTRAINT "TransparencyFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TransparencyBudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;