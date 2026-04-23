/**
 * Ticket orchestration layer.
 * Manages ticket ID generation, Google Sheets persistence, and email dispatch.
 *
 * Google Sheet schema (row 1 must be headers, add them once manually):
 *   A: Ticket_ID | B: Timestamp | C: Status | D: Student_ID | E: Name
 *   F: Email     | G: Campus    | H: College_Institute | I: Category
 *   J: Subject   | K: Complaint_Narrative | L: Attachment_URL
 *   M: Resolution_Notes | N: Tracking_Token_Hash | O: Last_Notified_Signature | P: Last_Notified_At
 *   Q: Officer_Status_Draft ... X: Officer_Last_Published_By
 *   Y: Anonymous_Update_OptIn | Z: Anonymous_Update_Channel | AA: Anonymous_Update_Destination
 *   AB: Anonymous_Update_Destination_Status | AC: Anonymous_Update_Verified_At
 *   AD: Anonymous_Update_Verified_By | AE: Anonymous_Update_Last_Notified_At | AF: Anonymous_Update_Notes
 *
 * Status values: Open | In Progress | Resolved | Closed
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import { buildRegentAlertEmail, buildStudentConfirmationEmail, buildTicketUpdateEmail } from '@/lib/email-templates';
import { redactErrorForLog } from '@/lib/security';
import type { Campus, CollegeInstitute, TicketStatus } from '@/lib/ticket-constants';
import { processGrievanceNotificationQueue } from '@/lib/grievance-notifications';

// Re-export shared constants so server-side callers can still import from here.
export { GRIEVANCE_CATEGORIES } from '@/lib/ticket-constants';
export type { GrievanceCategory, TicketStatus } from '@/lib/ticket-constants';

// Ticket column indices (0-based, matches Sheet schema above)
export const TICKET_COLS = {
    TICKET_ID: 0,
    TIMESTAMP: 1,
    STATUS: 2,
    STUDENT_ID: 3,
    NAME: 4,
    EMAIL: 5,
    CAMPUS: 6,
    COLLEGE: 7,
    CATEGORY: 8,
    SUBJECT: 9,
    COMPLAINT: 10,
    ATTACHMENT_URL: 11,
    RESOLUTION_NOTES: 12,
    TRACKING_TOKEN_HASH: 13,
    LAST_NOTIFIED_SIGNATURE: 14,
    LAST_NOTIFIED_AT: 15,
    OFFICER_STATUS_DRAFT: 16,
    OFFICER_RESOLUTION_DRAFT: 17,
    OFFICER_SEND_CONTROL: 18,
    OFFICER_UPDATED_BY: 19,
    OFFICER_UPDATED_AT: 20,
    OFFICER_PUBLISH_NOTE: 21,
    OFFICER_LAST_PUBLISHED_AT: 22,
    OFFICER_LAST_PUBLISHED_BY: 23,
    OPTIONAL_UPDATE_OPT_IN: 24,
    OPTIONAL_UPDATE_CHANNEL: 25,
    OPTIONAL_UPDATE_DESTINATION: 26,
    OPTIONAL_UPDATE_DESTINATION_STATUS: 27,
    OPTIONAL_UPDATE_VERIFIED_AT: 28,
    OPTIONAL_UPDATE_VERIFIED_BY: 29,
    OPTIONAL_UPDATE_LAST_NOTIFIED_AT: 30,
    OPTIONAL_UPDATE_NOTES: 31,
} as const;

export interface TicketLookupResult {
    ticketId: string;
    status: TicketStatus;
    submittedAt: string;
    detailsRedacted: boolean;
    studentId: string;
    campus: string;
    college: string;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl: string;
    resolutionNotes: string;
}

export interface StudentTicketListItem {
    ticketId: string;
    status: TicketStatus;
    submittedAt: string;
    category: string;
    subject: string;
}

const TICKET_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OFFICIAL_STATUS_UPDATE_PREFIX = '[Official Status Update]:';

function randomBase36(length: number): string {
    const bytes = randomBytes(length);
    let output = '';
    for (const byte of bytes) {
        output += TICKET_ID_ALPHABET[byte % TICKET_ID_ALPHABET.length];
    }
    return output;
}

export function generateTicketId(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const rand = randomBase36(10);
    return `TKT-${yy}${mm}-${rand}`;
}

function getTicketTrackingSecret(): string {
    const secret = process.env.TICKET_TRACKING_TOKEN_SECRET
        || process.env.AUTH_SECRET
        || process.env.NEXTAUTH_SECRET;

    if (!secret) {
        throw new Error('Ticket tracking secret is not configured (set TICKET_TRACKING_TOKEN_SECRET).');
    }

    return secret;
}

export function generateTicketTrackingToken(): string {
    return randomBytes(24).toString('base64url');
}

export function hashTicketTrackingToken(token: string): string {
    return createHmac('sha256', getTicketTrackingSecret()).update(token).digest('hex');
}

function verifyTicketTrackingToken(token: string, expectedHash: string): boolean {
    const normalizedExpected = expectedHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedExpected)) return false;

    const providedHash = hashTicketTrackingToken(token);
    const expectedBuffer = Buffer.from(normalizedExpected, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

export interface TicketCredentials {
    ticketId: string;
    trackingToken: string;
}

export function generateTicketCredentials(): TicketCredentials {
    return {
        ticketId: generateTicketId(),
        trackingToken: generateTicketTrackingToken(),
    };
}

function getTicketSpreadsheetId(): string {
    const id = process.env.TICKET_SPREADSHEET_ID;
    if (!id) throw new Error('TICKET_SPREADSHEET_ID environment variable is not set.');
    return id;
}

const TICKET_SHEET_TAB = 'Tickets';
const TICKET_DATA_RANGE = `${TICKET_SHEET_TAB}!A2:P`;
const TICKET_SYNC_DATA_RANGE = `${TICKET_SHEET_TAB}!A2:AF`;
const TICKET_APPEND_RANGE = `${TICKET_SHEET_TAB}!A1`;
const TICKET_NOTIFICATION_QUEUE_SHEET_TAB = process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue';
const TICKET_NOTIFICATION_QUEUE_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A2:N`;
const TICKET_NOTIFICATION_QUEUE_APPEND_RANGE = `${TICKET_NOTIFICATION_QUEUE_SHEET_TAB}!A1`;

type OptionalUpdateChannel = 'None' | 'Email';
type OptionalUpdateDestinationStatus = 'Unverified' | 'Verified' | 'Revoked';

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

    const year = byType('year');
    const month = byType('month');
    const day = byType('day');
    const hour = byType('hour');
    const minute = byType('minute');
    const second = byType('second');

    return `${year}-${month}-${day} ${hour}:${minute}:${second} PHT`;
}

export async function writeTicketToSheet(ticket: {
    ticketId: string;
    timestamp: string;
    studentId: string;
    campus: Campus;
    college: CollegeInstitute;
    category: string;
    subject: string;
    name: string;
    email: string;
    complaintNarrative: string;
    attachmentUrl?: string;
    trackingTokenHash: string;
    optionalUpdateOptIn?: boolean;
    optionalUpdateChannel?: OptionalUpdateChannel;
    optionalUpdateDestination?: string;
    optionalUpdateDestinationStatus?: OptionalUpdateDestinationStatus;
    optionalUpdateNotes?: string;
}): Promise<void> {
    const optionalUpdateOptIn = Boolean(ticket.optionalUpdateOptIn);
    const optionalUpdateChannel = optionalUpdateOptIn ? (ticket.optionalUpdateChannel || 'Email') : 'None';
    const optionalUpdateDestination = optionalUpdateOptIn
        ? String(ticket.optionalUpdateDestination || '').trim().toLowerCase()
        : '';
    const optionalUpdateDestinationStatus = ticket.optionalUpdateDestinationStatus || 'Unverified';

    const row = [
        ticket.ticketId,
        toPHTString(ticket.timestamp),
        'Open',
        ticket.studentId,
        ticket.name,
        ticket.email,
        ticket.campus,
        ticket.college,
        ticket.category,
        ticket.subject || '',
        ticket.complaintNarrative,
        ticket.attachmentUrl || '',
        '',
        ticket.trackingTokenHash,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        optionalUpdateOptIn ? 'Yes' : 'No',
        optionalUpdateChannel,
        optionalUpdateDestination,
        optionalUpdateDestinationStatus,
        '',
        '',
        '',
        ticket.optionalUpdateNotes || '',
    ];
    await appendSheetData(getTicketSpreadsheetId(), TICKET_APPEND_RANGE, [row]);
}

export async function lookupTicketById(ticketId: string, trackingToken?: string | null): Promise<TicketLookupResult | null> {
    const rows = await getSheetData(getTicketSpreadsheetId(), TICKET_DATA_RANGE);

    if (!rows || rows.length === 0) return null;

    const normalizedId = ticketId.trim().toUpperCase();

    for (const row of rows) {
        const rowId = String(row[TICKET_COLS.TICKET_ID] || '').trim().toUpperCase();
        if (rowId === normalizedId) {
            const trackingHash = String(row[TICKET_COLS.TRACKING_TOKEN_HASH] || '').trim();
            const hasTrackingHash = trackingHash.length > 0;
            const normalizedToken = typeof trackingToken === 'string' ? trackingToken.trim() : '';
            const hasProvidedToken = normalizedToken.length > 0;
            const allowSensitiveFields = hasTrackingHash
                && hasProvidedToken
                && verifyTicketTrackingToken(normalizedToken, trackingHash);

            return {
                ticketId: row[TICKET_COLS.TICKET_ID] || ticketId,
                status: (row[TICKET_COLS.STATUS] || 'Open') as TicketStatus,
                submittedAt: row[TICKET_COLS.TIMESTAMP] || '',
                detailsRedacted: !allowSensitiveFields,
                studentId: allowSensitiveFields ? (row[TICKET_COLS.STUDENT_ID] || '') : '',
                campus: allowSensitiveFields ? (row[TICKET_COLS.CAMPUS] || '') : '',
                college: allowSensitiveFields ? (row[TICKET_COLS.COLLEGE] || '') : '',
                category: allowSensitiveFields ? (row[TICKET_COLS.CATEGORY] || '') : '',
                subject: allowSensitiveFields ? (row[TICKET_COLS.SUBJECT] || '') : '',
                complaintNarrative: allowSensitiveFields ? (row[TICKET_COLS.COMPLAINT] || '') : '',
                attachmentUrl: allowSensitiveFields ? (row[TICKET_COLS.ATTACHMENT_URL] || '') : '',
                resolutionNotes: allowSensitiveFields ? (row[TICKET_COLS.RESOLUTION_NOTES] || '') : '',
            };
        }
    }

    return null;
}

function normalizeEmailForMatch(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function isDeliverableOwnerEmail(value: string): boolean {
    if (!value) return false;
    if (value === 'anonymous@rtu.edu.ph') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function lookupTicketByIdForOwner(
    ticketId: string,
    options?: {
        trackingToken?: string | null;
        ownerEmail?: string | null;
    }
): Promise<TicketLookupResult | null> {
    const rows = await getSheetData(getTicketSpreadsheetId(), TICKET_DATA_RANGE);

    if (!rows || rows.length === 0) return null;

    const normalizedId = ticketId.trim().toUpperCase();
    const normalizedOwnerEmail = normalizeEmailForMatch(options?.ownerEmail);
    const normalizedToken = typeof options?.trackingToken === 'string' ? options.trackingToken.trim() : '';

    for (const row of rows) {
        const rowId = String(row[TICKET_COLS.TICKET_ID] || '').trim().toUpperCase();
        if (rowId !== normalizedId) {
            continue;
        }

        const rowEmail = normalizeEmailForMatch(row[TICKET_COLS.EMAIL]);
        const ownerMatch = Boolean(normalizedOwnerEmail)
            && isDeliverableOwnerEmail(rowEmail)
            && rowEmail === normalizedOwnerEmail;

        const trackingHash = String(row[TICKET_COLS.TRACKING_TOKEN_HASH] || '').trim();
        const hasTrackingHash = trackingHash.length > 0;
        const hasProvidedToken = normalizedToken.length > 0;
        const tokenMatch = hasTrackingHash
            && hasProvidedToken
            && verifyTicketTrackingToken(normalizedToken, trackingHash);

        const allowSensitiveFields = ownerMatch || tokenMatch;

        return {
            ticketId: row[TICKET_COLS.TICKET_ID] || ticketId,
            status: (row[TICKET_COLS.STATUS] || 'Open') as TicketStatus,
            submittedAt: row[TICKET_COLS.TIMESTAMP] || '',
            detailsRedacted: !allowSensitiveFields,
            studentId: allowSensitiveFields ? (row[TICKET_COLS.STUDENT_ID] || '') : '',
            campus: allowSensitiveFields ? (row[TICKET_COLS.CAMPUS] || '') : '',
            college: allowSensitiveFields ? (row[TICKET_COLS.COLLEGE] || '') : '',
            category: allowSensitiveFields ? (row[TICKET_COLS.CATEGORY] || '') : '',
            subject: allowSensitiveFields ? (row[TICKET_COLS.SUBJECT] || '') : '',
            complaintNarrative: allowSensitiveFields ? (row[TICKET_COLS.COMPLAINT] || '') : '',
            attachmentUrl: allowSensitiveFields ? (row[TICKET_COLS.ATTACHMENT_URL] || '') : '',
            resolutionNotes: allowSensitiveFields ? (row[TICKET_COLS.RESOLUTION_NOTES] || '') : '',
        };
    }

    return null;
}

export async function listTicketsByOwnerEmail(ownerEmail: string): Promise<StudentTicketListItem[]> {
    const normalizedOwnerEmail = normalizeEmailForMatch(ownerEmail);
    if (!isDeliverableOwnerEmail(normalizedOwnerEmail)) {
        return [];
    }

    const rows = await getSheetData(getTicketSpreadsheetId(), TICKET_DATA_RANGE);
    if (!rows || rows.length === 0) {
        return [];
    }

    const items: StudentTicketListItem[] = [];

    for (const row of rows) {
        const rowEmail = normalizeEmailForMatch(row[TICKET_COLS.EMAIL]);
        if (rowEmail !== normalizedOwnerEmail) {
            continue;
        }

        const ticketId = String(row[TICKET_COLS.TICKET_ID] || '').trim();
        if (!ticketId) {
            continue;
        }

        items.push({
            ticketId,
            status: normalizeTicketStatus(String(row[TICKET_COLS.STATUS] || 'Open')),
            submittedAt: String(row[TICKET_COLS.TIMESTAMP] || '').trim(),
            category: String(row[TICKET_COLS.CATEGORY] || '').trim(),
            subject: String(row[TICKET_COLS.SUBJECT] || '').trim(),
        });
    }

    return items.reverse();
}

function buildTrackingUrl(ticketId: string, trackingToken?: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://osr.rtu.edu.ph';
    const query = new URLSearchParams({ id: ticketId });
    if (trackingToken) {
        query.set('access', trackingToken);
    }
    return `${baseUrl}/services/track?${query.toString()}`;
}

function buildSheetUrl(): string {
    try {
        return `https://docs.google.com/spreadsheets/d/${getTicketSpreadsheetId()}/edit`;
    } catch {
        return '#';
    }
}

interface SendTicketEmailsParams {
    ticketId: string;
    trackingToken: string;
    studentId: string;
    name: string;
    studentEmail: string;
    isAnonymous: boolean;
    contactEmail?: string;
    campus: Campus;
    college: CollegeInstitute;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl?: string;
    submittedAt: string;
}

export async function sendTicketEmails(params: SendTicketEmailsParams): Promise<void> {
    const trackingUrl = buildTrackingUrl(params.ticketId, params.trackingToken);
    const sheetUrl = buildSheetUrl();
    const regentEmail = process.env.REGENT_EMAIL;

    const templateProps = {
        ticketId: params.ticketId,
        studentId: params.studentId,
        name: params.name,
        campus: params.campus,
        college: params.college,
        category: params.category,
        subject: params.subject,
        complaintNarrative: params.complaintNarrative,
        attachmentUrl: params.attachmentUrl || '',
        submittedAt: params.submittedAt,
        trackingUrl,
    };

    const jobs: Array<{ label: string; send: Promise<boolean> }> = [];

    const confirmationTarget = params.contactEmail?.trim() || '';
    if (confirmationTarget) {
        jobs.push({
            label: 'Student/Contact confirmation',
            send: sendEmail({
                to: confirmationTarget,
                subject: `[${params.ticketId}] Your grievance has been received - RTU Student Government`,
                html: buildStudentConfirmationEmail(templateProps),
            }),
        });
    }

    if (regentEmail) {
        jobs.push({
            label: 'Regent alert',
            send: sendEmail({
                to: regentEmail,
                subject: `[New Ticket ${params.ticketId}] ${params.category} Grievance`,
                html: buildRegentAlertEmail(
                    {
                        ...templateProps,
                        isAnonymous: params.isAnonymous,
                        submitterEmail: params.isAnonymous ? 'anonymous' : params.studentEmail,
                    },
                    sheetUrl,
                ),
            }),
        });
    }

    const results = await Promise.allSettled(jobs.map((job) => job.send));
    results.forEach((item, index) => {
        const label = jobs[index]?.label || 'Email job';
        if (item.status === 'fulfilled') {
            console.log(`[Tickets] ${label}: ${item.value ? 'sent' : 'sendMail returned false'}`);
            return;
        }

        console.error(`[Tickets] ${label} FAILED:`, redactErrorForLog(item.reason));
    });
}

function normalizeTicketStatus(rawStatus: string): TicketStatus {
    const normalized = rawStatus
        .replace(/^[^a-zA-Z]+/, '')
        .trim()
        .toLowerCase();

    if (normalized === 'open') return 'Open';
    if (normalized === 'in progress' || normalized === 'in-progress' || normalized === 'under review') return 'In Progress';
    if (normalized === 'resolved' || normalized === 'done') return 'Resolved';
    if (normalized === 'closed') return 'Closed';
    if (normalized === 'appealed' || normalized === 'appeal submitted') return 'Appealed';
    return 'Open';
}

function normalizeResolutionNotes(rawValue: string): string {
    return String(rawValue || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .trim();
}

function buildTicketUpdateSignature(status: TicketStatus, resolutionNotes: string): string {
    const resolution = normalizeResolutionNotes(resolutionNotes)
        .toLowerCase()
        .replace(/\s+/g, ' ');
    return `${status.toLowerCase()}|${resolution}`;
}

type TicketUpdateControlMode = 'auto' | 'officer' | 'hybrid';

function resolveTicketUpdateControlMode(): TicketUpdateControlMode {
    const value = String(process.env.TICKET_UPDATE_CONTROL_MODE || '').trim().toLowerCase();
    if (value === 'auto' || value === 'officer' || value === 'hybrid') {
        return value;
    }

    return 'hybrid';
}

function normalizeOfficerSendControl(rawValue: string): string {
    return String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function hasOfficerControlMetadata(row: string[]): boolean {
    const sendControl = normalizeOfficerSendControl(String(row[TICKET_COLS.OFFICER_SEND_CONTROL] || ''));
    const publishNote = String(row[TICKET_COLS.OFFICER_PUBLISH_NOTE] || '').trim();
    const lastPublishedAt = String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_AT] || '').trim();
    const lastPublishedBy = String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_BY] || '').trim();

    return Boolean(sendControl || publishNote || lastPublishedAt || lastPublishedBy);
}

function buildOfficerPublishMarker(row: string[]): string {
    const sendControl = normalizeOfficerSendControl(String(row[TICKET_COLS.OFFICER_SEND_CONTROL] || ''));
    const lastPublishedAt = String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_AT] || '').trim();
    const lastPublishedBy = String(row[TICKET_COLS.OFFICER_LAST_PUBLISHED_BY] || '').trim().toLowerCase();

    if (sendControl !== 'published' || !lastPublishedAt) {
        return '';
    }

    return `${lastPublishedAt}|${lastPublishedBy}`;
}

interface NotificationSignatureDecision {
    baseSignature: string;
    nextSignature: string;
    requiresOfficerPublish: boolean;
    sendEligible: boolean;
    hasPublishMarker: boolean;
}

function resolveNotificationSignatureDecision(
    row: string[],
    status: TicketStatus,
    resolutionNotes: string,
    controlMode: TicketUpdateControlMode,
): NotificationSignatureDecision {
    const baseSignature = buildTicketUpdateSignature(status, resolutionNotes);
    const requiresOfficerPublish = controlMode === 'officer'
        || (controlMode === 'hybrid' && hasOfficerControlMetadata(row));

    if (!requiresOfficerPublish) {
        return {
            baseSignature,
            nextSignature: baseSignature,
            requiresOfficerPublish: false,
            sendEligible: true,
            hasPublishMarker: false,
        };
    }

    const publishMarker = buildOfficerPublishMarker(row);
    if (!publishMarker) {
        return {
            baseSignature,
            nextSignature: `${baseSignature}|publish:pending`,
            requiresOfficerPublish: true,
            sendEligible: false,
            hasPublishMarker: false,
        };
    }

    return {
        baseSignature,
        nextSignature: `${baseSignature}|publish:${publishMarker}`,
        requiresOfficerPublish: true,
        sendEligible: true,
        hasPublishMarker: true,
    };
}

function isDeliverableTicketEmail(rawEmail: string): boolean {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || email === 'anonymous@rtu.edu.ph') {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isOptionalUpdateOptedIn(rawValue: string): boolean {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === '1';
}

function normalizeOptionalUpdateChannel(rawValue: string): OptionalUpdateChannel {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'email') return 'Email';
    return 'None';
}

function normalizeOptionalDestinationStatus(rawValue: string): OptionalUpdateDestinationStatus {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'verified') return 'Verified';
    if (normalized === 'revoked') return 'Revoked';
    return 'Unverified';
}

interface OptionalUpdateRecipientResolution {
    recipientEmail: string;
    awaitingVerification: boolean;
}

function resolveOptionalUpdateRecipient(row: string[]): OptionalUpdateRecipientResolution {
    const optedIn = isOptionalUpdateOptedIn(String(row[TICKET_COLS.OPTIONAL_UPDATE_OPT_IN] || ''));
    const channel = normalizeOptionalUpdateChannel(String(row[TICKET_COLS.OPTIONAL_UPDATE_CHANNEL] || ''));
    const destination = String(row[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION] || '').trim().toLowerCase();
    const destinationStatus = normalizeOptionalDestinationStatus(String(row[TICKET_COLS.OPTIONAL_UPDATE_DESTINATION_STATUS] || ''));

    if (!optedIn || channel !== 'Email' || !destination || !isDeliverableTicketEmail(destination)) {
        return {
            recipientEmail: '',
            awaitingVerification: false,
        };
    }

    if (destinationStatus !== 'Verified') {
        return {
            recipientEmail: '',
            awaitingVerification: true,
        };
    }

    return {
        recipientEmail: destination,
        awaitingVerification: false,
    };
}

interface TicketNotificationRecipientResolution {
    recipientEmail: string;
    usedOptionalChannel: boolean;
    awaitingVerification: boolean;
}

function resolveTicketNotificationRecipient(row: string[]): TicketNotificationRecipientResolution {
    const primaryRecipientEmail = String(row[TICKET_COLS.EMAIL] || '').trim().toLowerCase();
    if (isDeliverableTicketEmail(primaryRecipientEmail)) {
        return {
            recipientEmail: primaryRecipientEmail,
            usedOptionalChannel: false,
            awaitingVerification: false,
        };
    }

    const optionalRecipient = resolveOptionalUpdateRecipient(row);
    if (optionalRecipient.recipientEmail) {
        return {
            recipientEmail: optionalRecipient.recipientEmail,
            usedOptionalChannel: true,
            awaitingVerification: false,
        };
    }

    return {
        recipientEmail: '',
        usedOptionalChannel: false,
        awaitingVerification: optionalRecipient.awaitingVerification,
    };
}

type QueueEventStatus = 'pending' | 'retry' | 'sent' | 'skipped';

interface QueueEventRecord {
    rowNumber: number;
    eventId: string;
    ticketId: string;
    publishMarker: string;
    enqueuedAt: string;
    source: string;
    status: QueueEventStatus;
    lastAttemptAt: string;
    attempts: number;
    lastError: string;
}

function parseQueueEventStatus(rawValue: string): QueueEventStatus {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'pending' || normalized === 'retry' || normalized === 'sent' || normalized === 'skipped') {
        return normalized;
    }
    return 'pending';
}

function parseQueueRow(row: string[], rowNumber: number): QueueEventRecord {
    const attempts = Number.parseInt(String(row[7] || '0').trim(), 10);
    return {
        rowNumber,
        eventId: String(row[0] || '').trim(),
        ticketId: String(row[1] || '').trim(),
        publishMarker: String(row[2] || '').trim(),
        enqueuedAt: String(row[3] || '').trim(),
        source: String(row[4] || '').trim() || 'unknown',
        status: parseQueueEventStatus(String(row[5] || 'pending')),
        lastAttemptAt: String(row[6] || '').trim(),
        attempts: Number.isFinite(attempts) ? attempts : 0,
        lastError: String(row[8] || '').trim(),
    };
}

function generateQueueEventId(): string {
    return `QEV-${randomBase36(12)}`;
}

export interface EnqueueTicketNotificationEventInput {
    ticketId: string;
    publishMarker?: string;
    source?: string;
}

export interface EnqueueTicketNotificationEventResult {
    queued: boolean;
    eventId: string;
}

export async function enqueueTicketNotificationEvent(input: EnqueueTicketNotificationEventInput): Promise<EnqueueTicketNotificationEventResult> {
    const ticketId = String(input.ticketId || '').trim().toUpperCase();
    if (!ticketId) {
        throw new Error('ticketId is required');
    }

    const eventId = generateQueueEventId();
    const nowIso = new Date().toISOString();
    const row = [
        eventId,
        ticketId,
        String(input.publishMarker || '').trim(),
        nowIso,
        String(input.source || 'apps-script').trim() || 'apps-script',
        'pending',
        '',
        '0',
        '',
    ];

    await appendSheetData(getTicketSpreadsheetId(), TICKET_NOTIFICATION_QUEUE_APPEND_RANGE, [row]);
    return {
        queued: true,
        eventId,
    };
}

export interface ProcessTicketNotificationQueueOptions {
    dryRun?: boolean;
    limit?: number;
}

export interface ProcessTicketNotificationQueueResult {
    scanned: number;
    picked: number;
    sent: number;
    skipped: number;
    failed: number;
    awaitingOfficerPublish: number;
    skippedUnverifiedOptionalChannel: number;
    optionalChannelUsed: number;
    stalePublishMarker: number;
    alreadyCurrent: number;
    updatedQueueRows: number;
    updatedTicketRows: number;
    dryRun: boolean;
}

export async function processTicketNotificationQueue(options: ProcessTicketNotificationQueueOptions = {}): Promise<ProcessTicketNotificationQueueResult> {
    const summary = await processGrievanceNotificationQueue({
        spreadsheetId: getTicketSpreadsheetId(),
        queueTab: TICKET_NOTIFICATION_QUEUE_SHEET_TAB,
        queueRange: TICKET_NOTIFICATION_QUEUE_RANGE,
        queueAppendRange: TICKET_NOTIFICATION_QUEUE_APPEND_RANGE,
    }, options);

    return {
        scanned: summary.scanned,
        picked: summary.picked,
        sent: summary.sent,
        skipped: summary.skipped,
        failed: summary.failed + summary.deadLettered,
        awaitingOfficerPublish: 0,
        skippedUnverifiedOptionalChannel: 0,
        optionalChannelUsed: 0,
        stalePublishMarker: 0,
        alreadyCurrent: 0,
        updatedQueueRows: summary.updatedQueueRows,
        updatedTicketRows: 0,
        dryRun: summary.dryRun,
    };
}

export function buildTicketStatusHistoryMessage(
    status: TicketStatus,
    previousStatus?: TicketStatus | null,
): string {
    if (previousStatus && previousStatus !== status) {
        return `${OFFICIAL_STATUS_UPDATE_PREFIX} Ticket status changed from "${previousStatus}" to "${status}".`;
    }

    return `${OFFICIAL_STATUS_UPDATE_PREFIX} Ticket status changed to "${status}".`;
}

export function isTicketStatusHistoryMessage(message: string): boolean {
    return String(message || '').trim().startsWith(OFFICIAL_STATUS_UPDATE_PREFIX);
}

interface TicketUpdateNotificationSyncResult {
    scanned: number;
    baselineInitialized: number;
    unchanged: number;
    awaitingOfficerPublish: number;
    migratedLegacySignatures: number;
    sent: number;
    skippedNoEmail: number;
    skippedUnverifiedOptionalChannel: number;
    optionalChannelUsed: number;
    failedEmail: number;
    updatedRows: number;
    dryRun: boolean;
}

interface SyncTicketUpdateOptions {
    dryRun?: boolean;
}

export async function syncTicketUpdateNotifications(options: SyncTicketUpdateOptions = {}): Promise<TicketUpdateNotificationSyncResult> {
    const rows = await getSheetData(getTicketSpreadsheetId(), TICKET_SYNC_DATA_RANGE);

    return {
        scanned: rows.length,
        baselineInitialized: 0,
        unchanged: rows.length,
        awaitingOfficerPublish: 0,
        migratedLegacySignatures: 0,
        sent: 0,
        skippedNoEmail: 0,
        skippedUnverifiedOptionalChannel: 0,
        optionalChannelUsed: 0,
        failedEmail: 0,
        updatedRows: 0,
        dryRun: Boolean(options.dryRun),
    };
}

export function generateGrievanceCommentId(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `C-${yy}${mm}-${randomBase36(8)}`;
}

const COMMENTS_APPEND_RANGE = 'Ticket_Comments_Appeals!A1';

export async function appendGrievanceComment(comment: {
    commentId: string;
    ticketId: string;
    timestamp: string;
    authorEmail: string;
    authorRole: string;
    message: string;
    attachmentUrl?: string;
    isAppeal?: boolean;
}): Promise<void> {
    await appendSheetData(getTicketSpreadsheetId(), COMMENTS_APPEND_RANGE, [[
        comment.commentId,
        comment.ticketId,
        comment.timestamp,
        comment.authorEmail,
        comment.authorRole,
        comment.message,
        comment.attachmentUrl || '',
        comment.isAppeal ? 'TRUE' : 'FALSE',
    ]]);
}
