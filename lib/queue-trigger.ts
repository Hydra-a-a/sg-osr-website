/**
 * queue-trigger.ts
 *
 * Fire-and-forget utility to immediately kick off queue processing after a
 * notification has been enqueued. This ensures emails go out within seconds
 * instead of waiting up to 5 minutes for the GitHub Actions scheduler.
 *
 * Safety contract:
 * - Never throws or rejects; all errors are swallowed and logged.
 * - Never blocks the caller; do NOT await this function.
 * - The GitHub Actions scheduler remains the authoritative safety net.
 * - limit=10 prevents a burst of submissions from hammering the Sheets API.
 */

const TRIGGER_LIMIT = 10;
const TRIGGER_TIMEOUT_MS = 20_000;

function resolveTicketSecret(): string {
    return (
        process.env.TICKET_STATUS_SYNC_SECRET ||
        process.env.CRON_SECRET ||
        ''
    ).trim();
}

function resolveProposalSecret(): string {
    return (
        process.env.PROPOSAL_STATUS_SYNC_SECRET ||
        process.env.CRON_SECRET ||
        ''
    ).trim();
}

function resolveAppUrl(): string {
    return (
        process.env.SCHEDULER_BASE_URL ||
        process.env.URL ||
        process.env.AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        ''
    ).replace(/\/$/, '').trim();
}

function logMissingConfig(queueName: 'Ticket' | 'Proposal', secretEnvName: string): void {
    console.warn(
        `[QueueTrigger] Skipping background trigger for ${queueName.toLowerCase()} queue - missing app URL or ${secretEnvName}.`,
    );
}

function triggerQueueRequest(input: {
    queueName: 'Ticket' | 'Proposal';
    url: string;
    headers: Record<string, string>;
}): void {
    void fetch(input.url, {
        method: 'GET',
        headers: input.headers,
        signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
    })
        .then(async (res) => {
            const responseBody = (await res.text()).trim();
            if (!res.ok) {
                const suffix = responseBody ? ` - ${responseBody.slice(0, 300)}` : '';
                console.warn(
                    `[QueueTrigger] ${input.queueName} queue trigger returned HTTP ${res.status}${suffix}`,
                );
                return;
            }

            console.log(
                `[QueueTrigger] ${input.queueName} queue triggered successfully.${responseBody ? ` ${responseBody}` : ''}`,
            );
        })
        .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[QueueTrigger] ${input.queueName} queue trigger failed (non-blocking): ${message}`);
        });
}

/**
 * Starts a background HTTP call to process the ticket notification queue.
 * Must be called WITHOUT await; it is intentionally non-blocking.
 *
 * Example:
 *   await emitGrievanceSubmissionNotifications({ ... });
 *   triggerTicketQueueInBackground(); // no await
 */
export function triggerTicketQueueInBackground(): void {
    const appUrl = resolveAppUrl();
    const secret = resolveTicketSecret();

    if (!appUrl || !secret) {
        logMissingConfig('Ticket', 'TICKET_STATUS_SYNC_SECRET');
        return;
    }

    triggerQueueRequest({
        queueName: 'Ticket',
        url: `${appUrl}/api/tickets/queue/process?limit=${TRIGGER_LIMIT}`,
        headers: {
            Authorization: `Bearer ${secret}`,
            'x-ticket-sync-secret': secret,
            Accept: 'application/json',
        },
    });
}

/**
 * Starts a background HTTP call to process the proposal notification queue.
 * Must be called WITHOUT await; it is intentionally non-blocking.
 */
export function triggerProposalQueueInBackground(): void {
    const appUrl = resolveAppUrl();
    const secret = resolveProposalSecret();

    if (!appUrl || !secret) {
        logMissingConfig('Proposal', 'PROPOSAL_STATUS_SYNC_SECRET');
        return;
    }

    triggerQueueRequest({
        queueName: 'Proposal',
        url: `${appUrl}/api/proposals/queue/process?limit=${TRIGGER_LIMIT}`,
        headers: {
            Authorization: `Bearer ${secret}`,
            'x-proposal-sync-secret': secret,
            Accept: 'application/json',
        },
    });
}
