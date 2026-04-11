import { NextResponse } from 'next/server';
import path from 'path';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { logAuditAction } from '@/lib/audit';
import { uploadTicketAttachmentToDrive } from '@/lib/google-drive';
import { CAMPUSES, COLLEGE_INSTITUTES, GRIEVANCE_CATEGORIES } from '@/lib/ticket-constants';
import {
    generateTicketCredentials,
    hashTicketTrackingToken,
    writeTicketToSheet,
} from '@/lib/tickets';
import { emitGrievanceSubmissionNotifications } from '@/lib/grievance-notifications';

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

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(String(raw || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTicketSubmissionRateLimitConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const defaultLimit = isProduction ? 3 : 30;

    return {
        limit: parsePositiveIntEnv(process.env.TICKET_SUBMISSION_RATE_LIMIT_MAX, defaultLimit),
        windowMs: parsePositiveIntEnv(process.env.TICKET_SUBMISSION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
        disableInDev: String(process.env.TICKET_SUBMISSION_RATE_LIMIT_DISABLE_IN_DEV || '').trim().toLowerCase() === 'true',
    };
}

// ── Request schema ────────────────────────────────────────────────────────────
const safeText = (max: number) =>
    z.string().trim().max(max).regex(/^[a-zA-Z0-9\s.,!?'"\\-ñÑ()&/:@#%+\[\]]*$/, 'Contains invalid characters');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MIN_SUBMISSION_AGE_MS = 1000;
const ALLOWED_ATTACHMENT_URL_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type AttachmentKind = 'image' | 'document';

const ALLOWED_ATTACHMENT_EXTENSIONS_BY_KIND: Record<AttachmentKind, Set<string>> = {
    image: new Set(['.png', '.jpg', '.jpeg']),
    document: new Set(['.pdf', '.doc', '.docx']),
};

const ALLOWED_ATTACHMENT_MIME_TYPES_BY_KIND: Record<AttachmentKind, Set<string>> = {
    image: new Set(['image/png', 'image/jpeg']),
    document: new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
};

const TicketSubmissionSchema = z.object({
    studentId:    z.string().trim().max(40).regex(/^[a-zA-Z0-9-]*$/, 'Student ID format is invalid.').optional().default(''),
    campus:       z.enum(CAMPUSES),
    college:      z.enum(COLLEGE_INSTITUTES),
    category:     z.enum(GRIEVANCE_CATEGORIES),
    subject:      safeText(200).optional().default(''),
    complaintNarrative: z.string().trim().min(10, 'Complaint narrative must be at least 10 characters').max(5000).optional(),
    message:      z.string().trim().min(10, 'Message must be at least 10 characters').max(5000).optional(), // legacy client key
    attachmentKind: z.enum(['image', 'document']).optional().default('document'),
    attachmentUrl: z.string().url().max(2048).optional(),
    isAnonymous:  z.boolean().optional().default(false),
    contactEmail: z.string().email().optional(), // for anonymous users requesting a copy
    updatesOptIn: z.boolean().optional().default(false),
    updatesChannel: z.enum(['none', 'email']).optional().default('none'),
    updatesDestination: z.string().email().max(254).optional(),
    updatesNotes: safeText(500).optional().default(''),
    honeypot:     z.string().optional(),
    timestamp:    z.number().optional(),
}).superRefine((data, ctx) => {
    const narrative = data.complaintNarrative || data.message || '';
    if (!narrative.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['complaintNarrative'],
            message: 'Complaint narrative is required.',
        });
    }

    if (!data.isAnonymous && data.studentId.trim().length < 3) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['studentId'],
            message: 'Student ID is required when anonymous mode is off.',
        });
    }

    if (data.updatesOptIn) {
        if (data.updatesChannel !== 'email') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['updatesChannel'],
                message: 'Optional update channel must be email when opt-in is enabled.',
            });
        }

        if (!data.updatesDestination) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['updatesDestination'],
                message: 'Optional update destination is required when opt-in is enabled.',
            });
        }
    }

    if (!data.updatesOptIn && data.updatesDestination) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['updatesDestination'],
            message: 'Provide optional update destination only when opt-in is enabled.',
        });
    }
});

function parseBoolean(value: FormDataEntryValue | boolean | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return false;
}

function parseOptionalNumber(value: FormDataEntryValue | number | undefined): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

async function parseTicketRequestPayload(request: Request): Promise<{ payload: unknown; attachmentFile?: File }> {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const candidateFile = form.get('attachment');
        const attachmentFile = candidateFile instanceof File && candidateFile.size > 0
            ? candidateFile
            : undefined;

        return {
            payload: {
                studentId: String(form.get('studentId') || ''),
                campus: String(form.get('campus') || ''),
                college: String(form.get('college') || ''),
                category: String(form.get('category') || ''),
                subject: String(form.get('subject') || ''),
                complaintNarrative: String(form.get('complaintNarrative') || ''),
                attachmentKind: String(form.get('attachmentKind') || 'document'),
                attachmentUrl: (() => {
                    const value = String(form.get('attachmentUrl') || '').trim();
                    return value || undefined;
                })(),
                isAnonymous: parseBoolean(form.get('isAnonymous') || undefined),
                contactEmail: (() => {
                    const value = String(form.get('contactEmail') || '').trim();
                    return value || undefined;
                })(),
                updatesOptIn: parseBoolean(form.get('updatesOptIn') || undefined),
                updatesChannel: String(form.get('updatesChannel') || 'none').trim().toLowerCase(),
                updatesDestination: (() => {
                    const value = String(form.get('updatesDestination') || '').trim();
                    return value || undefined;
                })(),
                updatesNotes: String(form.get('updatesNotes') || '').trim(),
                honeypot: String(form.get('honeypot') || ''),
                timestamp: parseOptionalNumber(form.get('timestamp') || undefined),
            },
            attachmentFile,
        };
    }

    const payload = await request.json();

    if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        const attachmentUrl = typeof record.attachmentUrl === 'string' ? record.attachmentUrl.trim() : undefined;
        const contactEmail = typeof record.contactEmail === 'string' ? record.contactEmail.trim() : undefined;
        const updatesDestination = typeof record.updatesDestination === 'string' ? record.updatesDestination.trim() : undefined;
        const updatesNotes = typeof record.updatesNotes === 'string' ? record.updatesNotes.trim() : '';

        return {
            payload: {
                ...record,
                attachmentKind: typeof record.attachmentKind === 'string'
                    ? record.attachmentKind.trim().toLowerCase()
                    : record.attachmentKind,
                attachmentUrl: attachmentUrl || undefined,
                contactEmail: contactEmail || undefined,
                updatesDestination: updatesDestination || undefined,
                updatesNotes,
                isAnonymous: typeof record.isAnonymous === 'string'
                    ? parseBoolean(record.isAnonymous)
                    : record.isAnonymous,
                updatesOptIn: typeof record.updatesOptIn === 'string'
                    ? parseBoolean(record.updatesOptIn)
                    : record.updatesOptIn,
                updatesChannel: typeof record.updatesChannel === 'string'
                    ? record.updatesChannel.trim().toLowerCase()
                    : record.updatesChannel,
            },
        };
    }

    return { payload };
}

function validateAttachment(file: File, attachmentKind: AttachmentKind): void {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment must be 10MB or smaller.');
    }

    const extension = path.extname(file.name || '').toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
        throw new ApiError(400, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only PNG, JPG, PDF, DOC, and DOCX files are allowed.');
    }

    if (!ALLOWED_ATTACHMENT_EXTENSIONS_BY_KIND[attachmentKind].has(extension)) {
        throw new ApiError(400, 'ATTACHMENT_KIND_MISMATCH', `Attachment does not match selected type: ${attachmentKind}.`);
    }

    if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
        throw new ApiError(400, 'ATTACHMENT_MIME_NOT_ALLOWED', 'Unsupported attachment MIME type.');
    }

    if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES_BY_KIND[attachmentKind].has(file.type)) {
        throw new ApiError(400, 'ATTACHMENT_KIND_MIME_MISMATCH', `Attachment MIME type does not match selected type: ${attachmentKind}.`);
    }
}

function sanitizeAttachmentUrl(rawUrl?: string): string {
    const candidate = (rawUrl || '').trim();
    if (!candidate) return '';

    try {
        const parsed = new URL(candidate);
        const normalizedHost = parsed.hostname.toLowerCase();

        if (parsed.protocol !== 'https:') return '';
        if (!ALLOWED_ATTACHMENT_URL_HOSTS.has(normalizedHost)) return '';

        return parsed.toString();
    } catch {
        return '';
    }
}

// ── POST /api/tickets ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
    const ip      = getClientIp(request);
    const session = await auth();

    // Auth: must be a signed-in @rtu.edu.ph student
    if (!session?.user?.email) {
        logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Not authenticated' });
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    const sessionEmail = session.user.email.toLowerCase().trim();
    if (!sessionEmail.endsWith('@rtu.edu.ph')) {
        logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Non-RTU email' });
        return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
    }

    const rateLimitConfig = resolveTicketSubmissionRateLimitConfig();
    const shouldSkipRateLimit = process.env.NODE_ENV !== 'production' && rateLimitConfig.disableInDev;

    // Rate-limit by user + IP so local/proxy shared IPs do not throttle all testers together.
    if (!shouldSkipRateLimit) {
        const limit = await checkRateLimit(
            `tickets_api_${sessionEmail}_${ip}`,
            rateLimitConfig.limit,
            rateLimitConfig.windowMs,
        );
        if (!limit.success) {
            logAuditAction('TICKET_RATE_LIMITED', { ip, sessionEmail });
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'));
            if (limit.retryAfter) response.headers.set('Retry-After', String(limit.retryAfter));
            return withNoStore(response);
        }
    }

    try {
        const { payload, attachmentFile } = await parseTicketRequestPayload(request);

        const result = TicketSubmissionSchema.safeParse(payload);

        if (!result.success) {
            logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Schema validation failure' });
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid request payload')));
        }

        const data = result.data;
        const complaintNarrative = (data.complaintNarrative || data.message || '').trim();
        const attachmentUrlFromPayload = sanitizeAttachmentUrl(data.attachmentUrl);
        const attachmentKind = data.attachmentKind;
        const optionalUpdatesOptIn = Boolean(data.updatesOptIn);
        const optionalUpdatesChannel = optionalUpdatesOptIn ? 'Email' : 'None';
        const optionalUpdatesDestination = optionalUpdatesOptIn
            ? String(data.updatesDestination || '').trim().toLowerCase()
            : '';
        const optionalUpdateNotes = optionalUpdatesOptIn ? String(data.updatesNotes || '').trim() : '';

        // Honeypot / speed check
        if (data.honeypot) {
            return withNoStore(NextResponse.json({ success: true, ticketId: 'TKT-0000-FAKE' }));
        }
        if (data.timestamp && Date.now() - data.timestamp < MIN_SUBMISSION_AGE_MS) {
            return withNoStore(NextResponse.json({ success: true, ticketId: 'TKT-0000-FAKE' }));
        }

        // Resolve identity
        const isAnonymous   = data.isAnonymous;
        const studentName   = isAnonymous ? 'Anonymous Student' : (session.user.name?.trim() || 'Student');
        const studentEmail  = isAnonymous ? '' : sessionEmail;

        let confirmationEmail: string | undefined;
        if (data.contactEmail) {
            const normalizedContact = data.contactEmail.trim().toLowerCase();
            if (normalizedContact !== sessionEmail) {
                logAuditAction('TICKET_SUBMISSION_FAILED', {
                    ip,
                    reason: 'Contact email mismatch',
                });
                return withNoStore(toApiResponse(
                    new ApiError(400, 'INVALID_CONTACT_EMAIL', 'Confirmation email must match your signed-in RTU account.')
                ));
            }
            confirmationEmail = normalizedContact;
        }

        // Generate ticket credentials and timestamp
        const { ticketId, trackingToken } = generateTicketCredentials();
        const submittedAt   = new Date().toISOString();

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

        // 1. Write to Google Sheets (primary data store)
        await writeTicketToSheet({
            ticketId,
            timestamp: submittedAt,
            studentId: data.studentId,
            campus: data.campus,
            college: data.college,
            category:  data.category,
            subject:   data.subject,
            name:      studentName,
            email:     studentEmail,
            complaintNarrative,
            attachmentUrl,
            trackingTokenHash: hashTicketTrackingToken(trackingToken),
            optionalUpdateOptIn: optionalUpdatesOptIn,
            optionalUpdateChannel: optionalUpdatesChannel,
            optionalUpdateDestination: optionalUpdatesDestination,
            optionalUpdateDestinationStatus: 'Unverified',
            optionalUpdateNotes,
        });

        await emitGrievanceSubmissionNotifications({
            queue: {
                spreadsheetId: getTicketSpreadsheetId(),
                queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
                queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
                queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
            },
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
            optionalUpdateDestinationStatus: 'Unverified',
        });

        // Still log the success
        logAuditAction('TICKET_SUBMITTED', {
            ticketId,
            campus: data.campus,
            college: data.college,
            category: data.category,
            isAnonymous,
            hasAttachment: Boolean(attachmentUrl),
        });


        return withNoStore(NextResponse.json({
            success:  true,
            ticketId,
            trackingAccessToken: trackingToken,
            message: confirmationEmail
                ? 'Your grievance has been submitted. You will receive a confirmation email shortly.'
                : `Your grievance has been submitted. Save your tracking link to view full updates.${optionalUpdatesOptIn ? ' Optional update contact was saved and is pending officer verification.' : ''}`,
        }));

    } catch (error) {
        console.error('[Tickets API] Unhandled error:', redactErrorForLog(error));
        if (error instanceof SyntaxError) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_JSON', 'Invalid request payload')));
        }
        return withNoStore(toApiResponse(error));
    }
}
