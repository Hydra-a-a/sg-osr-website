import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { uploadProposalAttachmentToDrive } from '@/lib/google-drive';
import { ApiError } from '@/lib/api-errors';
import { formatPhtStorageTimestamp } from '@/lib/date-time';
import {
  appendProposalComment,
  buildProposalStatusHistoryMessage,
  generateProposalCommentId,
  isProposalStatusHistoryMessage,
  listProposalComments,
  parseProposalId,
  resolveProposalsSpreadsheetId,
} from '@/lib/proposals';
import { emitProposalCommentNotifications, processProposalNotifications } from '@/lib/proposal-notifications';
import { triggerProposalQueueInBackground } from '@/lib/queue-trigger';
import { safeProcessImmediateNotifications } from '@/lib/immediate-notification-processing';
import { resolveOfficerDisplayName, resolveProposalAccess } from '@/features/proposals/server/access';
import { validateAttachment } from '@/features/proposals/server/attachments';

const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

function assertProposalAccess(access: Awaited<ReturnType<typeof resolveProposalAccess>>): asserts access is Awaited<ReturnType<typeof resolveProposalAccess>> & {
  proposal: NonNullable<Awaited<ReturnType<typeof resolveProposalAccess>>['proposal']>;
} {
  if (access.proposal) {
    return;
  }

  throw new ApiError(
    access.session?.user?.email ? 404 : 401,
    access.session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
    access.session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
  );
}

export function parseCommentTimestamp(value: string): number {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const phtMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) PHT$/i);
  if (phtMatch) {
    const [, year, month, day, hour, minute, second] = phtMatch;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, Number(minute), Number(second));
  }

  const slashMatch = normalized.replace(',', '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i);
  if (slashMatch) {
    const [, month, day, year, rawHour, minute, second, meridiem] = slashMatch;
    let hour = Number(rawHour);
    if (meridiem.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 8, Number(minute), Number(second));
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function buildSyntheticStatusHistoryComment(proposal: Awaited<ReturnType<typeof resolveProposalAccess>>['proposal']) {
  const timestamp = proposal?.updatedAt || proposal?.submittedAt || '';
  if (!proposal?.status || !timestamp) {
    return null;
  }

  return {
    commentId: `STATUS-${proposal.proposalId}-${timestamp}`,
    proposalId: proposal.proposalId,
    timestamp,
    authorEmail: proposal.updatedBy || '',
    authorRole: 'OFFICER',
    authorName: await resolveOfficerDisplayName(proposal.updatedBy, 'OSR Officer'),
    message: buildProposalStatusHistoryMessage(proposal.status),
    attachmentUrl: '',
  };
}

export function parseProposalIdOrNull(proposalId: string): string | null {
  const normalized = String(proposalId || '').trim().toUpperCase();
  return parseProposalId(normalized) ? normalized : null;
}

export async function listProposalCommentsForResponse(input: {
  proposalId: string;
  trackingToken: string;
  session: Session | null;
  portalModeCookie: string | undefined;
}) {
  const access = await resolveProposalAccess(input);
  assertProposalAccess(access);
  const comments = await listProposalComments(input.proposalId);
  const hasStatusHistoryEntry = comments.some((comment) => isProposalStatusHistoryMessage(comment.message));
  const syntheticStatusComment = hasStatusHistoryEntry ? null : await buildSyntheticStatusHistoryComment(access.proposal);
  const commentItems = syntheticStatusComment ? [...comments, syntheticStatusComment] : comments;
  const officerNames = new Map<string, string>();

  await Promise.all(commentItems.map(async (comment) => {
    if (comment.authorRole !== 'OFFICER') {
      return;
    }
    const key = String(comment.authorEmail || '').trim().toLowerCase();
    if (!key || officerNames.has(key)) {
      return;
    }
    officerNames.set(key, await resolveOfficerDisplayName(comment.authorEmail, 'OSR Officer'));
  }));

  commentItems.sort((left, right) => parseCommentTimestamp(left.timestamp) - parseCommentTimestamp(right.timestamp));

  return {
    access,
    comments: commentItems.map((comment) => ({
      commentId: comment.commentId,
      proposalId: comment.proposalId,
      timestamp: comment.timestamp,
      authorEmail: comment.authorEmail,
      authorRole: comment.authorRole,
      authorName: comment.authorRole === 'OFFICER'
        ? (officerNames.get(String(comment.authorEmail || '').trim().toLowerCase()) || 'OSR Officer')
        : access.proposal.submitterName || 'Proposal Submitter',
      message: comment.message,
      attachmentUrl: comment.attachmentUrl,
    })),
  };
}

export async function appendProposalCommentOrchestration(input: {
  proposalId: string;
  message: string;
  trackingToken: string;
  attachmentFile?: File;
  session: Session | null;
  portalModeCookie: string | undefined;
}) {
  const access = await resolveProposalAccess({
    proposalId: input.proposalId,
    trackingToken: input.trackingToken,
    session: input.session,
    portalModeCookie: input.portalModeCookie,
  });
  assertProposalAccess(access);

  let attachmentUrl = '';
  if (input.attachmentFile) {
    validateAttachment(input.attachmentFile);
    const buffer = Buffer.from(await input.attachmentFile.arrayBuffer());
    attachmentUrl = await uploadProposalAttachmentToDrive({
      title: access.proposal.title || access.proposal.proposalId,
      submitterEmail: access.session?.user?.email || access.proposal.submitterEmail,
      fileName: input.attachmentFile.name,
      mimeType: input.attachmentFile.type || 'application/octet-stream',
      buffer,
    });
  }

  const authorEmail = access.session?.user?.email?.toLowerCase().trim() || access.proposal.submitterEmail;
  const authorRole = access.isOfficer ? 'OFFICER' : 'LEADER';
  const authorName = access.isOfficer
    ? (String(access.session?.user?.name || '').trim() || await resolveOfficerDisplayName(authorEmail, 'OSR Officer'))
    : (access.session?.user?.name || access.proposal.submitterName || 'Leader');
  const timestamp = formatPhtStorageTimestamp(new Date());

  const comment = {
    commentId: generateProposalCommentId(),
    proposalId: input.proposalId,
    timestamp,
    authorEmail,
    authorRole,
    message: input.message,
    attachmentUrl,
  };

  await appendProposalComment(comment);

  const { spreadsheetId } = resolveProposalsSpreadsheetId();
  const proposalNotificationQueue = {
    spreadsheetId,
    queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
    queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
    queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
  };

  const notificationIds = await emitProposalCommentNotifications({
    queue: proposalNotificationQueue,
    proposalId: input.proposalId,
    submitterName: access.proposal.submitterName || 'Leader',
    submitterEmail: access.proposal.submitterEmail,
    title: access.proposal.title,
    commentId: comment.commentId,
    authorEmail,
    authorName,
    authorRole,
    message: comment.message,
    attachmentUrl: comment.attachmentUrl,
    createdAt: new Date().toISOString(),
  });

  await safeProcessImmediateNotifications({
    queueName: 'proposal comment',
    notificationIds,
    processQueue: (options) => processProposalNotifications(proposalNotificationQueue, options),
    triggerFallback: triggerProposalQueueInBackground,
  });

  return {
    access,
    comment,
    authorName,
  };
}
