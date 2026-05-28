import path from 'path';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { getAuthorizedUsers } from '@/lib/auth';
import { batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { ApiError } from '@/lib/api-errors';
import { redactErrorForLog } from '@/lib/security';
import {
    appendGrievanceComment,
    buildTicketStatusHistoryMessage,
    generateGrievanceCommentId,
    isTicketStatusHistoryMessage,
    lookupTicketByIdForOwner,
    TICKET_COLS,
} from '@/lib/tickets';
import { deriveEffectivePortalRole, hasLeaderPrivilege } from '@/lib/portal-mode';
import { uploadTicketAttachmentToDrive } from '@/lib/google-drive';
import { formatPhtStorageTimestamp } from '@/lib/date-time';
import { emitGrievanceCommentNotifications, processGrievanceNotificationQueue, resolveGrievanceSubmitterEmail } from '@/lib/grievance-notifications';
import { triggerTicketQueueInBackground } from '@/lib/queue-trigger';
import { safeProcessImmediateNotifications } from '@/lib/immediate-notification-processing';

const COMMENTS_RANGE = 'Ticket_Comments_Appeals!A2:H';
const TICKETS_STATUS_RANGE = 'Tickets!A2:C';
const TICKET_FULL_RANGE = 'Tickets!A2:AF';
const TICKET_NOTIFICATION_QUEUE_SHEET_TAB = process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue';
const TICKET_NOTIFICATION_QUEUE_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A2:N`;
const TICKET_NOTIFICATION_QUEUE_APPEND_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A1`;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const TicketCommentSchema = z.object({
    message: z.string().trim().min(2).max(5000),
    trackingToken: z.string().trim().max(256).optional().default(''),
    isAppeal: z.boolean().optional().default(false),
});

export function parseBoolean(value: FormDataEntryValue | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return false;
}

export function validateAttachment(file: File): void {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment must be 10MB or smaller.');
    }

    const extension = path.extname(file.name || '').toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
        throw new ApiError(400, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only PNG, JPG, PDF, DOC, and DOCX files are allowed.');
    }

    if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
        throw new ApiError(400, 'ATTACHMENT_MIME_NOT_ALLOWED', 'Unsupported attachment MIME type.');
    }
}

function isTerminalAppealStatus(value: unknown): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'closed' || normalized === 'rejected' || normalized === 'resolved';
}

function parseCommentTimestamp(value: string): number {
    const raw = String(value || '').trim();
    if (!raw) return 0;

    const isoLikePht = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+PHT$/i);
    if (isoLikePht) {
        const [, y, m, d, hh, mm, ss] = isoLikePht;
        return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) - 8, Number(mm), Number(ss));
    }

    const localePht = raw.replace(',', '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)(?:\s+PHT)?$/i);
    if (localePht) {
        const [, mm, dd, yyyy, hh12, min, sec = '00', meridiem] = localePht;
        let hour = Number(hh12) % 12;
        if (meridiem.toUpperCase() === 'PM') hour += 12;
        return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), hour - 8, Number(min), Number(sec));
    }

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

export async function resolveOfficerDisplayName(authorEmail: string, fallback = 'OSR Officer'): Promise<string> {
    const normalizedEmail = String(authorEmail || '').trim().toLowerCase();
    if (!normalizedEmail) return fallback;

    try {
        const users = await getAuthorizedUsers();
        const user = users.get(normalizedEmail);
        if (user?.name?.trim()) return user.name.trim();
        if (user?.council?.trim()) return user.council.trim();
    } catch (error) {
        console.warn('[Ticket Comments API] Failed to resolve officer display name:', redactErrorForLog(error));
    }

    return fallback;
}

export async function resolveCommentAccess(
    session: Session | null,
    portalModeCookie: string | undefined,
    ticketId: string,
    trackingToken: string,
) {
    const effectiveRole = deriveEffectivePortalRole((session?.user as { role?: unknown } | undefined)?.role, portalModeCookie);
    const privileged = hasLeaderPrivilege(effectiveRole);

    if (privileged) {
        return {
            privileged: true,
            ownerAllowed: true,
            session,
            effectiveRole,
        };
    }

    const ownerEmail = session?.user?.email || '';
    const ticket = await lookupTicketByIdForOwner(ticketId, {
        trackingToken,
        ownerEmail,
    });

    return {
        privileged: false,
        ownerAllowed: Boolean(ticket && !ticket.detailsRedacted),
        session,
        effectiveRole,
        ticket,
    };
}

export async function transitionTicketToAppealedIfNeeded(spreadsheetId: string, ticketId: string, requestedAppeal: boolean) {
    if (!requestedAppeal) {
        return false;
    }

    const rows = await getSheetData(spreadsheetId, TICKETS_STATUS_RANGE);
    const normalizedTicketId = String(ticketId || '').trim().toUpperCase();

    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || [];
        const rowTicketId = String(row[0] || '').trim().toUpperCase();
        if (rowTicketId !== normalizedTicketId) {
            continue;
        }

        const currentStatus = String(row[2] || '').trim();
        if (!isTerminalAppealStatus(currentStatus)) {
            return false;
        }

        const sheetRowNumber = index + 2;
        await batchUpdateSheetData(spreadsheetId, [
            {
                range: `Tickets!C${sheetRowNumber}`,
                values: [['Appealed']],
            },
        ]);
        return true;
    }

    return false;
}

export async function lookupTicketNotificationRow(spreadsheetId: string, ticketId: string): Promise<string[] | null> {
    const rows = await getSheetData(spreadsheetId, TICKET_FULL_RANGE);
    const normalizedTicketId = String(ticketId || '').trim().toUpperCase();

    for (const row of rows) {
        const rowTicketId = String(row[TICKET_COLS.TICKET_ID] || '').trim().toUpperCase();
        if (rowTicketId === normalizedTicketId) {
            return row;
        }
    }

    return null;
}

export async function buildSyntheticStatusHistoryComment(ticketId: string, trackingToken: string, ownerEmail?: string | null) {
    const ticket = await lookupTicketByIdForOwner(ticketId, { trackingToken, ownerEmail });
    if (!ticket?.status || !ticket.submittedAt) {
        return null;
    }

    return {
        commentId: `STATUS-${ticket.ticketId}-${ticket.submittedAt}`,
        ticketId: ticket.ticketId,
        timestamp: ticket.submittedAt,
        authorEmail: '',
        author: 'OSR Officer',
        authorRole: 'OFFICER',
        message: buildTicketStatusHistoryMessage(ticket.status),
        attachmentUrl: '',
        isAppeal: false,
    };
}

export async function listTicketComments(spreadsheetId: string, ticketId: string) {
    const rows = await getSheetData(spreadsheetId, COMMENTS_RANGE);
    return (rows || [])
        .filter((row: unknown[]) => String(row[1] || '').trim().toUpperCase() === ticketId)
        .map((row: unknown[]) => ({
            commentId: String(row[0] || '').trim(),
            ticketId: String(row[1] || '').trim(),
            timestamp: String(row[2] || '').trim(),
            authorEmail: String(row[3] || '').trim().toLowerCase(),
            authorRole: String(row[4] || '').trim() || 'STUDENT',
            message: String(row[5] || '').trim(),
            attachmentUrl: String(row[6] || '').trim(),
            isAppeal: String(row[7] || '').trim().toUpperCase() === 'TRUE',
        }));
}

export async function buildCommentResponseItems(input: {
    comments: Array<{
        commentId: string;
        ticketId: string;
        timestamp: string;
        authorEmail: string;
        authorRole: string;
        message: string;
        attachmentUrl: string;
        isAppeal: boolean;
    }>;
    ticketId: string;
    trackingToken: string;
    ownerEmail?: string | null;
    studentDisplayName: string;
}) {
    const hasStatusHistoryEntry = input.comments.some((comment) => isTicketStatusHistoryMessage(comment.message));
    const syntheticStatusComment = hasStatusHistoryEntry ? null : await buildSyntheticStatusHistoryComment(
        input.ticketId,
        input.trackingToken,
        input.ownerEmail,
    );
    const commentItems = syntheticStatusComment ? [...input.comments, syntheticStatusComment] : input.comments;

    const officerNames = new Map<string, string>();
    await Promise.all(commentItems.map(async (comment) => {
        if (comment.authorRole !== 'OFFICER' && comment.authorRole !== 'LEADER') return;
        const key = String(comment.authorEmail || '').trim().toLowerCase();
        if (!key || officerNames.has(key)) return;
        officerNames.set(key, await resolveOfficerDisplayName(comment.authorEmail, 'OSR Officer'));
    }));

    commentItems.sort((left, right) => parseCommentTimestamp(left.timestamp) - parseCommentTimestamp(right.timestamp));

    return commentItems.map((comment) => ({
        commentId: comment.commentId,
        ticketId: comment.ticketId,
        timestamp: comment.timestamp,
        author: (comment.authorRole === 'OFFICER' || comment.authorRole === 'LEADER')
            ? (officerNames.get(String(comment.authorEmail || '').trim().toLowerCase()) || 'OSR Officer')
            : input.studentDisplayName,
        authorRole: comment.authorRole,
        message: comment.message,
        attachmentUrl: comment.attachmentUrl,
        isAppeal: comment.isAppeal,
    }));
}

export function normalizeCommentAuthor(access: {
    privileged: boolean;
    effectiveRole?: unknown;
    session?: Session | null;
}) {
    let author = 'Student';
    let authorEmail = access.session?.user?.email?.toLowerCase().trim() || '';
    let authorRole = 'STUDENT';

    if (access.privileged) {
        const privilegedRole = String(access.effectiveRole || 'leader').toUpperCase();
        authorRole = privilegedRole;
        author = String(access.session?.user?.name || '').trim() || 'Officer';
    } else {
        authorEmail = authorEmail || 'anonymous@rtu.edu.ph';
        authorRole = 'STUDENT';
        author = access.session?.user?.name || 'Student';
    }

    return {
        author,
        authorEmail,
        authorRole,
    };
}

export async function appendGrievanceCommentOrchestration(input: {
    spreadsheetId: string;
    ticketId: string;
    message: string;
    isAppeal: boolean;
    author: string;
    authorEmail: string;
    authorRole: string;
    attachmentFile?: File;
}) {
    let attachmentUrl = '';
    if (input.attachmentFile) {
        validateAttachment(input.attachmentFile);
        const buffer = Buffer.from(await input.attachmentFile.arrayBuffer());
        attachmentUrl = await uploadTicketAttachmentToDrive({
            ticketId: input.ticketId,
            fileName: input.attachmentFile.name,
            mimeType: input.attachmentFile.type || 'application/octet-stream',
            buffer,
        });
    }

    const statusTransitioned = await transitionTicketToAppealedIfNeeded(input.spreadsheetId, input.ticketId, input.isAppeal);

    const timestamp = formatPhtStorageTimestamp(new Date());
    const comment = {
        commentId: generateGrievanceCommentId(),
        ticketId: input.ticketId,
        timestamp,
        author: input.author,
        authorRole: input.authorRole,
        message: input.message,
        attachmentUrl,
        isAppeal: input.isAppeal,
    };

    await appendGrievanceComment({
        commentId: comment.commentId,
        ticketId: comment.ticketId,
        timestamp: comment.timestamp,
        authorEmail: input.authorEmail,
        authorRole: comment.authorRole,
        message: comment.message,
        attachmentUrl: comment.attachmentUrl,
        isAppeal: comment.isAppeal,
    });

    const ticketRow = await lookupTicketNotificationRow(input.spreadsheetId, input.ticketId);
    if (ticketRow) {
        const recipientEmail = resolveGrievanceSubmitterEmail({
            recipientEmail: String(ticketRow[TICKET_COLS.EMAIL] || '').trim().toLowerCase(),
            optionalUpdateDestination: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION] || '').trim().toLowerCase(),
            optionalUpdateChannel: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_CHANNEL] || '').trim(),
            optionalUpdateDestinationStatus: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION_STATUS] || '').trim(),
        });

        const grievanceNotificationQueue = {
            spreadsheetId: input.spreadsheetId,
            queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
            queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
            queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
        };

        const notificationIds = await emitGrievanceCommentNotifications({
            queue: grievanceNotificationQueue,
            ticketId: input.ticketId,
            category: String(ticketRow[TICKET_COLS.CATEGORY] || '').trim(),
            subject: String(ticketRow[TICKET_COLS.SUBJECT] || '').trim(),
            recipientEmail,
            recipientName: String(ticketRow[TICKET_COLS.NAME] || '').trim() || 'Student',
            studentEmail: String(ticketRow[TICKET_COLS.EMAIL] || '').trim().toLowerCase(),
            commentId: comment.commentId,
            commentTimestamp: new Date().toISOString(),
            commentMessage: comment.message,
            commentAttachmentUrl: comment.attachmentUrl,
            authorEmail: input.authorEmail,
            authorName: input.author,
            authorRole: input.authorRole,
            isAppeal: comment.isAppeal,
        });

        await safeProcessImmediateNotifications({
            queueName: 'ticket comment',
            notificationIds,
            processQueue: (options) => processGrievanceNotificationQueue(grievanceNotificationQueue, options),
            triggerFallback: triggerTicketQueueInBackground,
        });
    }

    return {
        comment,
        statusTransitioned,
    };
}
