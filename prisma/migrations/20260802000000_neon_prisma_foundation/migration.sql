CREATE TYPE "PortalRole" AS ENUM ('student', 'leader', 'officer');
CREATE TYPE "TicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed', 'Appealed');
CREATE TYPE "ProposalStatus" AS ENUM ('PendingReview', 'UnderReview', 'Approved', 'Rejected', 'NeedsRevision');
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'retry', 'sent', 'skipped', 'dead_letter');
CREATE TYPE "NotificationEntityType" AS ENUM ('ticket', 'proposal', 'commute_route', 'public_content');
CREATE TYPE "TicketCommentRole" AS ENUM ('STUDENT', 'LEADER', 'OFFICER');
CREATE TYPE "ProposalCommentRole" AS ENUM ('LEADER', 'OFFICER');
CREATE TYPE "CommuteReviewStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'FlaggedForReview', 'ApprovedWithWarning');
CREATE TYPE "CommuteVoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

CREATE TABLE "AuthorizedUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "council" TEXT NOT NULL DEFAULT '',
  "role" "PortalRole" NOT NULL,
  "accessEnabled" BOOLEAN NOT NULL DEFAULT true,
  "approvedBy" TEXT NOT NULL DEFAULT '',
  "lastAccessAt" TIMESTAMP(3),
  "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  "revokedAfter" TIMESTAMP(3),
  "legacySheetRow" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizedUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'Open',
  "studentId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "studentEmail" TEXT NOT NULL,
  "campus" TEXT NOT NULL,
  "college" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL DEFAULT '',
  "complaintNarrative" TEXT NOT NULL,
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "resolutionNotes" TEXT NOT NULL DEFAULT '',
  "trackingTokenHash" TEXT NOT NULL,
  "lastNotifiedSignature" TEXT NOT NULL DEFAULT '',
  "lastNotifiedAt" TIMESTAMP(3),
  "officerStatusDraft" TEXT NOT NULL DEFAULT '',
  "officerResolutionDraft" TEXT NOT NULL DEFAULT '',
  "officerSendControl" TEXT NOT NULL DEFAULT '',
  "officerUpdatedBy" TEXT NOT NULL DEFAULT '',
  "officerUpdatedAt" TIMESTAMP(3),
  "officerPublishNote" TEXT NOT NULL DEFAULT '',
  "officerLastPublishedAt" TIMESTAMP(3),
  "officerLastPublishedBy" TEXT NOT NULL DEFAULT '',
  "optionalUpdateOptIn" BOOLEAN NOT NULL DEFAULT false,
  "optionalUpdateChannel" TEXT NOT NULL DEFAULT 'None',
  "optionalUpdateDestination" TEXT NOT NULL DEFAULT '',
  "optionalUpdateDestinationStatus" TEXT NOT NULL DEFAULT 'Unverified',
  "optionalUpdateVerifiedAt" TIMESTAMP(3),
  "optionalUpdateVerifiedBy" TEXT NOT NULL DEFAULT '',
  "optionalUpdateLastNotifiedAt" TIMESTAMP(3),
  "optionalUpdateNotes" TEXT NOT NULL DEFAULT '',
  "legacySheetRow" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketComment" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "authorRole" "TicketCommentRole" NOT NULL DEFAULT 'STUDENT',
  "message" TEXT NOT NULL,
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "isAppeal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketStatusEvent" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "previous" "TicketStatus",
  "next" "TicketStatus" NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Proposal" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "submitterEmail" TEXT NOT NULL,
  "submitterName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ProposalStatus" NOT NULL DEFAULT 'PendingReview',
  "attachmentUrl" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "projectType" TEXT NOT NULL,
  "reviewNotes" TEXT NOT NULL DEFAULT '',
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3),
  "trackingTokenHash" TEXT NOT NULL,
  "legacySheetRow" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifiedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalComment" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "authorRole" "ProposalCommentRole" NOT NULL,
  "message" TEXT NOT NULL,
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalStatusEvent" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "previous" "ProposalStatus",
  "next" "ProposalStatus" NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationJob" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "entityType" "NotificationEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommuteRoute" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "stepsJson" JSONB NOT NULL,
  "fareEstimateRange" TEXT NOT NULL DEFAULT '',
  "durationMinutes" INTEGER,
  "notes" TEXT NOT NULL DEFAULT '',
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "contributorName" TEXT NOT NULL,
  "contributorStudentId" TEXT NOT NULL,
  "contributorDisplayMode" TEXT NOT NULL,
  "contributorDisplayLabel" TEXT NOT NULL,
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "downvotes" INTEGER NOT NULL DEFAULT 0,
  "reviewStatus" "CommuteReviewStatus" NOT NULL DEFAULT 'Pending',
  "reviewedBy" TEXT NOT NULL DEFAULT '',
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT NOT NULL DEFAULT '',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "originLat" DECIMAL(9,6),
  "originLng" DECIMAL(9,6),
  "destinationLat" DECIMAL(9,6),
  "destinationLng" DECIMAL(9,6),
  "stopPointsJson" JSONB,
  "routeGeometryJson" JSONB,
  "legacySheetRow" INTEGER,
  CONSTRAINT "CommuteRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommuteVote" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "voterHash" TEXT NOT NULL,
  "voteType" "CommuteVoteType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommuteVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommuteReport" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "reporterEmail" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommuteReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsPost" (
  "id" TEXT NOT NULL,
  "sourcePageId" TEXT NOT NULL,
  "sourcePageName" TEXT NOT NULL,
  "sourcePageSlug" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL DEFAULT '',
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "fbLink" TEXT NOT NULL DEFAULT '',
  "targetPagesJson" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsSource" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "pageName" TEXT NOT NULL,
  "pageSlug" TEXT NOT NULL,
  "tokenAlias" TEXT NOT NULL,
  "defaultTargetsJson" JSONB NOT NULL,
  "syncLimit" INTEGER NOT NULL DEFAULT 10,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsRoutingRule" (
  "id" TEXT NOT NULL,
  "hashtag" TEXT NOT NULL,
  "targetPagesJson" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsRoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectoryEntry" (
  "id" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "roleOrOffice" TEXT NOT NULL DEFAULT '',
  "councilOrUnit" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT NOT NULL DEFAULT '',
  "profileUrl" TEXT NOT NULL DEFAULT '',
  "publicDataJson" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuickLink" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuickLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HubGuide" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "fileUrl" TEXT NOT NULL,
  "driveFileId" TEXT NOT NULL DEFAULT '',
  "resourceKey" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '',
  "publicDataJson" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HubGuide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorizedUser_email_key" ON "AuthorizedUser"("email");
ALTER TABLE "AuthorizedUser" ADD CONSTRAINT "AuthorizedUser_email_lowercase_check" CHECK ("email" = lower("email"));
CREATE UNIQUE INDEX "AuthorizedUser_email_lower_unique" ON "AuthorizedUser"(lower("email"));
CREATE INDEX "AuthorizedUser_role_accessEnabled_idx" ON "AuthorizedUser"("role", "accessEnabled");
CREATE UNIQUE INDEX "Ticket_ticketId_key" ON "Ticket"("ticketId");
CREATE INDEX "Ticket_studentEmail_submittedAt_idx" ON "Ticket"("studentEmail", "submittedAt");
CREATE INDEX "Ticket_status_submittedAt_idx" ON "Ticket"("status", "submittedAt");
CREATE INDEX "Ticket_category_submittedAt_idx" ON "Ticket"("category", "submittedAt");
CREATE UNIQUE INDEX "TicketComment_commentId_key" ON "TicketComment"("commentId");
CREATE INDEX "TicketComment_ticketId_timestamp_idx" ON "TicketComment"("ticketId", "timestamp");
CREATE INDEX "TicketComment_authorEmail_idx" ON "TicketComment"("authorEmail");
CREATE INDEX "TicketStatusEvent_ticketId_createdAt_idx" ON "TicketStatusEvent"("ticketId", "createdAt");
CREATE INDEX "TicketStatusEvent_actorEmail_createdAt_idx" ON "TicketStatusEvent"("actorEmail", "createdAt");
CREATE UNIQUE INDEX "Proposal_proposalId_key" ON "Proposal"("proposalId");
CREATE UNIQUE INDEX "Proposal_legacySheetRow_key" ON "Proposal"("legacySheetRow");
CREATE INDEX "Proposal_submitterEmail_submittedAt_idx" ON "Proposal"("submitterEmail", "submittedAt");
CREATE INDEX "Proposal_status_submittedAt_idx" ON "Proposal"("status", "submittedAt");
CREATE INDEX "Proposal_category_submittedAt_idx" ON "Proposal"("category", "submittedAt");
CREATE UNIQUE INDEX "ProposalComment_commentId_key" ON "ProposalComment"("commentId");
CREATE INDEX "ProposalComment_proposalId_timestamp_idx" ON "ProposalComment"("proposalId", "timestamp");
CREATE INDEX "ProposalComment_authorEmail_idx" ON "ProposalComment"("authorEmail");
CREATE INDEX "ProposalStatusEvent_proposalId_createdAt_idx" ON "ProposalStatusEvent"("proposalId", "createdAt");
CREATE INDEX "ProposalStatusEvent_actorEmail_createdAt_idx" ON "ProposalStatusEvent"("actorEmail", "createdAt");
CREATE UNIQUE INDEX "NotificationJob_notificationId_key" ON "NotificationJob"("notificationId");
CREATE UNIQUE INDEX "NotificationJob_dedupeKey_key" ON "NotificationJob"("dedupeKey");
CREATE INDEX "NotificationJob_status_nextRetryAt_createdAt_idx" ON "NotificationJob"("status", "nextRetryAt", "createdAt");
CREATE INDEX "NotificationJob_entityType_entityId_idx" ON "NotificationJob"("entityType", "entityId");
CREATE INDEX "NotificationJob_recipientEmail_idx" ON "NotificationJob"("recipientEmail");
CREATE UNIQUE INDEX "CommuteRoute_routeId_key" ON "CommuteRoute"("routeId");
CREATE UNIQUE INDEX "CommuteRoute_legacySheetRow_key" ON "CommuteRoute"("legacySheetRow");
CREATE INDEX "CommuteRoute_visible_reviewStatus_idx" ON "CommuteRoute"("visible", "reviewStatus");
CREATE INDEX "CommuteRoute_contributorStudentId_submittedAt_idx" ON "CommuteRoute"("contributorStudentId", "submittedAt");
CREATE INDEX "CommuteRoute_origin_destination_idx" ON "CommuteRoute"("origin", "destination");
CREATE UNIQUE INDEX "CommuteVote_routeId_voterHash_key" ON "CommuteVote"("routeId", "voterHash");
CREATE INDEX "CommuteVote_voteType_createdAt_idx" ON "CommuteVote"("voteType", "createdAt");
CREATE INDEX "CommuteReport_routeId_createdAt_idx" ON "CommuteReport"("routeId", "createdAt");
CREATE INDEX "CommuteReport_reporterEmail_createdAt_idx" ON "CommuteReport"("reporterEmail", "createdAt");
CREATE INDEX "NewsPost_enabled_publishedAt_idx" ON "NewsPost"("enabled", "publishedAt");
CREATE INDEX "NewsPost_sourcePageSlug_publishedAt_idx" ON "NewsPost"("sourcePageSlug", "publishedAt");
CREATE UNIQUE INDEX "NewsSource_pageId_key" ON "NewsSource"("pageId");
CREATE UNIQUE INDEX "NewsRoutingRule_hashtag_key" ON "NewsRoutingRule"("hashtag");
CREATE INDEX "DirectoryEntry_entryType_enabled_sortOrder_idx" ON "DirectoryEntry"("entryType", "enabled", "sortOrder");
CREATE INDEX "QuickLink_enabled_sortOrder_idx" ON "QuickLink"("enabled", "sortOrder");
CREATE INDEX "HubGuide_enabled_sortOrder_idx" ON "HubGuide"("enabled", "sortOrder");
CREATE INDEX "HubGuide_driveFileId_idx" ON "HubGuide"("driveFileId");

ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("ticketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("ticketId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("proposalId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalStatusEvent" ADD CONSTRAINT "ProposalStatusEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("proposalId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommuteVote" ADD CONSTRAINT "CommuteVote_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CommuteRoute"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommuteReport" ADD CONSTRAINT "CommuteReport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CommuteRoute"("routeId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE VIEW public_sheet_news_posts AS
SELECT
  "id",
  "sourcePageName",
  "sourcePageSlug",
  "message",
  "imageUrl",
  "publishedAt",
  "fbLink",
  "targetPagesJson"
FROM "NewsPost"
WHERE "enabled" = true;

CREATE VIEW public_sheet_commute_routes AS
SELECT
  "routeId",
  "origin",
  "destination",
  "stepsJson",
  "fareEstimateRange",
  "durationMinutes",
  "notes",
  "contributorDisplayMode",
  "contributorDisplayLabel",
  "upvotes",
  "downvotes",
  "reviewStatus",
  "reviewedAt",
  "reviewNotes",
  "submittedAt",
  "originLat",
  "originLng",
  "destinationLat",
  "destinationLng",
  "stopPointsJson",
  "routeGeometryJson"
FROM "CommuteRoute"
WHERE "visible" = true
  AND "reviewStatus" IN ('Approved', 'ApprovedWithWarning', 'FlaggedForReview');

CREATE VIEW public_sheet_directory_entries AS
SELECT
  "entryType",
  "name",
  "roleOrOffice",
  "councilOrUnit",
  "imageUrl",
  "profileUrl",
  "publicDataJson",
  "sortOrder"
FROM "DirectoryEntry"
WHERE "enabled" = true;

CREATE VIEW public_sheet_quick_links AS
SELECT
  "label",
  "href",
  "category",
  "description",
  "sortOrder"
FROM "QuickLink"
WHERE "enabled" = true;

CREATE VIEW public_sheet_hub_guides AS
SELECT
  "title",
  "description",
  "fileUrl",
  "driveFileId",
  "resourceKey",
  "category",
  "publicDataJson",
  "sortOrder"
FROM "HubGuide"
WHERE "enabled" = true;
