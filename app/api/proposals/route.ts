import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadProposalAttachmentToDrive } from '@/lib/google-drive';
import { getSpreadsheetSheetTitles, appendSheetData } from '@/lib/sheets';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { deriveEffectivePortalRole } from '@/lib/portal-mode';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import {
    PROPOSALS_APPEND_RANGE,
    PROPOSALS_TAB_NAME,
    extractRowNumberFromUpdatedRange,
    formatProposalId,
    generateProposalTrackingToken,
    hashProposalTrackingToken,
    listProposalsBySubmitterEmail,
    resolveProposalsSpreadsheetId,
} from '@/lib/proposals';
import { emitProposalSubmissionNotifications } from '@/lib/proposal-notifications';
import { triggerProposalQueueInBackground } from '@/lib/queue-trigger';

const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function maskId(value: string): string {
    const raw = String(value || '').trim();
    if (raw.length < 10) return raw;
    return `${raw.slice(0, 5)}...${raw.slice(-5)}`;
}

async function requireLeaderOrOfficerSession(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const portalModeCookie = request.cookies.get('osr_portal_mode')?.value;
    const effectiveRole = deriveEffectivePortalRole((session.user as { role?: unknown }).role, portalModeCookie);
    if (effectiveRole !== 'leader' && effectiveRole !== 'officer') {
        throw new ApiError(403, 'FORBIDDEN', 'Leader or officer mode is required.');
    }

    return session;
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const session = await requireLeaderOrOfficerSession(request);
        const principal = session.user.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`proposals_get_${principal}_${ip}`, 60, 60_000);

        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const proposals = await listProposalsBySubmitterEmail(session.user.email || '');
        return withNoStore(NextResponse.json({ success: true, proposals }));
    } catch (error) {
        console.error('[Proposals API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const session = await requireLeaderOrOfficerSession(request);
        const principal = session.user.email?.toLowerCase().trim() || ip;
        const limit = await checkRateLimit(`proposals_post_${principal}_${ip}`, 25, 60_000);

        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_CONTENT_TYPE', 'Invalid content type.')));
        }

        const formData = await request.formData();
        const title = sanitizeText(String(formData.get('title') || ''));
        const category = sanitizeText(String(formData.get('category') || ''));
        const projectType = sanitizeText(String(formData.get('projectType') || ''));
        const description = sanitizeText(String(formData.get('description') || ''));
        const attachment = formData.get('attachment') as File | null;

        if (!title || !category || !projectType || !description || !attachment) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Missing required fields or attachment.')));
        }

        if (attachment.size > 10 * 1024 * 1024) {
            return withNoStore(toApiResponse(new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment exceeds the 10MB limit.')));
        }

        const buffer = Buffer.from(await attachment.arrayBuffer());
        const submitterEmail = session.user.email || '';
        const submitterName = sanitizeText(session.user.name || 'Unknown User');

        const driveLink = await uploadProposalAttachmentToDrive({
            title,
            submitterEmail,
            fileName: attachment.name,
            mimeType: attachment.type,
            buffer,
        });

        const { spreadsheetId, usedFallback } = resolveProposalsSpreadsheetId();
        if (usedFallback) {
            console.warn('[Proposals API] PROPOSALS_SPREADSHEET_ID is missing or invalid; using TICKET_SPREADSHEET_ID fallback.');
        }

        const sheetTitles = await getSpreadsheetSheetTitles(spreadsheetId);
        if (!sheetTitles.includes(PROPOSALS_TAB_NAME)) {
            console.error('[Proposals API] Missing proposals tab in configured spreadsheet:', {
                spreadsheetId: maskId(spreadsheetId),
                expectedTab: PROPOSALS_TAB_NAME,
                availableTabs: sheetTitles,
            });
            return withNoStore(toApiResponse(new ApiError(
                500,
                'MISSING_PROPOSALS_TAB',
                `Missing required sheet tab: ${PROPOSALS_TAB_NAME}.`,
                { detail: 'Create the Project_Proposals tab with headers A:M before submitting proposals.' },
                false,
            )));
        }

        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const trackingToken = generateProposalTrackingToken();
        const rowData = [
            timestamp,
            submitterEmail,
            submitterName,
            category,
            title,
            'Pending Review',
            driveLink,
            description,
            projectType,
            '',
            '',
            '',
            hashProposalTrackingToken(trackingToken),
        ];

        const appendResult = await appendSheetData(spreadsheetId, PROPOSALS_APPEND_RANGE, [rowData]);
        const updatedRange = (appendResult as { updates?: { updatedRange?: string } })?.updates?.updatedRange;
        const rowNumber = extractRowNumberFromUpdatedRange(updatedRange);
        const proposalId = rowNumber ? formatProposalId(rowNumber) : '';

        if (proposalId) {
            await emitProposalSubmissionNotifications({
                queue: {
                    spreadsheetId,
                    queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
                    queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
                    queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
                },
                proposalId,
                submitterName,
                submitterEmail,
                title,
                category,
                projectType,
                description,
                attachmentUrl: driveLink,
                submittedAt: new Date().toISOString(),
            });

            // Trigger background processing for near-live emails
            triggerProposalQueueInBackground();
        }

        return withNoStore(NextResponse.json({
            success: true,
            link: driveLink,
            persistedToSheet: true,
            proposalId,
            rowNumber,
            trackingAccessToken: trackingToken,
        }));
    } catch (error) {
        console.error('[Proposals API] Failed to process proposal submission:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
