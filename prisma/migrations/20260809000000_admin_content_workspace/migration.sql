ALTER TABLE "NewsPost" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NewsPost" ADD COLUMN "manualTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "manualBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "articleTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "articleBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "imageAlt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "section" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NewsPost" ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE "NewsPost" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DirectoryEntry" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "QuickLink" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'ExternalLink';
ALTER TABLE "QuickLink" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "HubGuide" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "AdminContentDraft" (
  "id" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "baseVersion" INTEGER NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "stagedAssets" JSONB,
  "editorId" TEXT NOT NULL,
  "editorLabel" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminContentDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminContentDraft_contentType_entityId_key" ON "AdminContentDraft"("contentType", "entityId");
CREATE INDEX "AdminContentDraft_editorId_updatedAt_idx" ON "AdminContentDraft"("editorId", "updatedAt");

CREATE TABLE "AdminContentRevision" (
  "id" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "publisherId" TEXT NOT NULL,
  "publisherLabel" TEXT NOT NULL DEFAULT '',
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminContentRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminContentRevision_contentType_entityId_version_key" ON "AdminContentRevision"("contentType", "entityId", "version");
CREATE INDEX "AdminContentRevision_contentType_entityId_publishedAt_idx" ON "AdminContentRevision"("contentType", "entityId", "publishedAt");
