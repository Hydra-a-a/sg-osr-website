CREATE TYPE "LostFoundSource" AS ENUM ('CSO', 'STUDENT');
CREATE TYPE "LostFoundReportType" AS ENUM ('LOST', 'FOUND');
CREATE TYPE "LostFoundStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'RESOLVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "LostFoundCommentRole" AS ENUM ('STUDENT', 'OFFICER');
CREATE TYPE "LostFoundAttachmentKind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "LostFoundItem" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "source" "LostFoundSource" NOT NULL,
  "reportType" "LostFoundReportType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3),
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitterEmail" TEXT NOT NULL DEFAULT '',
  "submitterName" TEXT NOT NULL DEFAULT '',
  "csoReference" TEXT NOT NULL DEFAULT '',
  "status" "LostFoundStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewedBy" TEXT NOT NULL DEFAULT '',
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT NOT NULL DEFAULT '',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LostFoundAttachment" (
  "id" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "driveFileId" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL DEFAULT '',
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "kind" "LostFoundAttachmentKind" NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LostFoundAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LostFoundComment" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorEmail" TEXT NOT NULL,
  "authorRole" "LostFoundCommentRole" NOT NULL,
  "message" TEXT NOT NULL,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "moderatedBy" TEXT NOT NULL DEFAULT '',
  "moderatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LostFoundComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LostFoundItem_itemId_key" ON "LostFoundItem"("itemId");
CREATE INDEX "LostFoundItem_source_status_reportedAt_idx" ON "LostFoundItem"("source", "status", "reportedAt");
CREATE INDEX "LostFoundItem_status_updatedAt_idx" ON "LostFoundItem"("status", "updatedAt");
CREATE UNIQUE INDEX "LostFoundAttachment_attachmentId_key" ON "LostFoundAttachment"("attachmentId");
CREATE INDEX "LostFoundAttachment_itemId_createdAt_idx" ON "LostFoundAttachment"("itemId", "createdAt");
CREATE INDEX "LostFoundAttachment_driveFileId_idx" ON "LostFoundAttachment"("driveFileId");
CREATE UNIQUE INDEX "LostFoundComment_commentId_key" ON "LostFoundComment"("commentId");
CREATE INDEX "LostFoundComment_itemId_timestamp_idx" ON "LostFoundComment"("itemId", "timestamp");
CREATE INDEX "LostFoundComment_itemId_isHidden_timestamp_idx" ON "LostFoundComment"("itemId", "isHidden", "timestamp");

ALTER TABLE "LostFoundAttachment" ADD CONSTRAINT "LostFoundAttachment_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "LostFoundItem"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LostFoundComment" ADD CONSTRAINT "LostFoundComment_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "LostFoundItem"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;
