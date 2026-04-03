/**
 * Ticket orchestration layer.
 * Manages ticket ID generation, Google Sheets persistence, and email dispatch.
 *
 * Google Sheet schema (row 1 must be headers, add them once manually):
 *   A: Ticket_ID | B: Timestamp | C: Status | D: Student_ID | E: Name
 *   F: Email     | G: Campus    | H: College_Institute | I: Category
 *   J: Subject   | K: Complaint_Narrative | L: Attachment_URL
 *   M: Resolution_Notes | N: Tracking_Token_Hash
 *
 * Status values: Open | In Progress | Resolved | Closed
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { appendSheetData, getSheetData } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import { buildStudentConfirmationEmail, buildRegentAlertEmail } from '@/lib/email-templates';
import { redactErrorForLog } from '@/lib/security';
import type { Campus, CollegeInstitute, TicketStatus } from '@/lib/ticket-constants';

// Re-export shared constants so server-side callers can still import from here.
export { GRIEVANCE_CATEGORIES } from '@/lib/ticket-constants';
export type { GrievanceCategory, TicketStatus } from '@/lib/ticket-constants';

// ── Ticket column indices (0-based, matches Sheet schema above) ───────────────
export const TICKET_COLS = {
    TICKET_ID:        0,
    TIMESTAMP:        1,
    STATUS:           2,
    STUDENT_ID:       3,
    NAME:             4,
    EMAIL:            5,
    CAMPUS:           6,
    COLLEGE:          7,
    CATEGORY:         8,
    SUBJECT:          9,
    COMPLAINT:        10,
    ATTACHMENT_URL:   11,
    RESOLUTION_NOTES: 12,
    TRACKING_TOKEN_HASH: 13,
} as const;

/** What the API returns when a student looks up their ticket. */
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

// Ticket IDs and tracking tokens are generated with CSPRNG-backed bytes.
const TICKET_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
//to dreko: funny ticket encryption, something out of banking systems
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

// ── Sheet ID config ───────────────────────────────────────────────────────────
function getTicketSpreadsheetId(): string {
    const id = process.env.TICKET_SPREADSHEET_ID;
    if (!id) throw new Error('TICKET_SPREADSHEET_ID environment variable is not set.');
    return id;
}

/** The tab/sheet name inside the spreadsheet where tickets are stored. */
const TICKET_SHEET_TAB = 'Tickets';

/** Full A1 notation range for reading all ticket rows (after header). */
const TICKET_DATA_RANGE = `${TICKET_SHEET_TAB}!A2:N`;

/** A1 range used for appending new rows. */
const TICKET_APPEND_RANGE = `${TICKET_SHEET_TAB}!A1`;

// ── Timestamp helpers ────────────────────────────────────────────────────────
/**
 * Returns a human-readable Philippine Standard Time (UTC+8) string.
 * Stored this way in the Sheet so the Regent sees local time directly.
 * Format: "2026-04-02 17:47:12 PHT"
 */
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

// ── Core persistence functions ────────────────────────────────────────────────
/**
 * Writes a new ticket row to the Google Sheet.
 * All values are RAW (no formula injection risk).
 */
export async function writeTicketToSheet(ticket: {
    ticketId: string;
    timestamp: string;   // ISO UTC string — converted to PHT for display
    studentId: string;
    campus: Campus;
    college: CollegeInstitute;
    category: string;
    subject: string;
    name: string;
    email: string;       // empty string if anonymous
    complaintNarrative: string;
    attachmentUrl?: string;
    trackingTokenHash: string;
}): Promise<void> {
    const row = [
        ticket.ticketId,
        toPHTString(ticket.timestamp),  // ← stored as PHT so regent sees local time
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
    ];
    await appendSheetData(getTicketSpreadsheetId(), TICKET_APPEND_RANGE, [row]);
}

/**
 * Looks up a ticket by ID. Returns null if not found.
 * Returns only status/timestamp by default. Sensitive metadata requires tracking token.
 */
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

// ── Email dispatch ────────────────────────────────────────────────────────────
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
    studentEmail: string;   // Real email for dispatch; may be '' if anonymous
    isAnonymous: boolean;
    contactEmail?: string;  // Optional: anonymous user asking for a copy to their preferred email
    campus: Campus;
    college: CollegeInstitute;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl?: string;
    submittedAt: string;
}

/**
 * Dispatches both the student auto-responder and the Regent alert.
 * Uses Promise.allSettled so one failure doesn't block the other.
 */
export async function sendTicketEmails(params: SendTicketEmailsParams): Promise<void> {
    const trackingUrl = buildTrackingUrl(params.ticketId, params.trackingToken);
    const sheetUrl    = buildSheetUrl();
    const regentEmail = process.env.REGENT_EMAIL;

    const templateProps = {
        ticketId:    params.ticketId,
        studentId:   params.studentId,
        name:        params.name,
        campus:      params.campus,
        college:     params.college,
        category:    params.category,
        subject:     params.subject,
        complaintNarrative: params.complaintNarrative,
        attachmentUrl: params.attachmentUrl || '',
        submittedAt: params.submittedAt,
        trackingUrl,
    };

    const jobs: Array<{ label: string; send: Promise<boolean> }> = [];

    // 1. Student confirmation — send if they explicitly opted in (contactEmail provided)
    const confirmationTarget = params.contactEmail?.trim() || '';

    if (confirmationTarget) {
        console.log(`[Tickets] Sending student confirmation to: ${confirmationTarget}`);
        jobs.push({
            label: 'Student/Contact confirmation',
            send: sendEmail({
                to:      confirmationTarget,
                subject: `[${params.ticketId}] Your grievance has been received — RTU Student Government`,
                html:    buildStudentConfirmationEmail(templateProps),
            }),
        });
    } else {
        console.log(`[Tickets] Skipping student email — anonymous submission, no contact email provided.`);
    }

    // 2. Regent alert (always sent)
    if (regentEmail) {
        console.log(`[Tickets] Sending regent alert to: ${regentEmail}`);
        jobs.push({
            label: 'Regent alert',
            send: sendEmail({
                to:      regentEmail,
                subject: `[New Ticket ${params.ticketId}] ${params.category} Grievance`,
                html:    buildRegentAlertEmail(
                    {
                        ...templateProps,
                        isAnonymous:    params.isAnonymous,
                        submitterEmail: params.isAnonymous ? 'anonymous' : params.studentEmail,
                    },
                    sheetUrl
                ),
            }),
        });
    } else {
        console.warn('[Tickets] REGENT_EMAIL not set — Regent alert skipped.');
    }

    const results = await Promise.allSettled(jobs.map((job) => job.send));
    results.forEach((r, i) => {
        const label = jobs[i]?.label || 'Email job';
        if (r.status === 'fulfilled') {
            console.log(`[Tickets] ${label}: ${r.value ? 'sent ✓' : 'sendMail returned false (check SMTP credentials)'}`);
        } else {
            console.error(`[Tickets] ${label} FAILED:`, redactErrorForLog(r.reason));
        }
    });
}
