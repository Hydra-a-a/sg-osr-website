import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import { buildProposalCommentEmail, buildProposalStatusUpdateEmail } from '@/lib/email-templates';
import { redactErrorForLog } from '@/lib/security';
import { processProposalNotifications } from '@/lib/proposal-notifications';

export const PROPOSALS_TAB_NAME = 'Project_Proposals';
export const PROPOSALS_RANGE = `${PROPOSALS_TAB_NAME}!A2:M`;
export const PROPOSALS_APPEND_RANGE = `${PROPOSALS_TAB_NAME}!A1`;

export const PROPOSAL_DISCUSSIONS_TAB = 'Project_Proposal_Discussions';
export const PROPOSAL_DISCUSSIONS_RANGE = `${PROPOSAL_DISCUSSIONS_TAB}!A2:G`;
export const PROPOSAL_DISCUSSIONS_APPEND_RANGE = `${PROPOSAL_DISCUSSIONS_TAB}!A1`;

export const PROPOSAL_NOTIFICATION_QUEUE_TAB = process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue';
export const PROPOSAL_NOTIFICATION_QUEUE_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A2:N`;
export const PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE = `${PROPOSAL_NOTIFICATION_QUEUE_TAB}!A1`;

const PROPOSAL_ID_PREFIX = 'PROP-';
const PROPOSAL_COMMENT_ID_PREFIX = 'PC-';
const PROPOSAL_QUEUE_ID_PREFIX = 'PNQ-';
const RANDOM_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type ProposalStatus =
    | 'Pending Review'
    | 'Under Review'
    | 'Approved'
    | 'Rejected'
    | 'Needs Revision';

export type ProposalNotificationType = 'status_update' | 'comment';
type QueueStatus = 'pending' | 'retry' | 'sent' | 'skipped';

export interface ProposalRecord {
    proposalId: string;
    rowNumber: number;
    submittedAt: string;
    submitterEmail: string;
    submitterName: string;
    category: string;
    title: string;
    status: ProposalStatus;
    attachmentUrl: string;
    description: string;
    projectType: string;
    reviewNotes: string;
    updatedBy: string;
    updatedAt: string;
}

interface ProposalSheetRow extends ProposalRecord {
    trackingTokenHash: string;
}

export interface ProposalCommentRecord {
    commentId: string;
    proposalId: string;
    timestamp: string;
    authorEmail: string;
    authorRole: string;
    message: string;
    attachmentUrl: string;
}

interface QueueRecord {
    rowNumber: number;
    notificationId: string;
    proposalId: string;
    recipientEmail: string;
    type: ProposalNotificationType;
    status: QueueStatus;
    payload: string;
    createdAt: string;
    processedAt: string;
    error: string;
}

interface StatusUpdatePayload {
    title?: string;
    status?: string;
    reviewNotes?: string;
    updatedAt?: string;
    updatedBy?: string;
}

interface CommentNotificationPayload {
    title?: string;
    commentId?: string;
    authorRole?: string;
    authorName?: string;
    message?: string;
    attachmentUrl?: string;
    createdAt?: string;
}

export function normalizeProposalSheetId(value: string | undefined): string {
    return String(value || '').trim();
}

export function isLikelySpreadsheetId(value: string): boolean {
    return /^[a-zA-Z0-9_-]{40,}$/.test(value);
}

export function resolveProposalsSpreadsheetId(): { spreadsheetId: string; usedFallback: boolean } {
    const configuredId = normalizeProposalSheetId(process.env.PROPOSALS_SPREADSHEET_ID);
    if (isLikelySpreadsheetId(configuredId)) {
        return { spreadsheetId: configuredId, usedFallback: false };
    }

    const fallbackId = normalizeProposalSheetId(process.env.TICKET_SPREADSHEET_ID);
    if (isLikelySpreadsheetId(fallbackId)) {
        return { spreadsheetId: fallbackId, usedFallback: true };
    }

    throw new Error('Missing valid spreadsheet configuration for proposals. Set PROPOSALS_SPREADSHEET_ID or TICKET_SPREADSHEET_ID.');
}

function randomBase36(length: number): string {
    const bytes = randomBytes(length);
    let output = '';
    for (const byte of bytes) {
        output += RANDOM_ALPHABET[byte % RANDOM_ALPHABET.length];
    }
    return output;
}

function getProposalTrackingSecret(): string {
    const secret = process.env.PROPOSAL_TRACKING_TOKEN_SECRET
        || process.env.AUTH_SECRET
        || process.env.NEXTAUTH_SECRET;

    if (!secret) {
        throw new Error('Proposal tracking secret is not configured (set PROPOSAL_TRACKING_TOKEN_SECRET).');
    }

    return secret;
}

export function generateProposalTrackingToken(): string {
    return randomBytes(24).toString('base64url');
}

export function hashProposalTrackingToken(token: string): string {
    return createHmac('sha256', getProposalTrackingSecret()).update(token).digest('hex');
}

function verifyProposalTrackingToken(token: string, expectedHash: string): boolean {
    const normalizedExpected = String(expectedHash || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedExpected)) {
        return false;
    }

    const providedHash = hashProposalTrackingToken(token);
    const expectedBuffer = Buffer.from(normalizedExpected, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
}

export interface ProposalCredentials {
    proposalId: string;
    trackingToken: string;
}

export function formatProposalId(rowNumber: number): string {
    return `${PROPOSAL_ID_PREFIX}${String(rowNumber).padStart(5, '0')}`;
}

export function parseProposalId(value: string): number | null {
    const normalized = String(value || '').trim().toUpperCase();
    const match = normalized.match(/^PROP-(\d{1,7})$/);
    if (!match) {
        return null;
    }

    const rowNumber = Number.parseInt(match[1], 10);
    return Number.isFinite(rowNumber) && rowNumber >= 2 ? rowNumber : null;
}

export function extractRowNumberFromUpdatedRange(value: unknown): number | null {
    const normalized = String(value || '').trim();
    const match = normalized.match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/i);
    if (!match) {
        return null;
    }

    const rowNumber = Number.parseInt(match[1], 10);
    return Number.isFinite(rowNumber) && rowNumber >= 2 ? rowNumber : null;
}

function normalizeProposalStatus(value: string): ProposalStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'under review') return 'Under Review';
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'needs revision') return 'Needs Revision';
    return 'Pending Review';
}

function mapProposalSheetRow(row: string[], rowNumber: number): ProposalSheetRow {
    return {
        proposalId: formatProposalId(rowNumber),
        rowNumber,
        submittedAt: String(row[0] || '').trim(),
        submitterEmail: String(row[1] || '').trim().toLowerCase(),
        submitterName: String(row[2] || '').trim(),
        category: String(row[3] || '').trim(),
        title: String(row[4] || '').trim(),
        status: normalizeProposalStatus(String(row[5] || 'Pending Review')),
        attachmentUrl: String(row[6] || '').trim(),
        description: String(row[7] || '').trim(),
        projectType: String(row[8] || '').trim(),
        reviewNotes: String(row[9] || '').trim(),
        updatedBy: String(row[10] || '').trim(),
        updatedAt: String(row[11] || '').trim(),
        trackingTokenHash: String(row[12] || '').trim(),
    };
}

export function mapProposalRow(row: string[], rowNumber: number): ProposalRecord {
    const proposal = mapProposalSheetRow(row, rowNumber);
    return {
        proposalId: proposal.proposalId,
        rowNumber: proposal.rowNumber,
        submittedAt: proposal.submittedAt,
        submitterEmail: proposal.submitterEmail,
        submitterName: proposal.submitterName,
        category: proposal.category,
        title: proposal.title,
        status: proposal.status,
        attachmentUrl: proposal.attachmentUrl,
        description: proposal.description,
        projectType: proposal.projectType,
        reviewNotes: proposal.reviewNotes,
        updatedBy: proposal.updatedBy,
        updatedAt: proposal.updatedAt,
    };
}

export function generateProposalCredentials(rowNumber: number): ProposalCredentials {
    return {
        proposalId: formatProposalId(rowNumber),
        trackingToken: generateProposalTrackingToken(),
    };
}

export async function listProposalsBySubmitterEmail(submitterEmail: string): Promise<ProposalRecord[]> {
    const normalizedEmail = String(submitterEmail || '').trim().toLowerCase();
    if (!normalizedEmail) {
        return [];
    }

    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, PROPOSALS_RANGE);

    return rows
        .map((row, index) => mapProposalRow(row, index + 2))
        .filter((proposal) => proposal.submitterEmail === normalizedEmail && Boolean(proposal.title || proposal.submitterEmail))
        .reverse();
}

export async function lookupProposalByRowNumber(rowNumber: number): Promise<ProposalRecord | null> {
    if (!Number.isFinite(rowNumber) || rowNumber < 2) {
        return null;
    }

    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, PROPOSALS_RANGE);
    const rowIndex = rowNumber - 2;
    const row = rows[rowIndex];

    if (!row) {
        return null;
    }

    return mapProposalRow(row, rowNumber);
}

export async function lookupProposalById(proposalId: string): Promise<ProposalRecord | null> {
    const rowNumber = parseProposalId(proposalId);
    if (!rowNumber) {
        return null;
    }

    return lookupProposalByRowNumber(rowNumber);
}

export async function lookupProposalByIdForOwner(
    proposalId: string,
    options?: {
        ownerEmail?: string | null;
        trackingToken?: string | null;
        allowPrivileged?: boolean;
        effectiveRole?: string | null;
    },
): Promise<ProposalRecord | null> {
    const rowNumber = parseProposalId(proposalId);
    if (!rowNumber) {
        return null;
    }

    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, PROPOSALS_RANGE);
    const row = rows[rowNumber - 2];
    if (!row) {
        return null;
    }

    const proposal = mapProposalSheetRow(row, rowNumber);
    const normalizedOwnerEmail = String(options?.ownerEmail || '').trim().toLowerCase();
    const normalizedTrackingToken = String(options?.trackingToken || '').trim();
    const canBypassOwnership = Boolean(options?.allowPrivileged) && String(options?.effectiveRole || '').trim().toLowerCase() === 'officer';

    if (canBypassOwnership) {
        return mapProposalRow(row, rowNumber);
    }

    const ownerMatch = proposal.submitterEmail === normalizedOwnerEmail;
    const tokenMatch = normalizedTrackingToken
        && proposal.trackingTokenHash
        && verifyProposalTrackingToken(normalizedTrackingToken, proposal.trackingTokenHash);

    return ownerMatch || tokenMatch ? mapProposalRow(row, rowNumber) : null;
}

function normalizeQueueStatus(value: string): QueueStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'retry') return 'retry';
    if (normalized === 'sent') return 'sent';
    if (normalized === 'skipped') return 'skipped';
    return 'pending';
}

function parseQueueRow(row: string[], rowNumber: number): QueueRecord {
    return {
        rowNumber,
        notificationId: String(row[0] || '').trim(),
        proposalId: String(row[1] || '').trim().toUpperCase(),
        recipientEmail: String(row[2] || '').trim().toLowerCase(),
        type: String(row[3] || '').trim() === 'comment' ? 'comment' : 'status_update',
        status: normalizeQueueStatus(String(row[4] || 'pending')),
        payload: String(row[5] || '').trim(),
        createdAt: String(row[6] || '').trim(),
        processedAt: String(row[7] || '').trim(),
        error: String(row[8] || '').trim(),
    };
}

function generateQueueId(): string {
    return `${PROPOSAL_QUEUE_ID_PREFIX}${randomBase36(10)}`;
}

export function generateProposalCommentId(): string {
    return `${PROPOSAL_COMMENT_ID_PREFIX}${randomBase36(10)}`;
}

export async function appendProposalComment(comment: ProposalCommentRecord): Promise<void> {
    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    await appendSheetData(spreadsheetId, PROPOSAL_DISCUSSIONS_APPEND_RANGE, [[
        comment.commentId,
        comment.proposalId,
        comment.timestamp,
        comment.authorEmail,
        comment.authorRole,
        comment.message,
        comment.attachmentUrl,
    ]]);
}

export async function listProposalComments(proposalId: string): Promise<ProposalCommentRecord[]> {
    const normalizedProposalId = String(proposalId || '').trim().toUpperCase();
    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, PROPOSAL_DISCUSSIONS_RANGE);

    return (rows || [])
        .filter((row) => String(row[1] || '').trim().toUpperCase() === normalizedProposalId)
        .map((row) => ({
            commentId: String(row[0] || '').trim(),
            proposalId: String(row[1] || '').trim(),
            timestamp: String(row[2] || '').trim(),
            authorEmail: String(row[3] || '').trim().toLowerCase(),
            authorRole: String(row[4] || '').trim() || 'LEADER',
            message: String(row[5] || '').trim(),
            attachmentUrl: String(row[6] || '').trim(),
        }));
}

export interface EnqueueProposalNotificationInput {
    proposalId: string;
    recipientEmail: string;
    type: ProposalNotificationType;
    payload: Record<string, unknown>;
}

export async function enqueueProposalNotificationEvent(input: EnqueueProposalNotificationInput): Promise<{ queued: boolean; notificationId: string; }> {
    const notificationId = generateQueueId();
    const createdAt = new Date().toISOString();
    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const row = [
        notificationId,
        String(input.proposalId || '').trim().toUpperCase(),
        String(input.recipientEmail || '').trim().toLowerCase(),
        input.type,
        'pending',
        JSON.stringify(input.payload || {}),
        createdAt,
        '',
        '',
    ];

    await appendSheetData(spreadsheetId, PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE, [row]);

    return {
        queued: true,
        notificationId,
    };
}

function buildProposalTrackingUrl(proposalId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://osr.rtu.edu.ph';
    return `${baseUrl}/services/proposals/track?id=${encodeURIComponent(proposalId)}`;
}

function isDeliverableEmail(value: string): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export interface ProcessProposalNotificationQueueOptions {
    dryRun?: boolean;
    limit?: number;
}

export interface ProcessProposalNotificationQueueResult {
    scanned: number;
    picked: number;
    sent: number;
    skipped: number;
    failed: number;
    updatedQueueRows: number;
    dryRun: boolean;
}

export async function processProposalNotificationQueue(
    options: ProcessProposalNotificationQueueOptions = {},
): Promise<ProcessProposalNotificationQueueResult> {
    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const summary = await processProposalNotifications({
        spreadsheetId,
        queueTab: PROPOSAL_NOTIFICATION_QUEUE_TAB,
        queueRange: PROPOSAL_NOTIFICATION_QUEUE_RANGE,
        queueAppendRange: PROPOSAL_NOTIFICATION_QUEUE_APPEND_RANGE,
    }, options);

    return {
        scanned: summary.scanned,
        picked: summary.picked,
        sent: summary.sent,
        skipped: summary.skipped,
        failed: summary.failed + summary.deadLettered,
        updatedQueueRows: summary.updatedQueueRows,
        dryRun: summary.dryRun,
    };
}
