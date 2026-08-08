-- Stable directory identity, restricted Drive logo metadata, and export status.
ALTER TABLE "DirectoryEntry" ADD COLUMN "directoryKey" TEXT;

UPDATE "DirectoryEntry"
SET "directoryKey" = 'legacy-' || "id"
WHERE "directoryKey" IS NULL OR "directoryKey" = '';

ALTER TABLE "DirectoryEntry" ALTER COLUMN "directoryKey" SET NOT NULL;
CREATE UNIQUE INDEX "DirectoryEntry_directoryKey_key" ON "DirectoryEntry"("directoryKey");

CREATE TABLE "DirectoryLogo" (
  "id" TEXT NOT NULL,
  "directoryEntryId" TEXT NOT NULL,
  "driveFileId" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL DEFAULT '',
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectoryLogo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectoryLogo_directoryEntryId_key" ON "DirectoryLogo"("directoryEntryId");
CREATE INDEX "DirectoryLogo_driveFileId_idx" ON "DirectoryLogo"("driveFileId");

CREATE TABLE "DirectoryExportState" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "lastAttemptAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "requestedBy" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectoryExportState_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DirectoryLogo"
  ADD CONSTRAINT "DirectoryLogo_directoryEntryId_fkey"
  FOREIGN KEY ("directoryEntryId") REFERENCES "DirectoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP VIEW IF EXISTS public_sheet_directory_entries;
CREATE VIEW public_sheet_directory_entries AS
SELECT
  "directoryKey",
  "entryType",
  "name",
  "roleOrOffice",
  "councilOrUnit",
  "imageUrl",
  "profileUrl",
  "sortOrder"
FROM "DirectoryEntry"
WHERE "enabled" = true;

GRANT SELECT ON public_sheet_directory_entries TO osr_export_ro, osr_admin_ro;
