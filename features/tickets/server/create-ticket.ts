import { ApiError } from '@/lib/api-errors';
import { logAuditAction } from '@/lib/audit';
import { uploadTicketAttachmentToDrive } from '@/lib/google-drive';
import { emitGrievanceSubmissionNotifications, processGrievanceNotificationQueue } from '@/lib/grievance-notifications';
import { safeProcessImmediateNotifications } from '@/lib/immediate-notification-processing';
import { triggerTicketQueueInBackground } from '@/lib/queue-trigger';
import { generateTicketCredentials, hashTicketTrackingToken, writeTicketToSheet } from '@/lib/tickets';
import type { TicketSubmissionData } from '@/features/tickets/schema';
import { sanitizeAttachmentUrl, validateAttachment } from '@/features/tickets/server/attachments';

const TICKET_NOTIFICATION_QUEUE_SHEET_TAB = process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue';
const TICKET_NOTIFICATION_QUEUE_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A2:N`;
const TICKET_NOTIFICATION_QUEUE_APPEND_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A1`;

function getTicketSpreadsheetId(): string {
  const id = String(process.env.TICKET_SPREADSHEET_ID || '').trim();
  if (!id) {
    throw new Error('TICKET_SPREADSHEET_ID environment variable is not set.');
  }
  return id;
}

export async function createTicketSubmission({
  data,
  attachmentFile,
  sessionEmail,
  sessionUserName,
  ip,
}: {
  data: TicketSubmissionData;
  attachmentFile?: File;
  sessionEmail: string;
  sessionUserName?: string | null;
  ip: string;
}) {
  const complaintNarrative = (data.complaintNarrative || data.message || '').trim();
  const attachmentUrlFromPayload = sanitizeAttachmentUrl(data.attachmentUrl);
  const attachmentKind = data.attachmentKind;
  const optionalUpdatesOptIn = Boolean(data.updatesOptIn);
  const optionalUpdatesChannel = optionalUpdatesOptIn ? 'Email' : 'None';
  const optionalUpdatesDestination = optionalUpdatesOptIn
    ? String(data.updatesDestination || '').trim().toLowerCase()
    : '';
  const optionalUpdateNotes = optionalUpdatesOptIn ? String(data.updatesNotes || '').trim() : '';

  const isAnonymous = data.isAnonymous;
  const studentName = isAnonymous ? 'Anonymous Student' : (sessionUserName?.trim() || 'Student');
  const studentEmail = isAnonymous ? '' : sessionEmail;

  let confirmationEmail: string | undefined;
  if (data.contactEmail) {
    const normalizedContact = data.contactEmail.trim().toLowerCase();
    if (normalizedContact !== sessionEmail) {
      logAuditAction('TICKET_SUBMISSION_FAILED', {
        ip,
        reason: 'Contact email mismatch',
      });
      throw new ApiError(400, 'INVALID_CONTACT_EMAIL', 'Confirmation email must match your signed-in RTU account.');
    }
    confirmationEmail = normalizedContact;
  }

  const { ticketId, trackingToken } = generateTicketCredentials();
  const submittedAt = new Date().toISOString();

  let attachmentUrl = attachmentUrlFromPayload;
  if (attachmentFile) {
    validateAttachment(attachmentFile, attachmentKind);
    try {
      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      attachmentUrl = await uploadTicketAttachmentToDrive({
        ticketId,
        fileName: attachmentFile.name,
        mimeType: attachmentFile.type || 'application/octet-stream',
        buffer,
      });
    } catch (error) {
      logAuditAction('TICKET_SUBMISSION_FAILED', {
        ip,
        reason: 'Attachment upload unavailable',
      });
      throw new ApiError(
        503,
        'ATTACHMENT_UPLOAD_UNAVAILABLE',
        'Attachment upload is unavailable for the current Drive target. Please use a Shared Drive folder or submit without an attachment for now.',
        { reason: error instanceof Error ? error.message : 'Upload failed' },
        true,
      );
    }
  }

  await writeTicketToSheet({
    ticketId,
    timestamp: submittedAt,
    studentId: data.studentId,
    campus: data.campus,
    college: data.college,
    category: data.category,
    subject: data.subject,
    name: studentName,
    email: studentEmail,
    complaintNarrative,
    attachmentUrl,
    trackingTokenHash: hashTicketTrackingToken(trackingToken),
    optionalUpdateOptIn: optionalUpdatesOptIn,
    optionalUpdateChannel: optionalUpdatesChannel,
    optionalUpdateDestination: optionalUpdatesDestination,
    optionalUpdateDestinationStatus: optionalUpdatesOptIn ? 'Verified' : 'Unverified',
    optionalUpdateNotes: optionalUpdateNotes,
  });

  const grievanceNotificationQueue = {
    spreadsheetId: getTicketSpreadsheetId(),
    queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
    queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
    queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
  };

  const notificationIds = await emitGrievanceSubmissionNotifications({
    queue: grievanceNotificationQueue,
    ticketId,
    studentId: data.studentId,
    name: studentName,
    studentEmail,
    campus: data.campus,
    college: data.college,
    category: data.category,
    subject: data.subject,
    complaintNarrative,
    attachmentUrl,
    submittedAt,
    recipientEmail: confirmationEmail || studentEmail,
    optionalUpdateDestination: optionalUpdatesDestination,
    optionalUpdateChannel: optionalUpdatesChannel,
    optionalUpdateDestinationStatus: optionalUpdatesOptIn ? 'Verified' : 'Unverified',
  });

  await safeProcessImmediateNotifications({
    queueName: 'ticket',
    notificationIds,
    processQueue: (options) => processGrievanceNotificationQueue(grievanceNotificationQueue, options),
    triggerFallback: triggerTicketQueueInBackground,
  });

  logAuditAction('TICKET_SUBMITTED', {
    ticketId,
    campus: data.campus,
    college: data.college,
    category: data.category,
    isAnonymous,
    hasAttachment: Boolean(attachmentUrl),
  });

  return {
    success: true,
    ticketId,
    trackingAccessToken: trackingToken,
    message: confirmationEmail
      ? 'Your grievance has been submitted. You will receive a confirmation email shortly.'
      : `Your grievance has been submitted. Save your tracking link to view full updates.${optionalUpdatesOptIn ? ' Optional update contact was saved and is pending officer verification.' : ''}`,
  };
}
