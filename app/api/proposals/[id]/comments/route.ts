import path from 'path';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadProposalAttachmentToDrive } from '@/lib/google-drive';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { deriveEffectivePortalRole, hasOfficerPrivilege } from '@/lib/portal-mode';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import {
    appendProposalComment,
    generateProposalCommentId,
    listProposalComments,
    lookupProposalByIdForOwner,
    parseProposalId,
    resolveProposalsSpreadsheetId,
} from '@/lib/proposals';
import { emitProposalCommentNotifications } from '@/lib/proposal-notifications';

// enqueueProposalNotificationEvent is superseded by emitProposalCommentNotifications.
const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ProposalCommentSchema = z.object({
    message: z.string().trim().min(2).max(5000),
    trackingToken: z.string().trim().max(256).optional().default(''),
});

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
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

async function resolveProposalAccess(request: NextRequest, proposalId: string, trackingToken = '') {
    const session = await auth();
    const portalModeCookie = request.cookies.get('osr_portal_mode')?.value;
    const effectiveRole = session?.user
        ? deriveEffectivePortalRole((session.user as { role?: unknown }).role, portalModeCookie)
        : null;
    const isOfficer = hasOfficerPrivilege((session?.user as { role?: unknown } | undefined)?.role);
    const proposal = await lookupProposalByIdForOwner(proposalId, {
        ownerEmail: session?.user?.email,
        trackingToken,
        allowPrivileged: isOfficer,
        effectiveRole,
    });

    if (!proposal) {
        throw new ApiError(
            session?.user?.email ? 404 : 401,
            session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
            session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
        );
    }

    return {
        session,
        effectiveRole,
        isOfficer,
        proposal,
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const ip = getClientIp(request);

    try {
        const { id } = await params;
        const proposalId = String(id || '').trim().toUpperCase();
        if (!parseProposalId(proposalId)) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PROPOSAL_ID', 'Invalid proposal ID format.')));
        }

        const trackingToken = String(new URL(request.url).searchParams.get('access') || '').trim();
        const access = await resolveProposalAccess(request, proposalId, trackingToken);
        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`proposal_comments_get_${proposalId}_${principal}_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const comments = await listProposalComments(proposalId);
        return withNoStore(NextResponse.json({
            success: true,
            comments: comments.map((comment) => ({
                commentId: comment.commentId,
                proposalId: comment.proposalId,
                timestamp: comment.timestamp,
                authorEmail: comment.authorEmail,
                authorRole: comment.authorRole,
                authorName: comment.authorRole === 'OFFICER'
                    ? 'OSR Officer'
                    : access.proposal.submitterName || 'Proposal Submitter',
                message: comment.message,
                attachmentUrl: comment.attachmentUrl,
            })),
        }));
    } catch (error) {
        console.error('[Proposal Comments API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const ip = getClientIp(request);

    try {
        const { id } = await params;
        const proposalId = String(id || '').trim().toUpperCase();
        if (!parseProposalId(proposalId)) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PROPOSAL_ID', 'Invalid proposal ID format.')));
        }

        const contentType = request.headers.get('content-type') || '';
        let attachmentFile: File | undefined;
        let payload: { message: string; trackingToken: string };

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            const candidateFile = form.get('attachment');
            attachmentFile = candidateFile instanceof File && candidateFile.size > 0 ? candidateFile : undefined;
            payload = {
                message: sanitizeText(String(form.get('message') || '')),
                trackingToken: String(form.get('trackingToken') || '').trim(),
            };
        } else {
            const body = await request.json();
            payload = {
                message: sanitizeText(String((body as { message?: unknown }).message || '')),
                trackingToken: String((body as { trackingToken?: unknown }).trackingToken || '').trim(),
            };
        }

        const parsed = ProposalCommentSchema.safeParse(payload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid comment payload.')));
        }

        const access = await resolveProposalAccess(request, proposalId, parsed.data.trackingToken);
        const principal = access.session?.user?.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`proposal_comments_post_${proposalId}_${principal}_${ip}`, 30, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        let attachmentUrl = '';
        if (attachmentFile) {
            validateAttachment(attachmentFile);
            const buffer = Buffer.from(await attachmentFile.arrayBuffer());
            attachmentUrl = await uploadProposalAttachmentToDrive({
                title: access.proposal.title || access.proposal.proposalId,
                submitterEmail: access.session?.user?.email || access.proposal.submitterEmail,
                fileName: attachmentFile.name,
                mimeType: attachmentFile.type || 'application/octet-stream',
                buffer,
            });
        }

        const authorEmail = access.session?.user?.email?.toLowerCase().trim() || access.proposal.submitterEmail;
        const authorRole = access.isOfficer ? 'OFFICER' : 'LEADER';
        const authorName = access.isOfficer
            ? (access.session?.user?.name || 'OSR Officer')
            : (access.session?.user?.name || access.proposal.submitterName || 'Leader');
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });

        const comment = {
            commentId: generateProposalCommentId(),
            proposalId,
            timestamp,
            authorEmail,
            authorRole,
            message: parsed.data.message,
            attachmentUrl,
        };

        await appendProposalComment(comment);

        const { spreadsheetId } = resolveProposalsSpreadsheetId();

        await emitProposalCommentNotifications({
            queue: {
                spreadsheetId,
                queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
                queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
                queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
            },
            proposalId,
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

        return withNoStore(NextResponse.json({
            success: true,
            comment: {
                commentId: comment.commentId,
                proposalId: comment.proposalId,
                timestamp: comment.timestamp,
                authorEmail: comment.authorEmail,
                authorRole: comment.authorRole,
                authorName,
                message: comment.message,
                attachmentUrl: comment.attachmentUrl,
            },
        }));
    } catch (error) {
        console.error('[Proposal Comments API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
