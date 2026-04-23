import path from 'path';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { PORTAL_MODE_COOKIE, deriveEffectivePortalRole } from '@/lib/portal-mode';
import { TICKET_COLS, appendGrievanceComment, buildTicketStatusHistoryMessage, generateGrievanceCommentId } from '@/lib/tickets';
import type { TicketStatus } from '@/lib/ticket-constants';
import { emitGrievanceAdminUpdateNotifications, resolveGrievanceSubmitterEmail } from '@/lib/grievance-notifications';
import { triggerTicketQueueInBackground } from '@/lib/queue-trigger';
import { uploadTicketAttachmentToDrive } from '@/lib/google-drive';

const TICKET_RANGE = 'Tickets!A2:AF';
const TICKET_STATUS_VALUES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Appealed'] as const;
const TICKET_NOTIFICATION_QUEUE_SHEET_TAB = process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue';
const TICKET_NOTIFICATION_QUEUE_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A2:N`;
const TICKET_NOTIFICATION_QUEUE_APPEND_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A1`;

const MAX_RESOLUTION_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESOLUTION_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_RESOLUTION_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const TicketAdminUpdateSchema = z.object({
    ticketId: z.string().trim().regex(/^TKT-\d{4}-[A-Z0-9]{4,16}$/i, 'Invalid ticket ID format'),
    status: z.enum(TICKET_STATUS_VALUES).optional(),
    resolutionNotes: z.string().trim().max(5000).optional(),
    publish: z.boolean().optional().default(false),
    publishNote: z.string().trim().max(500).optional().default(''),
});

interface AdminTicketRow {
    ticketId: string;
    submittedAt: string;
    status: TicketStatus;
    studentId: string;
    studentName: string;
    studentEmail: string;
    campus: string;
    college: string;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl: string;
    resolutionNotes: string;
    officerStatusDraft: string;
    officerResolutionDraft: string;
    officerSendControl: string;
    officerUpdatedBy: string;
    officerUpdatedAt: string;
    officerPublishNote: string;
    officerLastPublishedAt: string;
    officerLastPublishedBy: string;
    optionalUpdateOptIn: string;
    optionalUpdateChannel: string;
    optionalUpdateDestination: string;
    optionalUpdateDestinationStatus: string;
}

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function toPHTString(isoUtc: string): string {
    const date = new Date(isoUtc);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const byType = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value || '';

    return `${byType('year')}-${byType('month')}-${byType('day')} ${byType('hour')}:${byType('minute')}:${byType('second')} PHT`;
}

function getTicketSpreadsheetId(): string {
    const id = String(process.env.TICKET_SPREADSHEET_ID || '').trim();
    if (!id) {
        throw new Error('TICKET_SPREADSHEET_ID environment variable is not set.');
    }
    return id;
}

async function requireOfficerSession(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const portalMode = request.cookies.get(PORTAL_MODE_COOKIE)?.value;
    const effectiveRole = deriveEffectivePortalRole(session.user.role, portalMode);
    if (effectiveRole !== 'officer') {
        throw new ApiError(403, 'FORBIDDEN', 'Officer mode is required for grievance controls.');
    }

    return session;
}

function mapRowToAdminTicket(row: string[]): AdminTicketRow {
    return {
        ticketId: String(row[TICKET_COLS.TICKET_ID] || '').trim(),
        submittedAt: String(row[TICKET_COLS.TIMESTAMP] || '').trim(),
        status: (String(row[TICKET_COLS.STATUS] || 'Open').trim() || 'Open') as TicketStatus,
        studentId: String(row[TICKET_COLS.STUDENT_ID] || '').trim(),
        studentName: String(row[TICKET_COLS.NAME] || '').trim(),
        studentEmail: String(row[TICKET_COLS.EMAIL] || '').trim(),
        campus: String(row[TICKET_COLS.CAMPUS] || '').trim(),
        college: String(row[TICKET_COLS.COLLEGE] || '').trim(),
        category: String(row[TICKET_COLS.CATEGORY] || '').trim(),
        subject: String(row[TICKET_COLS.SUBJECT] || '').trim(),
        complaintNarrative: String(row[TICKET_COLS.COMPLAINT] || '').trim(),
        attachmentUrl: String(row[TICKET_COLS.ATTACHMENT_URL] || '').trim(),
        resolutionNotes: String(row[TICKET_COLS.RESOLUTION_NOTES] || '').trim(),
        officerStatusDraft: String(row[TICKET_COLS.OFFICER_STATUS_DRAFT] || '').trim(),
        officerResolutionDraft: String(row[TICKET_COLS.OFFICER_RESOLUTION_DRAFT] || '').trim(),
        officerSendControl: String(row[TICKET_COLS.OFFICER_SEND_CONTROL] || '').trim(),
        officerUpdatedBy: String(row[TICKET_COLS.OFFICER_UPDATED_BY] || '').trim(),
        officerUpdatedAt: String(row[TICKET_COLS.OFFICER_UPDATED_AT] || '').trim(),
        officerPublishNote: String(row[TICKET_COLS.OFFICER_PUBLISH_NOTE] || '').trim(),
        officerLastPublishedAt: String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_AT] || '').trim(),
        officerLastPublishedBy: String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_BY] || '').trim(),
        optionalUpdateOptIn: String(row[TICKET_COLS.OPTIONAL_UPDATE_OPT_IN] || '').trim(),
        optionalUpdateChannel: String(row[TICKET_COLS.OPTIONAL_UPDATE_CHANNEL] || '').trim(),
        optionalUpdateDestination: String(row[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION] || '').trim(),
        optionalUpdateDestinationStatus: String(row[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION_STATUS] || '').trim(),
    };
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        await requireOfficerSession(request);

        const limit = await checkRateLimit(`admin_tickets_get_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const spreadsheetId = getTicketSpreadsheetId();
        const rows = await getSheetData(spreadsheetId, TICKET_RANGE);
        const tickets = rows
            .map((row) => mapRowToAdminTicket(row))
            .filter((row) => Boolean(row.ticketId))
            .reverse();

        return withNoStore(NextResponse.json({ success: true, tickets }));
    } catch (error) {
        console.error('[Admin Tickets API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const session = await requireOfficerSession(request);

        const limit = await checkRateLimit(`admin_tickets_patch_${session.user.email?.toLowerCase().trim() || ip}_${ip}`, 40, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        // Accept multipart/form-data (with attachment) or plain JSON (without)
        let rawPayload: unknown;
        let resolutionAttachmentFile: File | undefined;
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            rawPayload = {
                ticketId: form.get('ticketId'),
                status: form.get('status') || undefined,
                resolutionNotes: form.get('resolutionNotes') || undefined,
                publish: form.get('publish') === 'true',
                publishNote: form.get('publishNote') || '',
            };
            const fileEntry = form.get('resolutionAttachment');
            if (fileEntry instanceof File && fileEntry.size > 0) {
                resolutionAttachmentFile = fileEntry;
            }
        } else {
            rawPayload = await request.json();
        }

        const parsed = TicketAdminUpdateSchema.safeParse(rawPayload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid admin update payload.')));
        }

        // Validate attachment type and size if one was provided
        if (resolutionAttachmentFile) {
            if (resolutionAttachmentFile.size > MAX_RESOLUTION_ATTACHMENT_BYTES) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment must be 10 MB or smaller.')));
            }
            const ext = path.extname(resolutionAttachmentFile.name || '').toLowerCase();
            if (!ALLOWED_RESOLUTION_ATTACHMENT_EXTENSIONS.has(ext)) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only PNG, JPG, PDF, DOC, and DOCX files are allowed.')));
            }
            if (resolutionAttachmentFile.type && !ALLOWED_RESOLUTION_ATTACHMENT_MIME_TYPES.has(resolutionAttachmentFile.type)) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_MIME_NOT_ALLOWED', 'Unsupported attachment MIME type.')));
            }
        }

        const update = parsed.data;
        const spreadsheetId = getTicketSpreadsheetId();
        const rows = await getSheetData(spreadsheetId, TICKET_RANGE);
        const normalizedTargetId = update.ticketId.trim().toUpperCase();

        const rowIndex = rows.findIndex((row) => String(row[TICKET_COLS.TICKET_ID] || '').trim().toUpperCase() === normalizedTargetId);
        if (rowIndex < 0) {
            return withNoStore(toApiResponse(new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found.')));
        }

        const currentRow = rows[rowIndex] || [];
        const sheetRowNumber = rowIndex + 2;
        const actor = String(session.user.email || '').trim().toLowerCase();
        const nowIso = new Date().toISOString();
        const nowPht = toPHTString(nowIso);
        const updates: Array<{ range: string; values: string[][] }> = [];
        const currentStatus = String(currentRow[TICKET_COLS.STATUS] || '').trim() as TicketStatus;
        const currentResolutionNotes = String(currentRow[TICKET_COLS.RESOLUTION_NOTES] || '').trim();
        const statusChanged = typeof update.status === 'string' && update.status !== currentStatus;
        const resolutionNotesChanged = typeof update.resolutionNotes === 'string' && update.resolutionNotes !== currentResolutionNotes;

        if (typeof update.status === 'string') {
            updates.push({ range: `Tickets!C${sheetRowNumber}:C${sheetRowNumber}`, values: [[update.status]] });
            updates.push({ range: `Tickets!Q${sheetRowNumber}:Q${sheetRowNumber}`, values: [[update.status]] });
        }

        if (typeof update.resolutionNotes === 'string') {
            updates.push({ range: `Tickets!M${sheetRowNumber}:M${sheetRowNumber}`, values: [[update.resolutionNotes]] });
            updates.push({ range: `Tickets!R${sheetRowNumber}:R${sheetRowNumber}`, values: [[update.resolutionNotes]] });
        }

        updates.push({ range: `Tickets!T${sheetRowNumber}:T${sheetRowNumber}`, values: [[actor]] });
        updates.push({ range: `Tickets!U${sheetRowNumber}:U${sheetRowNumber}`, values: [[nowPht]] });
        updates.push({ range: `Tickets!V${sheetRowNumber}:V${sheetRowNumber}`, values: [[update.publishNote]] });

        if (update.publish) {
            updates.push({ range: `Tickets!S${sheetRowNumber}:S${sheetRowNumber}`, values: [['Published']] });
            updates.push({ range: `Tickets!W${sheetRowNumber}:W${sheetRowNumber}`, values: [[nowPht]] });
            updates.push({ range: `Tickets!X${sheetRowNumber}:X${sheetRowNumber}`, values: [[actor]] });
        } else {
            updates.push({ range: `Tickets!S${sheetRowNumber}:S${sheetRowNumber}`, values: [['Draft']] });
        }

        await batchUpdateSheetData(spreadsheetId, updates);

        const recipientEmail = resolveGrievanceSubmitterEmail({
            recipientEmail: String(currentRow[TICKET_COLS.EMAIL] || '').trim().toLowerCase(),
            optionalUpdateDestination: String(currentRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION] || '').trim().toLowerCase(),
            optionalUpdateChannel: String(currentRow[TICKET_COLS.OPTIONAL_UPDATE_CHANNEL] || '').trim(),
            optionalUpdateDestinationStatus: String(currentRow[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION_STATUS] || '').trim(),
        });

        const appendedComments: Array<{
            commentId: string;
            ticketId: string;
            timestamp: string;
            author: string;
            authorRole: string;
            message: string;
            attachmentUrl: string;
            isAppeal: boolean;
        }> = [];

        if (statusChanged || resolutionNotesChanged || update.publish) {
            if (statusChanged) {
                const statusHistoryComment = {
                    commentId: generateGrievanceCommentId(),
                    ticketId: normalizedTargetId,
                    timestamp: nowPht,
                    author: String(session.user.name || '').trim() || 'OSR Officer',
                    authorRole: 'OFFICER',
                    message: buildTicketStatusHistoryMessage(currentStatus, update.status),
                    attachmentUrl: '',
                    isAppeal: false,
                };

                await appendGrievanceComment({
                    commentId: statusHistoryComment.commentId,
                    ticketId: statusHistoryComment.ticketId,
                    timestamp: statusHistoryComment.timestamp,
                    authorEmail: actor,
                    authorRole: statusHistoryComment.authorRole,
                    message: statusHistoryComment.message,
                    attachmentUrl: statusHistoryComment.attachmentUrl,
                    isAppeal: false,
                }).then(() => {
                    appendedComments.push(statusHistoryComment);
                }).catch(err => {
                    console.error('[Admin Tickets API] Failed to append status-history comment:', err);
                });
            }

            // Append resolution notes as a threaded comment if published and changed
            if (update.publish && resolutionNotesChanged && update.resolutionNotes) {
                // Upload officer attachment to Drive if one was provided
                let resolutionAttachmentUrl = '';
                if (resolutionAttachmentFile) {
                    try {
                        const buffer = Buffer.from(await resolutionAttachmentFile.arrayBuffer());
                        resolutionAttachmentUrl = await uploadTicketAttachmentToDrive({
                            ticketId: normalizedTargetId,
                            fileName: resolutionAttachmentFile.name,
                            mimeType: resolutionAttachmentFile.type || 'application/octet-stream',
                            buffer,
                        });
                    } catch (uploadErr) {
                        console.error('[Admin Tickets API] Failed to upload resolution attachment:', uploadErr);
                    }
                }

                const resolutionComment = {
                    commentId: generateGrievanceCommentId(),
                    ticketId: normalizedTargetId,
                    timestamp: nowPht,
                    author: String(session.user.name || '').trim() || 'OSR Officer',
                    authorRole: 'OFFICER',
                    message: `[Official Resolution Note]: ${update.resolutionNotes}`,
                    attachmentUrl: resolutionAttachmentUrl,
                    isAppeal: false,
                };

                await appendGrievanceComment({
                    commentId: resolutionComment.commentId,
                    ticketId: resolutionComment.ticketId,
                    timestamp: resolutionComment.timestamp,
                    authorEmail: actor,
                    authorRole: resolutionComment.authorRole,
                    message: resolutionComment.message,
                    attachmentUrl: resolutionComment.attachmentUrl,
                    isAppeal: false,
                }).then(() => {
                    appendedComments.push(resolutionComment);
                }).catch(err => {
                    console.error('[Admin Tickets API] Failed to append threaded comment:', err);
                });
            }

            await emitGrievanceAdminUpdateNotifications({
                queue: {
                    spreadsheetId,
                    queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
                    queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
                    queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
                },
                ticketId: normalizedTargetId,
                recipientEmail,
                actorId: actor,
                category: String(currentRow[TICKET_COLS.CATEGORY] || '').trim(),
                subject: String(currentRow[TICKET_COLS.SUBJECT] || '').trim(),
                recipientName: String(currentRow[TICKET_COLS.NAME] || '').trim() || 'Student',
                status: statusChanged ? update.status : undefined,
                resolutionNotes: resolutionNotesChanged ? update.resolutionNotes : undefined,
                published: update.publish,
                publishedAt: update.publish ? nowIso : undefined,
                publishedBy: update.publish ? actor : undefined,
                publishNote: update.publishNote,
                updatedAt: nowIso,
            });
        }

        // Kick off queue processing immediately in the background (fire-and-forget).
        triggerTicketQueueInBackground();

        return withNoStore(NextResponse.json({
            success: true,
            ticketId: normalizedTargetId,
            published: update.publish,
            updatedAt: nowPht,
            updatedBy: actor,
            comments: appendedComments,
        }));
    } catch (error) {
        console.error('[Admin Tickets API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
