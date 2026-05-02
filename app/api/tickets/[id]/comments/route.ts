import path from 'path';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAuthorizedUsers } from '@/lib/auth';
import { appendSheetData, getSheetData, updateSheetCell } from '@/lib/sheets';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { formatPhtStorageTimestamp } from '@/lib/date-time';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { buildTicketStatusHistoryMessage, isTicketStatusHistoryMessage, lookupTicketByIdForOwner, TICKET_COLS } from '@/lib/tickets';
import { deriveEffectivePortalRole, hasLeaderPrivilege } from '@/lib/portal-mode';
import { uploadTicketAttachmentToDrive } from '@/lib/google-drive';
import { emitGrievanceCommentNotifications, processGrievanceNotificationQueue, resolveGrievanceSubmitterEmail } from '@/lib/grievance-notifications';
import { triggerTicketQueueInBackground } from '@/lib/queue-trigger';
import { safeProcessImmediateNotifications } from '@/lib/immediate-notification-processing';

const COMMENTS_TAB = 'Ticket_Comments_Appeals';
const COMMENTS_RANGE = `${COMMENTS_TAB}!A2:H`;
const COMMENTS_APPEND_RANGE = `${COMMENTS_TAB}!A1`;
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

const TicketCommentSchema = z.object({
    message: z.string().trim().min(2).max(5000),
    trackingToken: z.string().trim().max(256).optional().default(''),
    isAppeal: z.boolean().optional().default(false),
});

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function parseBoolean(value: FormDataEntryValue | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return false;
}

function validateAttachment(file: File): void {
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

function getTicketSpreadsheetId(): string {
    const id = String(process.env.TICKET_SPREADSHEET_ID || '').trim();
    if (!id) {
        throw new Error('TICKET_SPREADSHEET_ID missing');
    }
    return id;
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

async function resolveOfficerDisplayName(authorEmail: string, fallback = 'OSR Officer'): Promise<string> {
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

const COMMENT_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomBase36(length: number): string {
    const bytes = randomBytes(length);
    let output = '';
    for (const byte of bytes) {
        output += COMMENT_ID_ALPHABET[byte % COMMENT_ID_ALPHABET.length];
    }
    return output;
}

function generateCommentId(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `C-${yy}${mm}-${randomBase36(8)}`;
}

async function resolveCommentAccess(request: NextRequest, ticketId: string, trackingToken: string) {
    const session = await auth();
    const portalModeCookie = request.cookies.get('osr_portal_mode')?.value;
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

async function transitionTicketToAppealedIfNeeded(spreadsheetId: string, ticketId: string, requestedAppeal: boolean) {
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
        await updateSheetCell(spreadsheetId, `Tickets!C${sheetRowNumber}`, [['Appealed']]);
        return true;
    }

    return false;
}

async function lookupTicketNotificationRow(spreadsheetId: string, ticketId: string): Promise<string[] | null> {
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

async function buildSyntheticStatusHistoryComment(ticketId: string, trackingToken: string, ownerEmail?: string | null) {
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ip = getClientIp(request);
    const { id } = await params;
    const ticketId = String(id || '').trim().toUpperCase();

    if (!ticketId) {
        return withNoStore(toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Missing ticket ID')));
    }

    const url = new URL(request.url);
    const trackingToken = String(url.searchParams.get('access') || '').trim();

    try {
        const access = await resolveCommentAccess(request, ticketId, trackingToken);
        if (!access.ownerAllowed) {
            return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Unauthorized to view ticket discussion.')));
        }

        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`ticket_comments_get_${ticketId}_${principal}_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const spreadsheetId = getTicketSpreadsheetId();
        const rows = await getSheetData(spreadsheetId, COMMENTS_RANGE);
        const ticketRow = await lookupTicketNotificationRow(spreadsheetId, ticketId);
        const studentDisplayName = String(ticketRow?.[TICKET_COLS.NAME] || '').trim() || 'Student';
        const comments = (rows || [])
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

        const hasStatusHistoryEntry = comments.some((comment) => isTicketStatusHistoryMessage(comment.message));
        const syntheticStatusComment = hasStatusHistoryEntry ? null : await buildSyntheticStatusHistoryComment(
            ticketId,
            trackingToken,
            access.session?.user?.email,
        );
        const commentItems = syntheticStatusComment ? [...comments, syntheticStatusComment] : comments;

        const officerNames = new Map<string, string>();
        await Promise.all(commentItems.map(async (comment) => {
            if (comment.authorRole !== 'OFFICER' && comment.authorRole !== 'LEADER') return;
            const key = String(comment.authorEmail || '').trim().toLowerCase();
            if (!key || officerNames.has(key)) return;
            officerNames.set(key, await resolveOfficerDisplayName(comment.authorEmail, 'OSR Officer'));
        }));

        commentItems.sort((left, right) => parseCommentTimestamp(left.timestamp) - parseCommentTimestamp(right.timestamp));

        return withNoStore(NextResponse.json({
            comments: commentItems.map((comment) => ({
                commentId: comment.commentId,
                ticketId: comment.ticketId,
                timestamp: comment.timestamp,
                author: (comment.authorRole === 'OFFICER' || comment.authorRole === 'LEADER')
                    ? (officerNames.get(String(comment.authorEmail || '').trim().toLowerCase()) || 'OSR Officer')
                    : studentDisplayName,
                authorRole: comment.authorRole,
                message: comment.message,
                attachmentUrl: comment.attachmentUrl,
                isAppeal: comment.isAppeal,
            })),
        }));
    } catch (error) {
        console.error('[Ticket Comments API] GET error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ip = getClientIp(request);
    const { id } = await params;
    const ticketId = String(id || '').trim().toUpperCase();

    if (!ticketId) {
        return withNoStore(toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Missing ticket ID')));
    }

    try {
        const contentType = request.headers.get('content-type') || '';
        let payload: unknown;
        let attachmentFile: File | undefined;

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            const candidateFile = form.get('attachment');
            attachmentFile = candidateFile instanceof File && candidateFile.size > 0 ? candidateFile : undefined;

            payload = {
                message: String(form.get('message') || ''),
                trackingToken: String(form.get('trackingToken') || ''),
                isAppeal: parseBoolean(form.get('isAppeal') || undefined),
            };
        } else {
            const body = await request.json();
            payload = {
                message: String((body as { message?: unknown })?.message || ''),
                trackingToken: String((body as { trackingToken?: unknown })?.trackingToken || ''),
                isAppeal: parseBoolean((body as { isAppeal?: unknown })?.isAppeal as boolean | undefined),
            };
        }

        const parsed = TicketCommentSchema.safeParse(payload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid comment payload.')));
        }

        const access = await resolveCommentAccess(request, ticketId, parsed.data.trackingToken);
        if (!access.ownerAllowed) {
            return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Unauthorized to post ticket discussion.')));
        }

        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`ticket_comments_post_${ticketId}_${principal}_${ip}`, 30, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        let author = 'Student';
        let authorEmail = access.session?.user?.email?.toLowerCase().trim() || '';
        let authorRole = 'STUDENT';

        if (access.privileged) {
            const privilegedRole = String(access.effectiveRole || 'leader').toUpperCase();
            authorRole = privilegedRole;
            author = String(access.session?.user?.name || '').trim() || await resolveOfficerDisplayName(authorEmail, 'Officer');
        } else {
            authorEmail = authorEmail || 'anonymous@rtu.edu.ph';
            authorRole = 'STUDENT';
            author = access.session?.user?.name || 'Student';
        }

        let attachmentUrl = '';
        if (attachmentFile) {
            validateAttachment(attachmentFile);
            const buffer = Buffer.from(await attachmentFile.arrayBuffer());
            attachmentUrl = await uploadTicketAttachmentToDrive({
                ticketId,
                fileName: attachmentFile.name,
                mimeType: attachmentFile.type || 'application/octet-stream',
                buffer,
            });
        }

        const spreadsheetId = getTicketSpreadsheetId();
        const statusTransitioned = await transitionTicketToAppealedIfNeeded(spreadsheetId, ticketId, parsed.data.isAppeal);

        const timestamp = formatPhtStorageTimestamp(new Date());
        const comment = {
            commentId: generateCommentId(),
            ticketId,
            timestamp,
            author,
            authorRole,
            message: parsed.data.message,
            attachmentUrl,
            isAppeal: parsed.data.isAppeal,
        };

        await appendSheetData(spreadsheetId, COMMENTS_APPEND_RANGE, [[
            comment.commentId,
            comment.ticketId,
            comment.timestamp,
            authorEmail,
            comment.authorRole,
            comment.message,
            comment.attachmentUrl,
            comment.isAppeal ? 'TRUE' : 'FALSE',
        ]]);

        const ticketRow = await lookupTicketNotificationRow(spreadsheetId, ticketId);
        if (ticketRow) {
            const recipientEmail = resolveGrievanceSubmitterEmail({
                recipientEmail: String(ticketRow[TICKET_COLS.EMAIL] || '').trim().toLowerCase(),
                optionalUpdateDestination: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION] || '').trim().toLowerCase(),
                optionalUpdateChannel: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_CHANNEL] || '').trim(),
                optionalUpdateDestinationStatus: String(ticketRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION_STATUS] || '').trim(),
            });

            const grievanceNotificationQueue = {
                spreadsheetId,
                queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
                queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
                queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
            };

            const notificationIds = await emitGrievanceCommentNotifications({
                queue: grievanceNotificationQueue,
                ticketId,
                category: String(ticketRow[TICKET_COLS.CATEGORY] || '').trim(),
                subject: String(ticketRow[TICKET_COLS.SUBJECT] || '').trim(),
                recipientEmail,
                recipientName: String(ticketRow[TICKET_COLS.NAME] || '').trim() || 'Student',
                studentEmail: String(ticketRow[TICKET_COLS.EMAIL] || '').trim().toLowerCase(),
                commentId: comment.commentId,
                commentTimestamp: new Date().toISOString(),
                commentMessage: comment.message,
                commentAttachmentUrl: comment.attachmentUrl,
                authorEmail,
                authorName: author,
                authorRole,
                isAppeal: comment.isAppeal,
            });

            await safeProcessImmediateNotifications({
                queueName: 'ticket comment',
                notificationIds,
                processQueue: (options) => processGrievanceNotificationQueue(grievanceNotificationQueue, options),
                triggerFallback: triggerTicketQueueInBackground,
            });
        }

        return withNoStore(NextResponse.json({
            success: true,
            comment,
            statusTransitioned,
        }));
    } catch (error) {
        console.error('[Ticket Comments API] POST error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
