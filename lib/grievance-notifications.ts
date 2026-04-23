import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import type { Campus, CollegeInstitute, TicketStatus } from '@/lib/ticket-constants';
import {
    enqueueNotificationRow,
    processNotificationQueue,
    type NotificationMessage,
    type NotificationQueueRecord,
    type ProcessNotificationQueueOptions,
} from '@/lib/notification-queue';
import { buildNotificationEmail, htmlQuote, safeMailto } from '@/lib/notification-templates';
import { escapeHtml } from '@/lib/security';

export type GrievanceEventName =
    | 'grievance.submitted.v1'
    | 'grievance.status.changed.v1'
    | 'grievance.resolution.updated.v1'
    | 'grievance.published.v1'
    | 'grievance.appeal.submitted.v1'
    | 'grievance.comment.added.v1';

type TicketTemplateId =
    | 'ticket.submission.confirmation.v1'
    | 'ticket.submission.office.alert.v1'
    | 'ticket.status.changed.v1'
    | 'ticket.resolution.updated.v1'
    | 'ticket.published.v1'
    | 'ticket.appeal.office.alert.v1'
    | 'ticket.appeal.confirmation.v1'
    | 'ticket.comment.reply.v1'
    | 'ticket.comment.student.update.v1';

type TicketRecipientRole = 'submitter' | 'office';

export interface GrievanceNotificationQueueConfig {
    spreadsheetId: string;
    queueTab: string;
    queueRange: string;
    queueAppendRange: string;
}

interface RouteEnvelope {
    routeId: string;
    to: string;
    cc?: string;
    replyTo?: string;
}

export interface GrievanceSubmissionInput {
    queue: GrievanceNotificationQueueConfig;
    ticketId: string;
    studentId: string;
    name: string;
    studentEmail: string;
    campus: Campus | string;
    college: CollegeInstitute | string;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl?: string;
    submittedAt: string;
    recipientEmail?: string;
    optionalUpdateDestination?: string;
    optionalUpdateChannel?: string;
    optionalUpdateDestinationStatus?: string;
}

export interface GrievanceAdminUpdateInput {
    queue: GrievanceNotificationQueueConfig;
    ticketId: string;
    recipientEmail?: string;
    actorId?: string;
    category: string;
    subject: string;
    recipientName: string;
    status?: TicketStatus;
    resolutionNotes?: string;
    published?: boolean;
    publishedAt?: string;
    publishedBy?: string;
    publishNote?: string;
    updatedAt: string;
}

export interface GrievanceCommentInput {
    queue: GrievanceNotificationQueueConfig;
    ticketId: string;
    category: string;
    subject: string;
    recipientEmail?: string;
    recipientName: string;
    studentEmail?: string;
    commentId: string;
    commentTimestamp: string;
    commentMessage: string;
    commentAttachmentUrl?: string;
    authorEmail?: string;
    authorName: string;
    authorRole: string;
    isAppeal: boolean;
}

const TRACKER_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://osr.rtu.edu.ph';
const TICKET_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const deliverableEmailSchema = z.string().trim().email();

function firstConfiguredEmail(...candidates: Array<string | undefined>): string {
    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim().toLowerCase();
        if (normalized) {
            return normalized;
        }
    }
    return '';
}

const canonicalPayloadSchema = z.object({
    eventId: z.string().trim().min(1),
    occurredAtIso: z.string().trim().min(1),
    actorType: z.string().trim().min(1),
    actorId: z.string().trim(),
    actorRole: z.string().trim().min(1),
    recipientRole: z.enum(['submitter', 'office']),
    recipientEmail: z.string().trim().optional().default(''),
    replyTo: z.string().trim().optional().default(''),
    cc: z.string().trim().optional().default(''),
    trackingUrl: z.string().trim().min(1),
    ticketId: z.string().trim().min(1),
    category: z.string().trim().min(1),
    subject: z.string().trim().optional().default(''),
});

function randomBase36(length: number): string {
    const bytes = randomBytes(length);
    let output = '';
    for (const byte of bytes) {
        output += TICKET_ID_ALPHABET[byte % TICKET_ID_ALPHABET.length];
    }
    return output;
}

function generateNotificationId(): string {
    return `NTF-${randomBase36(12)}`;
}

function normalizeCategory(value: string): string {
    const normalized = String(value || '').trim();
    if (normalized === 'Facilities & Infrastructure') return 'Facilities and Infrastructure';
    if (normalized === 'Safety & Security') return 'Safety and Security';
    return normalized;
}

function buildTrackingUrl(ticketId: string): string {
    const query = new URLSearchParams({ id: ticketId });
    return `${TRACKER_BASE}/services/track?${query.toString()}`;
}

function buildSheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function normalizeTextHash(value: string): string {
    const normalized = String(value || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim()
        .toLowerCase();

    return createHash('sha256').update(normalized).digest('hex');
}

function isDeliverableEmail(value: string | undefined): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'anonymous@rtu.edu.ph') {
        return false;
    }

    return deliverableEmailSchema.safeParse(normalized).success;
}

export function resolveGrievanceSubmitterEmail(input: {
    recipientEmail?: string;
    optionalUpdateDestination?: string;
    optionalUpdateChannel?: string;
    optionalUpdateDestinationStatus?: string;
}): string {
    const primary = String(input.recipientEmail || '').trim().toLowerCase();
    if (isDeliverableEmail(primary)) {
        return primary;
    }

    const optionalChannel = String(input.optionalUpdateChannel || '').trim().toLowerCase();
    const optionalStatus = String(input.optionalUpdateDestinationStatus || '').trim().toLowerCase();
    const optionalDestination = String(input.optionalUpdateDestination || '').trim().toLowerCase();

    if (optionalChannel === 'email' && optionalStatus === 'verified' && isDeliverableEmail(optionalDestination)) {
        return optionalDestination;
    }

    return '';
}

function resolveOfficeRoute(eventName: GrievanceEventName, category: string): RouteEnvelope {
    const normalizedCategory = normalizeCategory(category);
    const osrMailbox = firstConfiguredEmail(
        process.env.EMAIL_OSR_CASEWORK,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );
    const sscMailbox = firstConfiguredEmail(
        process.env.EMAIL_SSC_CASEWORK,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );
    const osrObserver = firstConfiguredEmail(
        process.env.EMAIL_OSR_OBSERVER,
        process.env.REGENT_EMAIL,
    );
    const sscObserver = firstConfiguredEmail(
        process.env.EMAIL_SSC_OBSERVER,
        process.env.REGENT_EMAIL,
    );
    const osrReplyTo = firstConfiguredEmail(
        process.env.EMAIL_OSR_REPLY_TO,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );
    const sscReplyTo = firstConfiguredEmail(
        process.env.EMAIL_SSC_REPLY_TO,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );
    const appealMailbox = firstConfiguredEmail(
        process.env.EMAIL_OSR_APPEALS,
        osrMailbox,
    );
    const appealReplyTo = firstConfiguredEmail(
        process.env.EMAIL_OSR_APPEALS_REPLY_TO,
        osrReplyTo,
    );

    if (eventName === 'grievance.appeal.submitted.v1') {
        return {
            routeId: 'GRT-APPEAL',
            to: appealMailbox,
            cc: firstConfiguredEmail(process.env.EMAIL_SSC_APPEALS, sscMailbox),
            replyTo: appealReplyTo,
        };
    }

    if (normalizedCategory === 'Student Organizations' || normalizedCategory === 'Financial Concerns') {
        return {
            routeId: 'GRT-SSC-ORG-FIN',
            to: sscMailbox,
            cc: osrObserver,
            replyTo: sscReplyTo,
        };
    }

    if (normalizedCategory === 'Academics' || normalizedCategory === 'Faculty Conduct') {
        return {
            routeId: 'GRT-OSR-ACADEMIC',
            to: osrMailbox,
            cc: sscObserver,
            replyTo: osrReplyTo,
        };
    }

    if (
        normalizedCategory === 'Administrative Services'
        || normalizedCategory === 'Facilities and Infrastructure'
        || normalizedCategory === 'Safety and Security'
    ) {
        return {
            routeId: 'GRT-OSR-OPS',
            to: osrMailbox,
            cc: sscObserver,
            replyTo: osrReplyTo,
        };
    }

    if (normalizedCategory === 'Other') {
        return {
            routeId: 'GRT-DUAL-OTHER',
            to: osrMailbox,
            cc: sscMailbox,
            replyTo: osrReplyTo,
        };
    }

    return {
        routeId: 'GRT-FALLBACK',
        to: osrMailbox,
        cc: sscMailbox,
        replyTo: osrReplyTo,
    };
}

async function enqueueGrievanceEvent(input: {
    queue: GrievanceNotificationQueueConfig;
    eventName: GrievanceEventName;
    entityId: string;
    recipientRole: TicketRecipientRole;
    recipientEmail: string;
    routeId: string;
    templateId: TicketTemplateId;
    dedupeKey: string;
    payload: Record<string, unknown>;
}) {
    const notificationId = generateNotificationId();
    const payload = canonicalPayloadSchema.passthrough().parse({
        eventId: notificationId,
        ...input.payload,
        recipientRole: input.recipientRole,
        recipientEmail: input.recipientEmail,
    });

    return enqueueNotificationRow({
        spreadsheetId: input.queue.spreadsheetId,
        appendRange: input.queue.queueAppendRange,
        queueRange: input.queue.queueRange,
        notificationId,
        eventName: input.eventName,
        entityType: 'grievance',
        entityId: input.entityId,
        recipientEmail: input.recipientEmail,
        routeId: input.routeId,
        templateId: input.templateId,
        payloadJson: JSON.stringify(payload),
        dedupeKey: input.dedupeKey,
    });
}

export async function emitGrievanceSubmissionNotifications(input: GrievanceSubmissionInput): Promise<void> {
    const occurredAtIso = input.submittedAt;
    const trackingUrl = buildTrackingUrl(input.ticketId);
    const submitterEmail = resolveGrievanceSubmitterEmail({
        recipientEmail: input.recipientEmail,
        optionalUpdateDestination: input.optionalUpdateDestination,
        optionalUpdateChannel: input.optionalUpdateChannel,
        optionalUpdateDestinationStatus: input.optionalUpdateDestinationStatus,
    });
    const officeRoute = resolveOfficeRoute('grievance.submitted.v1', input.category);

    if (submitterEmail) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.submitted.v1',
            entityId: input.ticketId,
            recipientRole: 'submitter',
            recipientEmail: submitterEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'ticket.submission.confirmation.v1',
            dedupeKey: `grievance.submitted.v1:${input.ticketId}:submitter`,
            payload: {
                occurredAtIso,
                actorType: 'student',
                actorId: submitterEmail,
                actorRole: 'submitter',
                trackingUrl,
                ticketId: input.ticketId,
                studentId: input.studentId,
                name: input.name,
                campus: input.campus,
                college: input.college,
                category: input.category,
                subject: input.subject,
                complaintNarrative: input.complaintNarrative,
                attachmentUrl: input.attachmentUrl || '',
                submittedAt: input.submittedAt,
                cc: '',
                replyTo: '',
            },
        });
    }

    if (officeRoute.to) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.submitted.v1',
            entityId: input.ticketId,
            recipientRole: 'office',
            recipientEmail: officeRoute.to,
            routeId: officeRoute.routeId,
            templateId: 'ticket.submission.office.alert.v1',
            dedupeKey: `grievance.submitted.v1:${input.ticketId}:office`,
            payload: {
                occurredAtIso,
                actorType: 'student',
                actorId: submitterEmail || String(input.studentEmail || '').trim().toLowerCase(),
                actorRole: 'submitter',
                trackingUrl,
                ticketId: input.ticketId,
                studentId: input.studentId,
                name: input.name,
                studentEmail: String(input.studentEmail || '').trim().toLowerCase(),
                campus: input.campus,
                college: input.college,
                category: input.category,
                subject: input.subject,
                complaintNarrative: input.complaintNarrative,
                attachmentUrl: input.attachmentUrl || '',
                submittedAt: input.submittedAt,
                cc: officeRoute.cc || '',
                replyTo: officeRoute.replyTo || '',
            },
        });
    }
}

export async function emitGrievanceAdminUpdateNotifications(input: GrievanceAdminUpdateInput): Promise<void> {
    const trackingUrl = buildTrackingUrl(input.ticketId);
    const recipientEmail = String(input.recipientEmail || '').trim().toLowerCase();
    const basePayload = {
        occurredAtIso: input.updatedAt,
        actorType: 'officer',
        actorId: String(input.actorId || input.publishedBy || '').trim().toLowerCase(),
        actorRole: 'officer',
        trackingUrl,
        ticketId: input.ticketId,
        category: input.category,
        subject: input.subject,
        name: input.recipientName,
        cc: '',
        replyTo: '',
    };

    if (recipientEmail && input.status) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.status.changed.v1',
            entityId: input.ticketId,
            recipientRole: 'submitter',
            recipientEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'ticket.status.changed.v1',
            dedupeKey: `grievance.status.changed.v1:${input.ticketId}:${input.status}:${input.updatedAt}`,
            payload: {
                ...basePayload,
                status: input.status,
                updatedAt: input.updatedAt,
            },
        });
    }

    if (recipientEmail && input.resolutionNotes && input.resolutionNotes.trim()) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.resolution.updated.v1',
            entityId: input.ticketId,
            recipientRole: 'submitter',
            recipientEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'ticket.resolution.updated.v1',
            dedupeKey: `grievance.resolution.updated.v1:${input.ticketId}:${normalizeTextHash(input.resolutionNotes)}:${input.updatedAt}`,
            payload: {
                ...basePayload,
                resolutionNotes: input.resolutionNotes,
                updatedAt: input.updatedAt,
            },
        });
    }

    if (recipientEmail && input.published && input.publishedAt && input.publishedBy) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.published.v1',
            entityId: input.ticketId,
            recipientRole: 'submitter',
            recipientEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'ticket.published.v1',
            dedupeKey: `grievance.published.v1:${input.ticketId}:${input.publishedAt}:${input.publishedBy}`,
            payload: {
                ...basePayload,
                status: input.status || '',
                resolutionNotes: input.resolutionNotes || '',
                publishNote: input.publishNote || '',
                publishedAt: input.publishedAt,
                publishedBy: input.publishedBy,
            },
        });
    }
}

export async function emitGrievanceCommentNotifications(input: GrievanceCommentInput): Promise<void> {
    const trackingUrl = buildTrackingUrl(input.ticketId);
    const submitterEmail = String(input.recipientEmail || '').trim().toLowerCase();
    const officeRoute = resolveOfficeRoute(
        input.isAppeal ? 'grievance.appeal.submitted.v1' : 'grievance.comment.added.v1',
        input.category,
    );
    const normalizedAuthorRole = String(input.authorRole || '').trim().toUpperCase();
    const fromOfficer = normalizedAuthorRole === 'OFFICER' || normalizedAuthorRole === 'LEADER';
    const fromStudent = normalizedAuthorRole === 'STUDENT';

    if (input.isAppeal && fromStudent) {
        if (officeRoute.to) {
            await enqueueGrievanceEvent({
                queue: input.queue,
                eventName: 'grievance.appeal.submitted.v1',
                entityId: input.ticketId,
                recipientRole: 'office',
                recipientEmail: officeRoute.to,
                routeId: officeRoute.routeId,
                templateId: 'ticket.appeal.office.alert.v1',
                dedupeKey: `grievance.appeal.submitted.v1:${input.ticketId}:${input.commentId}:office`,
                payload: {
                    occurredAtIso: input.commentTimestamp,
                    actorType: 'student',
                    actorId: String(input.authorEmail || '').trim().toLowerCase(),
                    actorRole: 'student',
                    trackingUrl,
                    ticketId: input.ticketId,
                    category: input.category,
                    subject: input.subject,
                    name: input.authorName,
                    studentEmail: String(input.authorEmail || input.studentEmail || '').trim().toLowerCase(),
                    message: input.commentMessage,
                    attachmentUrl: input.commentAttachmentUrl || '',
                    createdAt: input.commentTimestamp,
                    cc: officeRoute.cc || '',
                    replyTo: officeRoute.replyTo || '',
                },
            });
        }

        if (submitterEmail) {
            await enqueueGrievanceEvent({
                queue: input.queue,
                eventName: 'grievance.appeal.submitted.v1',
                entityId: input.ticketId,
                recipientRole: 'submitter',
                recipientEmail: submitterEmail,
                routeId: 'STU-PRIMARY',
                templateId: 'ticket.appeal.confirmation.v1',
                dedupeKey: `grievance.appeal.submitted.v1:${input.ticketId}:${input.commentId}:submitter`,
                payload: {
                    occurredAtIso: input.commentTimestamp,
                    actorType: 'student',
                    actorId: String(input.authorEmail || '').trim().toLowerCase(),
                    actorRole: 'student',
                    trackingUrl,
                    ticketId: input.ticketId,
                    category: input.category,
                    subject: input.subject,
                    name: input.recipientName,
                    message: input.commentMessage,
                    attachmentUrl: input.commentAttachmentUrl || '',
                    createdAt: input.commentTimestamp,
                    cc: '',
                    replyTo: '',
                },
            });
        }
    }

    if (fromOfficer && submitterEmail) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.comment.added.v1',
            entityId: input.ticketId,
            recipientRole: 'submitter',
            recipientEmail: submitterEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'ticket.comment.reply.v1',
            dedupeKey: `grievance.comment.added.v1:${input.ticketId}:${input.commentId}:to_submitter`,
            payload: {
                occurredAtIso: input.commentTimestamp,
                actorType: 'officer',
                actorId: String(input.authorEmail || '').trim().toLowerCase(),
                actorRole: normalizedAuthorRole.toLowerCase(),
                trackingUrl,
                ticketId: input.ticketId,
                category: input.category,
                subject: input.subject,
                name: input.recipientName,
                authorName: input.authorName,
                authorRole: normalizedAuthorRole,
                message: input.commentMessage,
                attachmentUrl: input.commentAttachmentUrl || '',
                createdAt: input.commentTimestamp,
                cc: '',
                replyTo: '',
            },
        });
    }

    if (fromStudent && officeRoute.to) {
        await enqueueGrievanceEvent({
            queue: input.queue,
            eventName: 'grievance.comment.added.v1',
            entityId: input.ticketId,
            recipientRole: 'office',
            recipientEmail: officeRoute.to,
            routeId: officeRoute.routeId,
            templateId: 'ticket.comment.student.update.v1',
            dedupeKey: `grievance.comment.added.v1:${input.ticketId}:${input.commentId}:to_office`,
            payload: {
                occurredAtIso: input.commentTimestamp,
                actorType: 'student',
                actorId: String(input.authorEmail || input.studentEmail || '').trim().toLowerCase(),
                actorRole: 'student',
                trackingUrl,
                ticketId: input.ticketId,
                category: input.category,
                subject: input.subject,
                name: input.authorName,
                studentEmail: String(input.authorEmail || input.studentEmail || '').trim().toLowerCase(),
                message: input.commentMessage,
                attachmentUrl: input.commentAttachmentUrl || '',
                createdAt: input.commentTimestamp,
                cc: officeRoute.cc || '',
                replyTo: officeRoute.replyTo || '',
            },
        });
    }
}

function statusBadge(value: string, tone: 'blue' | 'gold' = 'blue'): string {
    const background = tone === 'gold' ? '#fef3c7' : '#e0f2fe';
    const color = tone === 'gold' ? '#92400e' : '#075985';
    return `<span style="background:${background};color:${color};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">${escapeHtml(value)}</span>`;
}

function toInfoValue(value: unknown): string {
    return String(value || '').trim();
}

function buildSubject(templateId: TicketTemplateId, payload: Record<string, unknown>): string {
    const ticketId = toInfoValue(payload.ticketId);
    const category = toInfoValue(payload.category);
    const status = toInfoValue(payload.status);

    switch (templateId) {
        case 'ticket.submission.confirmation.v1':
            return `[${ticketId}] Your grievance has been received`;
        case 'ticket.submission.office.alert.v1':
            return `[New Ticket ${ticketId}] ${category || 'Grievance'} submitted`;
        case 'ticket.status.changed.v1':
            return `[${ticketId}] Grievance status changed to ${status || 'Updated'}`;
        case 'ticket.resolution.updated.v1':
            return `[${ticketId}] Resolution notes were updated`;
        case 'ticket.published.v1':
            return `[${ticketId}] An officer update was published`;
        case 'ticket.appeal.office.alert.v1':
            return `[${ticketId}] New grievance appeal submitted`;
        case 'ticket.appeal.confirmation.v1':
            return `[${ticketId}] Your grievance appeal was received`;
        case 'ticket.comment.reply.v1':
            return `[${ticketId}] New reply on your grievance`;
        case 'ticket.comment.student.update.v1':
            return `[${ticketId}] Student follow-up received`;
        default:
            return `[${ticketId}] Grievance notification`;
    }
}

function renderSubmissionConfirmation(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Grievance Received',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, your grievance has been received and routed into the student government workflow.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Student ID', value: toInfoValue(payload.studentId) || 'Not provided' },
            { label: 'Campus', value: toInfoValue(payload.campus) || 'Not provided' },
            { label: 'College', value: toInfoValue(payload.college) || 'Not provided' },
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Submitted', value: toInfoValue(payload.submittedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Complaint Narrative',
        bodyHtml: htmlQuote(toInfoValue(payload.complaintNarrative)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'You will receive follow-up notifications whenever there is a meaningful update on this ticket.',
    });
}

function renderSubmissionOfficeAlert(payload: Record<string, unknown>, spreadsheetId: string): string {
    const studentEmail = toInfoValue(payload.studentEmail);
    const emailDisplay = studentEmail
        ? `<a href="${escapeHtml(safeMailto(studentEmail))}" style="color:#8B1A1A;">${escapeHtml(studentEmail)}</a>`
        : '<em style="color:#888;">Anonymous submission</em>';

    return buildNotificationEmail({
        title: 'New Grievance Submitted',
        eyebrow: 'Office Alert',
        intro: 'A new grievance entered the queue and should be reviewed by the routed office.',
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Student', value: toInfoValue(payload.name) || 'Student' },
            { label: 'Email', value: emailDisplay, allowHtml: true },
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Campus', value: toInfoValue(payload.campus) || 'Not provided' },
            { label: 'College', value: toInfoValue(payload.college) || 'Not provided' },
        ],
        bodyLabel: 'Complaint Narrative',
        bodyHtml: htmlQuote(toInfoValue(payload.complaintNarrative)),
        actions: [
            { href: buildSheetUrl(spreadsheetId), label: 'Open Spreadsheet', tone: 'primary' },
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'secondary' },
        ],
        footerNote: 'Routing for this alert was selected automatically from the grievance category.',
    });
}

function renderStatusChanged(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Grievance Status Updated',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, the status of your grievance has changed.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Status', value: statusBadge(toInfoValue(payload.status) || 'Updated'), allowHtml: true },
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Updated', value: toInfoValue(payload.updatedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'Use the ticket tracker to review the current status and any officer notes.',
    });
}

function renderResolutionUpdated(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Resolution Notes Updated',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, there is a new resolution update on your grievance.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Updated', value: toInfoValue(payload.updatedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Resolution Notes',
        bodyHtml: htmlQuote(toInfoValue(payload.resolutionNotes)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'Keep your ticket ID handy if you need to reference this case later.',
    });
}

function renderPublished(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Official Ticket Update Published',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, an officer published a new official update on your grievance.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Status', value: statusBadge(toInfoValue(payload.status) || 'Updated', 'gold'), allowHtml: true },
            { label: 'Published By', value: toInfoValue(payload.publishedBy) || 'OSR Office' },
            { label: 'Published', value: toInfoValue(payload.publishedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Officer Note',
        bodyHtml: htmlQuote(toInfoValue(payload.publishNote) || toInfoValue(payload.resolutionNotes)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'Published updates represent the current official response recorded by the reviewing office.',
    });
}

function renderAppealOfficeAlert(payload: Record<string, unknown>): string {
    const studentEmail = toInfoValue(payload.studentEmail);
    const emailDisplay = studentEmail
        ? `<a href="${escapeHtml(safeMailto(studentEmail))}" style="color:#8B1A1A;">${escapeHtml(studentEmail)}</a>`
        : '<em style="color:#888;">No email available</em>';

    return buildNotificationEmail({
        title: 'Grievance Appeal Submitted',
        eyebrow: 'Office Alert',
        intro: 'A student submitted a formal appeal on an existing grievance ticket.',
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Student', value: toInfoValue(payload.name) || 'Student' },
            { label: 'Email', value: emailDisplay, allowHtml: true },
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Submitted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Appeal Message',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'Appeals follow the dedicated appeal routing path so they can be triaged separately.',
    });
}

function renderAppealConfirmation(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Appeal Received',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, your grievance appeal was received and routed for review.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Submitted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Appeal Message',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'You will be notified again when the office posts a meaningful follow-up on this appeal.',
    });
}

function renderCommentReply(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'New Grievance Reply',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.name) || 'Student')}</strong>, the reviewing office posted a new reply on your grievance.`,
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Author', value: toInfoValue(payload.authorName) || 'Officer' },
            { label: 'Role', value: statusBadge(toInfoValue(payload.authorRole) || 'OFFICER'), allowHtml: true },
            { label: 'Posted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Reply',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'Reply in the ticket tracker if you need to add context or supporting details.',
    });
}

function renderStudentUpdate(payload: Record<string, unknown>): string {
    const studentEmail = toInfoValue(payload.studentEmail);
    const emailDisplay = studentEmail
        ? `<a href="${escapeHtml(safeMailto(studentEmail))}" style="color:#8B1A1A;">${escapeHtml(studentEmail)}</a>`
        : '<em style="color:#888;">No email available</em>';

    return buildNotificationEmail({
        title: 'Student Follow-up Received',
        eyebrow: 'Office Alert',
        intro: 'A student posted a new follow-up on an existing grievance ticket.',
        heroLabel: 'Ticket ID',
        heroValue: toInfoValue(payload.ticketId),
        infoRows: [
            { label: 'Student', value: toInfoValue(payload.name) || 'Student' },
            { label: 'Email', value: emailDisplay, allowHtml: true },
            { label: 'Category', value: toInfoValue(payload.category) || 'General' },
            { label: 'Subject', value: toInfoValue(payload.subject) || '(No subject)' },
            { label: 'Posted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Follow-up Message',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Ticket Tracker', tone: 'primary' },
        ],
        footerNote: 'This notification helps the routed office see student follow-ups without polling the tracker.',
    });
}

export function buildGrievanceNotificationMessage(
    record: NotificationQueueRecord,
    payload: Record<string, unknown>,
    spreadsheetId: string,
): NotificationMessage {
    const parsedPayload = canonicalPayloadSchema.passthrough().parse(payload);
    const templateId = record.templateId as TicketTemplateId;
    let html = '';

    switch (templateId) {
        case 'ticket.submission.confirmation.v1':
            html = renderSubmissionConfirmation(parsedPayload);
            break;
        case 'ticket.submission.office.alert.v1':
            html = renderSubmissionOfficeAlert(parsedPayload, spreadsheetId);
            break;
        case 'ticket.status.changed.v1':
            html = renderStatusChanged(parsedPayload);
            break;
        case 'ticket.resolution.updated.v1':
            html = renderResolutionUpdated(parsedPayload);
            break;
        case 'ticket.published.v1':
            html = renderPublished(parsedPayload);
            break;
        case 'ticket.appeal.office.alert.v1':
            html = renderAppealOfficeAlert(parsedPayload);
            break;
        case 'ticket.appeal.confirmation.v1':
            html = renderAppealConfirmation(parsedPayload);
            break;
        case 'ticket.comment.reply.v1':
            html = renderCommentReply(parsedPayload);
            break;
        case 'ticket.comment.student.update.v1':
            html = renderStudentUpdate(parsedPayload);
            break;
        default:
            throw new Error(`Unsupported grievance template: ${record.templateId}`);
    }

    return {
        to: record.recipientEmail,
        cc: toInfoValue(parsedPayload.cc),
        replyTo: toInfoValue(parsedPayload.replyTo),
        subject: buildSubject(templateId, parsedPayload),
        html,
    };
}

export async function processGrievanceNotificationQueue(
    queue: GrievanceNotificationQueueConfig,
    options: ProcessNotificationQueueOptions = {},
) {
    return processNotificationQueue({
        spreadsheetId: queue.spreadsheetId,
        queueTab: queue.queueTab,
        queueRange: queue.queueRange,
        buildMessage: (record, payload) => buildGrievanceNotificationMessage(record, payload, queue.spreadsheetId),
    }, options);
}
