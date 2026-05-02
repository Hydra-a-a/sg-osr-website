import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import {
    enqueueNotificationRow,
    processNotificationQueue,
    type NotificationMessage,
    type NotificationQueueRecord,
    type ProcessNotificationQueueOptions,
} from '@/lib/notification-queue';
import { buildNotificationEmail, htmlQuote, safeMailto } from '@/lib/notification-templates';
import { escapeHtml } from '@/lib/security';

export type ProposalEventName =
    | 'proposal.submitted.v1'
    | 'proposal.status.changed.v1'
    | 'proposal.review.note.added.v1'
    | 'proposal.comment.added.v1';

type ProposalTemplateId =
    | 'proposal.submission.confirmation.v1'
    | 'proposal.submission.office.alert.v1'
    | 'proposal.status.changed.v1'
    | 'proposal.review.note.added.v1'
    | 'proposal.comment.reply.v1'
    | 'proposal.comment.submitter.update.v1';

type ProposalRecipientRole = 'submitter' | 'office';

export interface ProposalNotificationQueueConfig {
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

export interface ProposalSubmissionInput {
    queue: ProposalNotificationQueueConfig;
    proposalId: string;
    submitterName: string;
    submitterEmail: string;
    title: string;
    category: string;
    projectType: string;
    description: string;
    attachmentUrl: string;
    submittedAt: string;
}

export interface ProposalAdminUpdateInput {
    queue: ProposalNotificationQueueConfig;
    proposalId: string;
    submitterName: string;
    submitterEmail: string;
    title: string;
    status?: string;
    reviewNotes?: string;
    updatedAt: string;
    updatedBy: string;
}

export interface ProposalCommentInput {
    queue: ProposalNotificationQueueConfig;
    proposalId: string;
    submitterName: string;
    submitterEmail: string;
    title: string;
    commentId: string;
    authorEmail: string;
    authorName: string;
    authorRole: string;
    message: string;
    attachmentUrl?: string;
    createdAt: string;
}

const TRACKER_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://osr.rtu.edu.ph';
const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const proposalPayloadSchema = z.object({
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
    proposalId: z.string().trim().min(1),
    title: z.string().trim().optional().default(''),
});

function randomBase36(length: number): string {
    const bytes = randomBytes(length);
    let output = '';
    for (const byte of bytes) {
        output += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
    return output;
}

function generateNotificationId(): string {
    return `NPF-${randomBase36(12)}`;
}

function buildTrackingUrl(proposalId: string): string {
    const query = new URLSearchParams({ id: proposalId });
    return `${TRACKER_BASE}/services/proposals/track?${query.toString()}`;
}

function firstConfiguredEmail(...candidates: Array<string | undefined>): string {
    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim().toLowerCase();
        if (normalized) {
            return normalized;
        }
    }
    return '';
}

function isDeliverableEmail(value: string | undefined): boolean {
    return z.string().trim().email().safeParse(String(value || '').trim().toLowerCase()).success;
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

function resolveProposalRoute(eventName: ProposalEventName, authorRole?: string): RouteEnvelope {
    const normalizedAuthorRole = String(authorRole || '').trim().toUpperCase();
    const reviewMailbox = firstConfiguredEmail(
        process.env.EMAIL_PROPOSALS_REVIEW,
        process.env.NEW_PROPOSAL_NOTIFICATION_EMAILS,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );
    const observerMailbox = firstConfiguredEmail(
        process.env.EMAIL_OSR_OBSERVER,
        process.env.REGENT_EMAIL,
    );
    const sscObserverMailbox = firstConfiguredEmail(
        process.env.EMAIL_SSC_OBSERVER,
        process.env.REGENT_EMAIL,
    );
    const replyToMailbox = firstConfiguredEmail(
        process.env.EMAIL_PROPOSALS_REPLY_TO,
        process.env.REGENT_EMAIL,
        process.env.EMAIL_USER,
    );

    if (eventName === 'proposal.comment.added.v1' && normalizedAuthorRole !== 'OFFICER') {
        return {
            routeId: 'PRT-COMMENT-FROM-SUBMITTER',
            to: reviewMailbox,
            cc: sscObserverMailbox,
            replyTo: replyToMailbox,
        };
    }

    return {
        routeId: 'PRT-DEFAULT',
        to: reviewMailbox,
        cc: observerMailbox,
        replyTo: replyToMailbox,
    };
}

async function enqueueProposalEvent(input: {
    queue: ProposalNotificationQueueConfig;
    eventName: ProposalEventName;
    entityId: string;
    recipientRole: ProposalRecipientRole;
    recipientEmail: string;
    routeId: string;
    templateId: ProposalTemplateId;
    dedupeKey: string;
    payload: Record<string, unknown>;
}) {
    const notificationId = generateNotificationId();
    const payload = proposalPayloadSchema.passthrough().parse({
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
        entityType: 'proposal',
        entityId: input.entityId,
        recipientEmail: input.recipientEmail,
        routeId: input.routeId,
        templateId: input.templateId,
        payloadJson: JSON.stringify(payload),
        dedupeKey: input.dedupeKey,
    });
}

function collectQueuedNotificationId(
    sink: string[],
    result: Awaited<ReturnType<typeof enqueueProposalEvent>>,
) {
    if (result.notificationId) {
        sink.push(result.notificationId);
    }
}

export async function emitProposalSubmissionNotifications(input: ProposalSubmissionInput): Promise<string[]> {
    const notificationIds: string[] = [];
    const trackingUrl = buildTrackingUrl(input.proposalId);
    const officeRoute = resolveProposalRoute('proposal.submitted.v1');

    if (isDeliverableEmail(input.submitterEmail)) {
        collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
            queue: input.queue,
            eventName: 'proposal.submitted.v1',
            entityId: input.proposalId,
            recipientRole: 'submitter',
            recipientEmail: input.submitterEmail.trim().toLowerCase(),
            routeId: 'STU-PRIMARY',
            templateId: 'proposal.submission.confirmation.v1',
            dedupeKey: `proposal.submitted.v1:${input.proposalId}:submitter`,
            payload: {
                occurredAtIso: input.submittedAt,
                actorType: 'leader',
                actorId: input.submitterEmail.trim().toLowerCase(),
                actorRole: 'submitter',
                trackingUrl,
                proposalId: input.proposalId,
                submitterName: input.submitterName,
                title: input.title,
                category: input.category,
                projectType: input.projectType,
                description: input.description,
                attachmentUrl: input.attachmentUrl,
                submittedAt: input.submittedAt,
                cc: '',
                replyTo: '',
            },
        }));
    }

    if (officeRoute.to) {
        collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
            queue: input.queue,
            eventName: 'proposal.submitted.v1',
            entityId: input.proposalId,
            recipientRole: 'office',
            recipientEmail: officeRoute.to,
            routeId: officeRoute.routeId,
            templateId: 'proposal.submission.office.alert.v1',
            dedupeKey: `proposal.submitted.v1:${input.proposalId}:office`,
            payload: {
                occurredAtIso: input.submittedAt,
                actorType: 'leader',
                actorId: input.submitterEmail.trim().toLowerCase(),
                actorRole: 'submitter',
                trackingUrl,
                proposalId: input.proposalId,
                submitterName: input.submitterName,
                submitterEmail: input.submitterEmail.trim().toLowerCase(),
                title: input.title,
                category: input.category,
                projectType: input.projectType,
                description: input.description,
                attachmentUrl: input.attachmentUrl,
                submittedAt: input.submittedAt,
                cc: officeRoute.cc || '',
                replyTo: officeRoute.replyTo || '',
            },
        }));
    }

    return notificationIds;
}

export async function emitProposalAdminUpdateNotifications(input: ProposalAdminUpdateInput): Promise<string[]> {
    const notificationIds: string[] = [];
    const recipientEmail = input.submitterEmail.trim().toLowerCase();
    const trackingUrl = buildTrackingUrl(input.proposalId);
    const basePayload = {
        occurredAtIso: input.updatedAt,
        actorType: 'officer',
        actorId: input.updatedBy.trim().toLowerCase(),
        actorRole: 'officer',
        trackingUrl,
        proposalId: input.proposalId,
        submitterName: input.submitterName,
        title: input.title,
        cc: '',
        replyTo: '',
    };

    if (isDeliverableEmail(recipientEmail) && input.status) {
        collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
            queue: input.queue,
            eventName: 'proposal.status.changed.v1',
            entityId: input.proposalId,
            recipientRole: 'submitter',
            recipientEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'proposal.status.changed.v1',
            dedupeKey: `proposal.status.changed.v1:${input.proposalId}:${input.status}:${input.updatedAt}`,
            payload: {
                ...basePayload,
                status: input.status,
                updatedAt: input.updatedAt,
                updatedBy: input.updatedBy,
            },
        }));
    }

    if (isDeliverableEmail(recipientEmail) && input.reviewNotes && input.reviewNotes.trim()) {
        collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
            queue: input.queue,
            eventName: 'proposal.review.note.added.v1',
            entityId: input.proposalId,
            recipientRole: 'submitter',
            recipientEmail,
            routeId: 'STU-PRIMARY',
            templateId: 'proposal.review.note.added.v1',
            dedupeKey: `proposal.review.note.added.v1:${input.proposalId}:${normalizeTextHash(input.reviewNotes)}:${input.updatedAt}`,
            payload: {
                ...basePayload,
                reviewNotes: input.reviewNotes,
                updatedAt: input.updatedAt,
                updatedBy: input.updatedBy,
            },
        }));
    }

    return notificationIds;
}

export async function emitProposalCommentNotifications(input: ProposalCommentInput): Promise<string[]> {
    const notificationIds: string[] = [];
    const normalizedAuthorRole = String(input.authorRole || '').trim().toUpperCase();
    const trackingUrl = buildTrackingUrl(input.proposalId);

    if (normalizedAuthorRole === 'OFFICER' && isDeliverableEmail(input.submitterEmail)) {
        collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
            queue: input.queue,
            eventName: 'proposal.comment.added.v1',
            entityId: input.proposalId,
            recipientRole: 'submitter',
            recipientEmail: input.submitterEmail.trim().toLowerCase(),
            routeId: 'STU-PRIMARY',
            templateId: 'proposal.comment.reply.v1',
            dedupeKey: `proposal.comment.added.v1:${input.proposalId}:${input.commentId}:to_submitter`,
            payload: {
                occurredAtIso: input.createdAt,
                actorType: 'officer',
                actorId: input.authorEmail.trim().toLowerCase(),
                actorRole: 'officer',
                trackingUrl,
                proposalId: input.proposalId,
                submitterName: input.submitterName,
                title: input.title,
                authorName: input.authorName,
                authorRole: normalizedAuthorRole,
                message: input.message,
                attachmentUrl: input.attachmentUrl || '',
                createdAt: input.createdAt,
                cc: '',
                replyTo: '',
            },
        }));
    }

    if (normalizedAuthorRole !== 'OFFICER') {
        const officeRoute = resolveProposalRoute('proposal.comment.added.v1', normalizedAuthorRole);
        if (officeRoute.to) {
            collectQueuedNotificationId(notificationIds, await enqueueProposalEvent({
                queue: input.queue,
                eventName: 'proposal.comment.added.v1',
                entityId: input.proposalId,
                recipientRole: 'office',
                recipientEmail: officeRoute.to,
                routeId: officeRoute.routeId,
                templateId: 'proposal.comment.submitter.update.v1',
                dedupeKey: `proposal.comment.added.v1:${input.proposalId}:${input.commentId}:to_office`,
                payload: {
                    occurredAtIso: input.createdAt,
                    actorType: 'leader',
                    actorId: input.authorEmail.trim().toLowerCase(),
                    actorRole: normalizedAuthorRole.toLowerCase() || 'submitter',
                    trackingUrl,
                    proposalId: input.proposalId,
                    submitterName: input.submitterName,
                    submitterEmail: input.submitterEmail.trim().toLowerCase(),
                    title: input.title,
                    authorName: input.authorName,
                    authorRole: normalizedAuthorRole,
                    authorEmail: input.authorEmail.trim().toLowerCase(),
                    message: input.message,
                    attachmentUrl: input.attachmentUrl || '',
                    createdAt: input.createdAt,
                    cc: officeRoute.cc || '',
                    replyTo: officeRoute.replyTo || '',
                },
            }));
        }
    }

    return notificationIds;
}

function statusBadge(value: string): string {
    return `<span style="background:#e0f2fe;color:#075985;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">${escapeHtml(value)}</span>`;
}

function toInfoValue(value: unknown): string {
    return String(value || '').trim();
}

function buildSubject(templateId: ProposalTemplateId, payload: Record<string, unknown>): string {
    const proposalId = toInfoValue(payload.proposalId);
    const title = toInfoValue(payload.title);
    const status = toInfoValue(payload.status);

    switch (templateId) {
        case 'proposal.submission.confirmation.v1':
            return `[${proposalId}] Proposal received`;
        case 'proposal.submission.office.alert.v1':
            return `[New Proposal ${proposalId}] ${title || 'Project proposal'} submitted`;
        case 'proposal.status.changed.v1':
            return `[${proposalId}] Proposal status changed to ${status || 'Updated'}`;
        case 'proposal.review.note.added.v1':
            return `[${proposalId}] Proposal review notes updated`;
        case 'proposal.comment.reply.v1':
            return `[${proposalId}] New proposal reply`;
        case 'proposal.comment.submitter.update.v1':
            return `[${proposalId}] Submitter follow-up received`;
        default:
            return `[${proposalId}] Proposal notification`;
    }
}

function renderSubmissionConfirmation(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Proposal Received',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.submitterName) || 'Leader')}</strong>, your proposal was received and entered into the review queue.`,
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Category', value: toInfoValue(payload.category) || 'Uncategorized' },
            { label: 'Project Type', value: toInfoValue(payload.projectType) || 'Unspecified' },
            { label: 'Submitted', value: toInfoValue(payload.submittedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Executive Summary',
        bodyHtml: htmlQuote(toInfoValue(payload.description)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' },
        ],
        footerNote: 'The tracker will show future status changes, review notes, and discussion replies.',
    });
}

function renderSubmissionOfficeAlert(payload: Record<string, unknown>): string {
    const submitterEmail = toInfoValue(payload.submitterEmail);
    const emailDisplay = submitterEmail
        ? `<a href="${escapeHtml(safeMailto(submitterEmail))}" style="color:#8B1A1A;">${escapeHtml(submitterEmail)}</a>`
        : '<em style="color:#888;">No email available</em>';

    const actions = [
        { href: toInfoValue(payload.attachmentUrl), label: 'Open Proposal Document', tone: 'gold' as const },
        { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' as const },
    ].filter((action) => Boolean(action.href));

    return buildNotificationEmail({
        title: 'New Proposal Submitted',
        eyebrow: 'Office Alert',
        intro: 'A new project proposal entered the review queue.',
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Submitter', value: toInfoValue(payload.submitterName) || 'Leader' },
            { label: 'Email', value: emailDisplay, allowHtml: true },
            { label: 'Category', value: toInfoValue(payload.category) || 'Uncategorized' },
            { label: 'Project Type', value: toInfoValue(payload.projectType) || 'Unspecified' },
        ],
        bodyLabel: 'Executive Summary',
        bodyHtml: htmlQuote(toInfoValue(payload.description)),
        actions,
        footerNote: 'Routing for proposal notifications is deterministic and logged at enqueue time.',
    });
}

function renderStatusChanged(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Proposal Status Updated',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.submitterName) || 'Leader')}</strong>, the review status of your proposal changed.`,
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Status', value: statusBadge(toInfoValue(payload.status) || 'Updated'), allowHtml: true },
            { label: 'Updated By', value: toInfoValue(payload.updatedBy) || 'OSR Review Desk' },
            { label: 'Updated', value: toInfoValue(payload.updatedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' },
        ],
        footerNote: 'Use the tracker to review the full status history and discussion timeline.',
    });
}

function renderReviewNotes(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'Proposal Review Notes Updated',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.submitterName) || 'Leader')}</strong>, a reviewer updated the notes on your proposal.`,
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Updated By', value: toInfoValue(payload.updatedBy) || 'OSR Review Desk' },
            { label: 'Updated', value: toInfoValue(payload.updatedAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Review Notes',
        bodyHtml: htmlQuote(toInfoValue(payload.reviewNotes)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' },
        ],
        footerNote: 'Review notes and discussion replies can both continue through the proposal tracker.',
    });
}

function renderCommentReply(payload: Record<string, unknown>): string {
    return buildNotificationEmail({
        title: 'New Proposal Reply',
        intro: `Hi <strong>${escapeHtml(toInfoValue(payload.submitterName) || 'Leader')}</strong>, the reviewing office posted a new message on your proposal.`,
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Author', value: toInfoValue(payload.authorName) || 'OSR Reviewer' },
            { label: 'Role', value: statusBadge(toInfoValue(payload.authorRole) || 'OFFICER'), allowHtml: true },
            { label: 'Posted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Reply',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' },
        ],
        footerNote: 'Continue the thread in the tracker if you need to answer reviewer questions.',
    });
}

function renderSubmitterUpdate(payload: Record<string, unknown>): string {
    const authorEmail = toInfoValue(payload.authorEmail);
    const emailDisplay = authorEmail
        ? `<a href="${escapeHtml(safeMailto(authorEmail))}" style="color:#8B1A1A;">${escapeHtml(authorEmail)}</a>`
        : '<em style="color:#888;">No email available</em>';

    return buildNotificationEmail({
        title: 'Submitter Follow-up Received',
        eyebrow: 'Office Alert',
        intro: 'A submitter posted a new reply in the proposal discussion thread.',
        heroLabel: 'Proposal ID',
        heroValue: toInfoValue(payload.proposalId),
        infoRows: [
            { label: 'Title', value: toInfoValue(payload.title) || 'Untitled Proposal' },
            { label: 'Submitter', value: toInfoValue(payload.submitterName) || 'Leader' },
            { label: 'Author Email', value: emailDisplay, allowHtml: true },
            { label: 'Posted', value: toInfoValue(payload.createdAt) || toInfoValue(payload.occurredAtIso) },
        ],
        bodyLabel: 'Follow-up Message',
        bodyHtml: htmlQuote(toInfoValue(payload.message)),
        actions: [
            { href: toInfoValue(payload.trackingUrl), label: 'Open Proposal Tracker', tone: 'primary' },
        ],
        footerNote: 'This notification helps the review mailbox see submitter follow-ups without polling the tracker.',
    });
}

export function buildProposalNotificationMessage(record: NotificationQueueRecord, payload: Record<string, unknown>): NotificationMessage {
    const parsedPayload = proposalPayloadSchema.passthrough().parse(payload);
    const templateId = record.templateId as ProposalTemplateId;
    let html = '';

    switch (templateId) {
        case 'proposal.submission.confirmation.v1':
            html = renderSubmissionConfirmation(parsedPayload);
            break;
        case 'proposal.submission.office.alert.v1':
            html = renderSubmissionOfficeAlert(parsedPayload);
            break;
        case 'proposal.status.changed.v1':
            html = renderStatusChanged(parsedPayload);
            break;
        case 'proposal.review.note.added.v1':
            html = renderReviewNotes(parsedPayload);
            break;
        case 'proposal.comment.reply.v1':
            html = renderCommentReply(parsedPayload);
            break;
        case 'proposal.comment.submitter.update.v1':
            html = renderSubmitterUpdate(parsedPayload);
            break;
        default:
            throw new Error(`Unsupported proposal template: ${record.templateId}`);
    }

    return {
        to: record.recipientEmail,
        cc: toInfoValue(parsedPayload.cc),
        replyTo: toInfoValue(parsedPayload.replyTo),
        subject: buildSubject(templateId, parsedPayload),
        html,
    };
}

export async function processProposalNotifications(
    queue: ProposalNotificationQueueConfig,
    options: ProcessNotificationQueueOptions = {},
) {
    return processNotificationQueue({
        spreadsheetId: queue.spreadsheetId,
        queueTab: queue.queueTab,
        queueRange: queue.queueRange,
        buildMessage: (record, payload) => buildProposalNotificationMessage(record, payload),
    }, options);
}
