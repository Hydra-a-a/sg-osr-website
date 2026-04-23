import path from 'path';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { PORTAL_MODE_COOKIE, deriveEffectivePortalRole } from '@/lib/portal-mode';
import {
    appendProposalComment,
    generateProposalCommentId,
    lookupProposalByRowNumber,
    mapProposalRow,
    resolveProposalsSpreadsheetId,
} from '@/lib/proposals';
import { emitProposalAdminUpdateNotifications } from '@/lib/proposal-notifications';
import { triggerProposalQueueInBackground } from '@/lib/queue-trigger';
import { uploadProposalAttachmentToDrive } from '@/lib/google-drive';

// enqueueProposalNotificationEvent is superseded by emitProposalAdminUpdateNotifications.
const PROPOSAL_RANGE = 'Project_Proposals!A2:L';
const STATUS_OPTIONS = ['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Needs Revision'] as const;
const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

const MAX_REVIEW_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_REVIEW_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_REVIEW_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ProposalAdminUpdateSchema = z.object({
    rowNumber: z.number().int().positive(),
    status: z.enum(STATUS_OPTIONS),
    reviewNotes: z.string().trim().max(5000).optional().default(''),
});

interface ProposalRow {
    rowNumber: number;
    submittedAt: string;
    submitterEmail: string;
    submitterName: string;
    category: string;
    title: string;
    status: string;
    attachmentUrl: string;
    description: string;
    projectType: string;
    reviewNotes: string;
    updatedBy: string;
    updatedAt: string;
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

async function requireLeaderOrOfficerSession(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const portalMode = request.cookies.get(PORTAL_MODE_COOKIE)?.value;
    const effectiveRole = deriveEffectivePortalRole(session.user.role, portalMode);
    if (effectiveRole !== 'leader' && effectiveRole !== 'officer') {
        throw new ApiError(403, 'FORBIDDEN', 'Leader or officer mode is required.');
    }

    return session;
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        await requireLeaderOrOfficerSession(request);

        const limit = await checkRateLimit(`admin_proposals_get_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const { spreadsheetId } = resolveProposalsSpreadsheetId();
        const rows = await getSheetData(spreadsheetId, PROPOSAL_RANGE);
        const proposals = rows
            .map((row, index) => mapProposalRow(row, index + 2))
            .filter((row) => Boolean(row.title || row.submitterEmail))
            .reverse();

        return withNoStore(NextResponse.json({ success: true, proposals }));
    } catch (error) {
        console.error('[Admin Proposals API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const session = await requireLeaderOrOfficerSession(request);

        const limit = await checkRateLimit(`admin_proposals_patch_${session.user.email?.toLowerCase().trim() || ip}_${ip}`, 40, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        // Accept either JSON or multipart (when an attachment is included)
        let rawPayload: unknown;
        let reviewAttachmentFile: File | undefined;
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            rawPayload = {
                rowNumber: Number(form.get('rowNumber')),
                status: form.get('status'),
                reviewNotes: form.get('reviewNotes') ?? '',
            };
            const fileEntry = form.get('reviewAttachment');
            if (fileEntry instanceof File && fileEntry.size > 0) {
                reviewAttachmentFile = fileEntry;
            }
        } else {
            rawPayload = await request.json();
        }

        const parsed = ProposalAdminUpdateSchema.safeParse(rawPayload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid proposal update payload.')));
        }

        // Validate the optional attachment if present
        if (reviewAttachmentFile) {
            if (reviewAttachmentFile.size > MAX_REVIEW_ATTACHMENT_BYTES) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment must be 10 MB or smaller.')));
            }
            const ext = path.extname(reviewAttachmentFile.name || '').toLowerCase();
            if (!ALLOWED_REVIEW_ATTACHMENT_EXTENSIONS.has(ext)) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only PNG, JPG, PDF, DOC, and DOCX files are allowed.')));
            }
            if (reviewAttachmentFile.type && !ALLOWED_REVIEW_ATTACHMENT_MIME_TYPES.has(reviewAttachmentFile.type)) {
                return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_MIME_NOT_ALLOWED', 'Unsupported attachment MIME type.')));
            }
        }

        const { spreadsheetId } = resolveProposalsSpreadsheetId();
        const actor = String(session.user.email || '').trim().toLowerCase();
        const nowPht = toPHTString(new Date().toISOString());
        const currentProposal = await lookupProposalByRowNumber(parsed.data.rowNumber);

        if (!currentProposal) {
            return withNoStore(toApiResponse(new ApiError(404, 'PROPOSAL_NOT_FOUND', 'Proposal row not found.')));
        }

        const statusChanged = currentProposal.status !== parsed.data.status;
        const reviewNotesChanged = currentProposal.reviewNotes !== parsed.data.reviewNotes;

        await batchUpdateSheetData(spreadsheetId, [
            { range: `Project_Proposals!F${parsed.data.rowNumber}:F${parsed.data.rowNumber}`, values: [[parsed.data.status]] },
            { range: `Project_Proposals!J${parsed.data.rowNumber}:J${parsed.data.rowNumber}`, values: [[parsed.data.reviewNotes]] },
            { range: `Project_Proposals!K${parsed.data.rowNumber}:K${parsed.data.rowNumber}`, values: [[actor]] },
            { range: `Project_Proposals!L${parsed.data.rowNumber}:L${parsed.data.rowNumber}`, values: [[nowPht]] },
        ]);

        let threadComment: {
            commentId: string;
            proposalId: string;
            timestamp: string;
            authorEmail: string;
            authorRole: string;
            authorName: string;
            message: string;
            attachmentUrl: string;
        } | null = null;

        if ((statusChanged || reviewNotesChanged) && currentProposal.submitterEmail) {
            // Append review notes as a threaded comment if changed
            if (reviewNotesChanged && parsed.data.reviewNotes) {
                // Upload officer attachment to Drive if provided
                let reviewAttachmentUrl = '';
                if (reviewAttachmentFile) {
                    try {
                        const buffer = Buffer.from(await reviewAttachmentFile.arrayBuffer());
                        reviewAttachmentUrl = await uploadProposalAttachmentToDrive({
                            title: currentProposal.title,
                            submitterEmail: actor,
                            fileName: reviewAttachmentFile.name,
                            mimeType: reviewAttachmentFile.type || 'application/octet-stream',
                            buffer,
                        });
                    } catch (uploadErr) {
                        console.error('[Admin Proposals API] Failed to upload review attachment:', uploadErr);
                    }
                }

                threadComment = {
                    commentId: generateProposalCommentId(),
                    proposalId: currentProposal.proposalId,
                    timestamp: nowPht,
                    authorEmail: actor,
                    authorRole: 'OFFICER',
                    authorName: 'OSR Officer',
                    message: `[Official Review Note]: ${parsed.data.reviewNotes}`,
                    attachmentUrl: reviewAttachmentUrl,
                };

                await appendProposalComment({
                    commentId: threadComment.commentId,
                    proposalId: threadComment.proposalId,
                    timestamp: threadComment.timestamp,
                    authorEmail: threadComment.authorEmail,
                    authorRole: threadComment.authorRole,
                    message: threadComment.message,
                    attachmentUrl: threadComment.attachmentUrl,
                }).catch(err => {
                    console.error('[Admin Proposals API] Failed to append threaded comment:', err);
                    threadComment = null;
                });
            }

            await emitProposalAdminUpdateNotifications({
                queue: {
                    spreadsheetId,
                    queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
                    queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
                    queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
                },
                proposalId: currentProposal.proposalId,
                submitterName: currentProposal.submitterName,
                submitterEmail: currentProposal.submitterEmail,
                title: currentProposal.title,
                status: statusChanged ? parsed.data.status : undefined,
                reviewNotes: reviewNotesChanged ? parsed.data.reviewNotes : undefined,
                updatedAt: new Date().toISOString(),
                updatedBy: actor,
            });

            // Trigger background processing for near-live emails
            triggerProposalQueueInBackground();
        }

        return withNoStore(NextResponse.json({
            success: true,
            rowNumber: parsed.data.rowNumber,
            status: parsed.data.status,
            reviewNotes: parsed.data.reviewNotes,
            updatedBy: actor,
            updatedAt: nowPht,
            comment: threadComment,
        }));
    } catch (error) {
        console.error('[Admin Proposals API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
