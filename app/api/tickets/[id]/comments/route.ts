import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { requireSameOriginRequest } from '@/lib/request-guards';
import {
    appendGrievanceCommentOrchestration,
    buildCommentResponseItems,
    listTicketComments,
    lookupTicketNotificationRow,
    normalizeCommentAuthor,
    parseBoolean,
    resolveCommentAccess,
    resolveOfficerDisplayName,
    TicketCommentSchema,
} from '@/features/tickets/server/comments';

function getTicketSpreadsheetId(): string {
    const id = String(process.env.TICKET_SPREADSHEET_ID || '').trim();
    if (!id) {
        throw new Error('TICKET_SPREADSHEET_ID missing');
    }
    return id;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ip = getClientIp(request);
    const session = await auth();
    const { id } = await params;
    const ticketId = String(id || '').trim().toUpperCase();

    if (!ticketId) {
        return withNoStore(toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Missing ticket ID')));
    }

    const url = new URL(request.url);
    const trackingToken = String(url.searchParams.get('access') || '').trim();

    try {
        const access = await resolveCommentAccess(
            session,
            request.cookies.get('osr_portal_mode')?.value,
            ticketId,
            trackingToken,
        );
        if (!access.ownerAllowed) {
            return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Unauthorized to view ticket discussion.')));
        }

        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`ticket_comments_get_${ticketId}_${principal}_${ip}`, 60, 60_000);
        if (!limit.success) {
            return rateLimitResponse(limit, 'Too many requests. Try again later.');
        }

        const spreadsheetId = getTicketSpreadsheetId();
        const comments = await listTicketComments(spreadsheetId, ticketId);
        const ticketRow = await lookupTicketNotificationRow(spreadsheetId, ticketId);
        const studentDisplayName = String(ticketRow?.[4] || '').trim() || 'Student';

        const commentItems = await buildCommentResponseItems({
            comments,
            ticketId,
            trackingToken,
            ownerEmail: access.session?.user?.email,
            studentDisplayName,
        });

        return withNoStore(NextResponse.json({ comments: commentItems }));
    } catch (error) {
        console.error('[Ticket Comments API] GET error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ip = getClientIp(request);
    const session = await auth();
    const { id } = await params;
    const ticketId = String(id || '').trim().toUpperCase();

    if (!ticketId) {
        return withNoStore(toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Missing ticket ID')));
    }

    try {
        requireSameOriginRequest(request);
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

        const access = await resolveCommentAccess(
            session,
            request.cookies.get('osr_portal_mode')?.value,
            ticketId,
            parsed.data.trackingToken,
        );
        if (!access.ownerAllowed) {
            return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Unauthorized to post ticket discussion.')));
        }

        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`ticket_comments_post_${ticketId}_${principal}_${ip}`, 30, 60_000);
        if (!limit.success) {
            return rateLimitResponse(limit, 'Too many requests. Try again later.');
        }

        const normalizedAuthor = normalizeCommentAuthor(access);
        if (access.privileged && !String(access.session?.user?.name || '').trim()) {
            normalizedAuthor.author = await resolveOfficerDisplayName(normalizedAuthor.authorEmail, 'Officer');
        }

        const result = await appendGrievanceCommentOrchestration({
            spreadsheetId: getTicketSpreadsheetId(),
            ticketId,
            message: parsed.data.message,
            isAppeal: parsed.data.isAppeal,
            author: normalizedAuthor.author,
            authorEmail: normalizedAuthor.authorEmail,
            authorRole: normalizedAuthor.authorRole,
            attachmentFile,
        });

        return withNoStore(NextResponse.json({
            success: true,
            comment: result.comment,
            statusTransitioned: result.statusTransitioned,
        }));
    } catch (error) {
        console.error('[Ticket Comments API] POST error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
