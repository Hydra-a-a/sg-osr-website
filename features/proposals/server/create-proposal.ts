import { uploadProposalAttachmentToDrive } from '@/lib/google-drive';
import { getSpreadsheetSheetTitles, appendSheetData } from '@/lib/sheets';
import { ApiError } from '@/lib/api-errors';
import { formatPhtStorageTimestamp } from '@/lib/date-time';
import {
  PROPOSALS_APPEND_RANGE,
  PROPOSALS_TAB_NAME,
  extractRowNumberFromUpdatedRange,
  formatProposalId,
  generateProposalTrackingToken,
  hashProposalTrackingToken,
  resolveProposalsSpreadsheetId,
} from '@/lib/proposals';
import { emitProposalSubmissionNotifications, processProposalNotifications } from '@/lib/proposal-notifications';
import { triggerProposalQueueInBackground } from '@/lib/queue-trigger';
import { safeProcessImmediateNotifications } from '@/lib/immediate-notification-processing';
import type { ProposalSubmissionData } from '@/features/proposals/schema';
import { resolveSubmissionSource } from '@/lib/submission-source';

const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

function maskId(value: string): string {
  const raw = String(value || '').trim();
  if (raw.length < 10) return raw;
  return `${raw.slice(0, 5)}...${raw.slice(-5)}`;
}

export async function createProposalSubmission(input: {
  data: ProposalSubmissionData;
  attachment: File;
  submitterEmail: string;
  submitterName: string;
}) {
  if (resolveSubmissionSource('PROPOSAL_SOURCE') === 'db') {
    throw new ApiError(503, 'PROPOSAL_DB_CUTOVER_REQUIRED', 'Proposal database cutover is not enabled for this deployment.', undefined, false);
  }

  const { data, attachment, submitterEmail, submitterName } = input;
  const buffer = Buffer.from(await attachment.arrayBuffer());

  const driveLink = await uploadProposalAttachmentToDrive({
    title: data.title,
    submitterEmail,
    fileName: attachment.name,
    mimeType: attachment.type,
    buffer,
  });

  const { spreadsheetId, usedFallback } = resolveProposalsSpreadsheetId();
  if (usedFallback) {
    console.warn('[Proposals API] PROPOSALS_SPREADSHEET_ID is missing or invalid; using TICKET_SPREADSHEET_ID fallback.');
  }

  const sheetTitles = await getSpreadsheetSheetTitles(spreadsheetId);
  if (!sheetTitles.includes(PROPOSALS_TAB_NAME)) {
    console.error('[Proposals API] Missing proposals tab in configured spreadsheet:', {
      spreadsheetId: maskId(spreadsheetId),
      expectedTab: PROPOSALS_TAB_NAME,
      availableTabs: sheetTitles,
    });
    throw new ApiError(
      500,
      'MISSING_PROPOSALS_TAB',
      `Missing required sheet tab: ${PROPOSALS_TAB_NAME}.`,
      { detail: 'Create the Project_Proposals tab with headers A:M before submitting proposals.' },
      false,
    );
  }

  const timestamp = formatPhtStorageTimestamp(new Date());
  const trackingToken = generateProposalTrackingToken();
  const rowData = [
    timestamp,
    submitterEmail,
    submitterName,
    data.category,
    data.title,
    'Pending Review',
    driveLink,
    data.description,
    data.projectType,
    '',
    '',
    '',
    hashProposalTrackingToken(trackingToken),
  ];

  const appendResult = await appendSheetData(spreadsheetId, PROPOSALS_APPEND_RANGE, [rowData]);
  const updatedRange = (appendResult as { updates?: { updatedRange?: string } })?.updates?.updatedRange;
  const rowNumber = extractRowNumberFromUpdatedRange(updatedRange);
  const proposalId = rowNumber ? formatProposalId(rowNumber) : '';

  if (proposalId) {
    const proposalNotificationQueue = {
      spreadsheetId,
      queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
      queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
      queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
    };
    const notificationIds = await emitProposalSubmissionNotifications({
      queue: proposalNotificationQueue,
      proposalId,
      submitterName,
      submitterEmail,
      title: data.title,
      category: data.category,
      projectType: data.projectType,
      description: data.description,
      attachmentUrl: driveLink,
      submittedAt: new Date().toISOString(),
    });

    await safeProcessImmediateNotifications({
      queueName: 'proposal',
      notificationIds,
      processQueue: (options) => processProposalNotifications(proposalNotificationQueue, options),
      triggerFallback: triggerProposalQueueInBackground,
    });
  }

  return {
    success: true,
    link: driveLink,
    persistedToSheet: true,
    proposalId,
    rowNumber,
    trackingAccessToken: trackingToken,
  };
}
