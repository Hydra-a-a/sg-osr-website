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

// enqueueProposalNotificationEvent is superseded by emitProposalAdminUpdateNotifications.
const PROPOSAL_RANGE = 'Project_Proposals!A2:L';
const STATUS_OPTIONS = ['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Needs Revision'] as const;
const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

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

        const payload = await request.json();
        const parsed = ProposalAdminUpdateSchema.safeParse(payload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid proposal update payload.')));
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

        if ((statusChanged || reviewNotesChanged) && currentProposal.submitterEmail) {
            // Append review notes as a threaded comment if changed
            if (reviewNotesChanged && parsed.data.reviewNotes) {
                await appendProposalComment({
                    commentId: generateProposalCommentId(),
                    proposalId: currentProposal.proposalId,
                    timestamp: nowPht,
                    authorEmail: actor,
                    authorRole: 'OFFICER',
                    message: `[Official Review Note]: ${parsed.data.reviewNotes}`,
                }).catch(err => {
                    console.error('[Admin Proposals API] Failed to append threaded comment:', err);
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
            triggerProposalQueueInBackground().catch(err => {
                console.error('[Admin Proposals API] Failed to trigger background queue:', err);
            });
        }

        return withNoStore(NextResponse.json({
            success: true,
            rowNumber: parsed.data.rowNumber,
            status: parsed.data.status,
            reviewNotes: parsed.data.reviewNotes,
            updatedBy: actor,
            updatedAt: nowPht,
        }));
    } catch (error) {
        console.error('[Admin Proposals API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
