import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { sendEmail } from '@/lib/email';
import { logAuditAction } from '@/lib/audit';
import { redactErrorForLog } from '@/lib/security';

export type NotificationQueueStatus = 'pending' | 'retry' | 'sent' | 'skipped' | 'dead_letter';

export interface NotificationQueueRecord {
    rowNumber: number;
    notificationId: string;
    eventName: string;
    entityType: string;
    entityId: string;
    recipientEmail: string;
    routeId: string;
    templateId: string;
    payloadJson: string;
    dedupeKey: string;
    status: NotificationQueueStatus;
    attempts: number;
    createdAt: string;
    processedAt: string;
    error: string;
}

export interface NotificationEnqueueInput {
    spreadsheetId: string;
    appendRange: string;
    queueRange: string;
    eventName: string;
    entityType: string;
    entityId: string;
    recipientEmail: string;
    routeId: string;
    templateId: string;
    payloadJson: string;
    dedupeKey: string;
    notificationId: string;
    createdAt?: string;
}

export interface NotificationEnqueueResult {
    queued: boolean;
    notificationId: string;
    deduped: boolean;
}

export interface NotificationMessage {
    to: string;
    cc?: string | string[];
    replyTo?: string;
    subject: string;
    html: string;
    text?: string;
}

export interface ProcessNotificationQueueOptions {
    dryRun?: boolean;
    limit?: number;
    notificationIds?: string[];
}

export interface ProcessNotificationQueueResult {
    scanned: number;
    picked: number;
    sent: number;
    skipped: number;
    failed: number;
    deadLettered: number;
    updatedQueueRows: number;
    dryRun: boolean;
}

interface ProcessNotificationQueueConfig {
    spreadsheetId: string;
    queueTab: string;
    queueRange: string;
    buildMessage: (record: NotificationQueueRecord, payload: Record<string, unknown>) => NotificationMessage;
}

const DEDUPE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

function parseStatus(value: string): NotificationQueueStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'retry') return 'retry';
    if (normalized === 'sent') return 'sent';
    if (normalized === 'skipped') return 'skipped';
    if (normalized === 'dead_letter') return 'dead_letter';
    return 'pending';
}

export function parseNotificationQueueRow(row: string[], rowNumber: number): NotificationQueueRecord | null {
    const eventName = String(row[1] || '').trim();
    const createdAt = String(row[11] || '').trim();
    if (!eventName || !createdAt) {
        return null;
    }

    const attempts = Number.parseInt(String(row[10] || '0').trim(), 10);
    return {
        rowNumber,
        notificationId: String(row[0] || '').trim(),
        eventName,
        entityType: String(row[2] || '').trim(),
        entityId: String(row[3] || '').trim(),
        recipientEmail: String(row[4] || '').trim().toLowerCase(),
        routeId: String(row[5] || '').trim(),
        templateId: String(row[6] || '').trim(),
        payloadJson: String(row[7] || '').trim(),
        dedupeKey: String(row[8] || '').trim(),
        status: parseStatus(String(row[9] || 'pending')),
        attempts: Number.isFinite(attempts) ? attempts : 0,
        createdAt,
        processedAt: String(row[12] || '').trim(),
        error: String(row[13] || '').trim(),
    };
}

function isRecentEnough(createdAt: string, nowMs: number): boolean {
    const createdAtMs = Date.parse(createdAt);
    if (!Number.isFinite(createdAtMs)) {
        return true;
    }

    return nowMs - createdAtMs <= DEDUPE_WINDOW_MS;
}

function isDedupeStatus(status: NotificationQueueStatus): boolean {
    return status === 'pending' || status === 'retry' || status === 'sent';
}

function nextRetryDelayMs(attempts: number): number {
    const index = Math.max(0, Math.min(RETRY_BACKOFF_MS.length - 1, attempts));
    return RETRY_BACKOFF_MS[index];
}

function shouldProcessRetry(record: NotificationQueueRecord, nowMs: number): boolean {
    if (record.status === 'pending') {
        return true;
    }

    if (record.status !== 'retry') {
        return false;
    }

    const processedAtMs = Date.parse(record.processedAt || record.createdAt);
    if (!Number.isFinite(processedAtMs)) {
        return true;
    }

    return nowMs >= processedAtMs + nextRetryDelayMs(record.attempts);
}

function buildQueueRow(input: NotificationEnqueueInput): string[] {
    const createdAt = input.createdAt || new Date().toISOString();
    return [
        input.notificationId,
        input.eventName,
        input.entityType,
        input.entityId,
        input.recipientEmail,
        input.routeId,
        input.templateId,
        input.payloadJson,
        input.dedupeKey,
        'pending',
        '0',
        createdAt,
        '',
        '',
    ];
}

export async function enqueueNotificationRow(input: NotificationEnqueueInput): Promise<NotificationEnqueueResult> {
    const nowMs = Date.now();
    const existingRows = await getSheetData(input.spreadsheetId, input.queueRange);
    const duplicate = existingRows
        .map((row, index) => parseNotificationQueueRow(row, index + 2))
        .filter((row): row is NotificationQueueRecord => Boolean(row))
        .find((row) => row.dedupeKey === input.dedupeKey && isDedupeStatus(row.status) && isRecentEnough(row.createdAt, nowMs));

    if (duplicate) {
        logAuditAction('NOTIFICATION_DEDUPED', {
            notificationId: duplicate.notificationId,
            eventName: duplicate.eventName,
            entityType: duplicate.entityType,
            entityId: duplicate.entityId,
            recipientEmail: duplicate.recipientEmail,
            routeId: duplicate.routeId,
            templateId: duplicate.templateId,
            dedupeKey: duplicate.dedupeKey,
        });

        return {
            queued: false,
            notificationId: duplicate.notificationId,
            deduped: true,
        };
    }

    await appendSheetData(input.spreadsheetId, input.appendRange, [buildQueueRow(input)]);
    logAuditAction('NOTIFICATION_ENQUEUED', {
        notificationId: input.notificationId,
        eventName: input.eventName,
        entityType: input.entityType,
        entityId: input.entityId,
        recipientEmail: input.recipientEmail,
        routeId: input.routeId,
        templateId: input.templateId,
        dedupeKey: input.dedupeKey,
    });

    return {
        queued: true,
        notificationId: input.notificationId,
        deduped: false,
    };
}

export async function processNotificationQueue(
    config: ProcessNotificationQueueConfig,
    options: ProcessNotificationQueueOptions = {},
): Promise<ProcessNotificationQueueResult> {
    const dryRun = Boolean(options.dryRun);
    const limit = Math.max(1, Math.min(200, Number(options.limit || 25)));
    const targetNotificationIds = new Set(
        Array.isArray(options.notificationIds)
            ? options.notificationIds
                .map((value) => String(value || '').trim())
                .filter(Boolean)
            : [],
    );
    const queueRows = await getSheetData(config.spreadsheetId, config.queueRange);
    const parsedRows = queueRows
        .map((row, index) => parseNotificationQueueRow(row, index + 2))
        .filter((row): row is NotificationQueueRecord => Boolean(row));
    const nowMs = Date.now();
    const candidates = parsedRows
        .filter((row) => targetNotificationIds.size === 0 || targetNotificationIds.has(row.notificationId))
        .filter((row) => shouldProcessRetry(row, nowMs))
        .slice(0, limit);

    const result: ProcessNotificationQueueResult = {
        scanned: parsedRows.length,
        picked: candidates.length,
        sent: 0,
        skipped: 0,
        failed: 0,
        deadLettered: 0,
        updatedQueueRows: 0,
        dryRun,
    };

    if (candidates.length === 0) {
        return result;
    }

    const updates: Array<{ range: string; values: string[][] }> = [];

    for (const record of candidates) {
        const queueRange = `${config.queueTab}!J${record.rowNumber}:N${record.rowNumber}`;
        const processedAt = new Date().toISOString();
        const nextAttempts = record.attempts + 1;

        if (!record.recipientEmail) {
            result.skipped += 1;
            if (!dryRun) {
                updates.push({ range: queueRange, values: [['skipped', String(nextAttempts), record.createdAt, processedAt, 'No deliverable recipient']] });
            }

            logAuditAction('NOTIFICATION_SKIPPED', {
                notificationId: record.notificationId,
                eventName: record.eventName,
                entityType: record.entityType,
                entityId: record.entityId,
                recipientEmail: record.recipientEmail,
                routeId: record.routeId,
                templateId: record.templateId,
                dedupeKey: record.dedupeKey,
                attempts: nextAttempts,
                reason: 'No deliverable recipient',
            });
            continue;
        }

        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(record.payloadJson || '{}') as Record<string, unknown>;
        } catch {
            result.skipped += 1;
            if (!dryRun) {
                updates.push({ range: queueRange, values: [['skipped', String(nextAttempts), record.createdAt, processedAt, 'Invalid payload JSON']] });
            }

            logAuditAction('NOTIFICATION_SKIPPED', {
                notificationId: record.notificationId,
                eventName: record.eventName,
                entityType: record.entityType,
                entityId: record.entityId,
                recipientEmail: record.recipientEmail,
                routeId: record.routeId,
                templateId: record.templateId,
                dedupeKey: record.dedupeKey,
                attempts: nextAttempts,
                reason: 'Invalid payload JSON',
            });
            continue;
        }

        if (dryRun) {
            result.sent += 1;
            continue;
        }

        try {
            const message = config.buildMessage(record, payload);
            const sendSuccess = await sendEmail(message);

            if (sendSuccess) {
                result.sent += 1;
                updates.push({ range: queueRange, values: [['sent', String(nextAttempts), record.createdAt, processedAt, '']] });
                logAuditAction('NOTIFICATION_SENT', {
                    notificationId: record.notificationId,
                    eventName: record.eventName,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    recipientEmail: record.recipientEmail,
                    routeId: record.routeId,
                    templateId: record.templateId,
                    dedupeKey: record.dedupeKey,
                    attempts: nextAttempts,
                });
                continue;
            }

            const status = nextAttempts >= MAX_ATTEMPTS ? 'dead_letter' : 'retry';
            if (status === 'dead_letter') {
                result.deadLettered += 1;
                logAuditAction('NOTIFICATION_DEAD_LETTER', {
                    notificationId: record.notificationId,
                    eventName: record.eventName,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    recipientEmail: record.recipientEmail,
                    routeId: record.routeId,
                    templateId: record.templateId,
                    dedupeKey: record.dedupeKey,
                    attempts: nextAttempts,
                    reason: 'Email send failed',
                });
            } else {
                result.failed += 1;
                logAuditAction('NOTIFICATION_FAILED', {
                    notificationId: record.notificationId,
                    eventName: record.eventName,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    recipientEmail: record.recipientEmail,
                    routeId: record.routeId,
                    templateId: record.templateId,
                    dedupeKey: record.dedupeKey,
                    attempts: nextAttempts,
                    reason: 'Email send failed',
                });
            }

            updates.push({ range: queueRange, values: [[status, String(nextAttempts), record.createdAt, processedAt, 'Email send failed']] });
        } catch (error) {
            const status = nextAttempts >= MAX_ATTEMPTS ? 'dead_letter' : 'retry';
            const reason = error instanceof Error ? error.message : 'Notification processing failed';

            if (status === 'dead_letter') {
                result.deadLettered += 1;
                logAuditAction('NOTIFICATION_DEAD_LETTER', {
                    notificationId: record.notificationId,
                    eventName: record.eventName,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    recipientEmail: record.recipientEmail,
                    routeId: record.routeId,
                    templateId: record.templateId,
                    dedupeKey: record.dedupeKey,
                    attempts: nextAttempts,
                    reason,
                });
            } else {
                result.failed += 1;
                logAuditAction('NOTIFICATION_FAILED', {
                    notificationId: record.notificationId,
                    eventName: record.eventName,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    recipientEmail: record.recipientEmail,
                    routeId: record.routeId,
                    templateId: record.templateId,
                    dedupeKey: record.dedupeKey,
                    attempts: nextAttempts,
                    reason,
                });
            }

            console.error('[Notification Queue] Failed to process row:', redactErrorForLog(error));
            updates.push({ range: queueRange, values: [[status, String(nextAttempts), record.createdAt, processedAt, reason]] });
        }
    }

    if (!dryRun && updates.length > 0) {
        await batchUpdateSheetData(config.spreadsheetId, updates);
        result.updatedQueueRows = updates.length;
    }

    return result;
}
