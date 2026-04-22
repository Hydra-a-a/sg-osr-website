/**
 * queue-trigger.ts
 *
 * Fire-and-forget utility to immediately kick off queue processing after a
 * notification has been enqueued. This ensures emails go out within seconds
 * instead of waiting up to 5 minutes for the GitHub Actions scheduler.
 *
 * Safety contract:
 * - Never throws or rejects — all errors are swallowed and logged.
 * - Never blocks the caller — do NOT await this function.
 * - The GitHub Actions scheduler remains the authoritative safety net.
 * - A short startup delay lets the Google Sheet append settle before we read it.
 * - limit=10 prevents a burst of submissions from hammering the Sheets API.
 */

const TRIGGER_DELAY_MS = 300; // let the append settle before we read the queue
const TRIGGER_LIMIT = 10;     // max notifications to process per trigger call

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
        process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXTAUTH_URL
        || ''
    ).replace(/\/$/, '').trim();
}

/**
 * Schedules a background HTTP call to process the ticket notification queue.
 * Must be called WITHOUT await — it is intentionally non-blocking.
 *
 * Example:
 *   await emitGrievanceSubmissionNotifications({ ... });
 *   triggerTicketQueueInBackground(); // no await
 */
export function triggerTicketQueueInBackground(): void {
    const appUrl = resolveAppUrl();
    const secret = resolveTicketSecret();

    if (!appUrl || !secret) {
        console.warn(
            '[QueueTrigger] Skipping background trigger — NEXT_PUBLIC_APP_URL or ' +
            'TICKET_STATUS_SYNC_SECRET is not configured.',
        );
        return;
    }

    const url = `${appUrl}/api/tickets/queue/process?limit=${TRIGGER_LIMIT}`;

    setTimeout(() => {
        fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'x-ticket-sync-secret': secret,
                'Accept': 'application/json',
            },
            // Tell Vercel/Node not to keep the process alive for this request
            signal: AbortSignal.timeout(15_000),
        })
            .then((res) => {
                if (!res.ok) {
                    console.warn(`[QueueTrigger] Ticket queue trigger returned HTTP ${res.status}`);
                } else {
                    console.log('[QueueTrigger] Ticket queue triggered successfully.');
                }
            })
            .catch((err: unknown) => {
                // Swallow — the scheduler is the safety net. This must never crash the caller.
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[QueueTrigger] Ticket queue trigger failed (non-blocking): ${message}`);
            });
    }, TRIGGER_DELAY_MS);
}

/**
 * Schedules a background HTTP call to process the proposal notification queue.
 * Must be called WITHOUT await — it is intentionally non-blocking.
 */
export function triggerProposalQueueInBackground(): void {
    const appUrl = resolveAppUrl();
    const secret = resolveProposalSecret();

    if (!appUrl || !secret) {
        console.warn(
            '[QueueTrigger] Skipping background trigger — NEXT_PUBLIC_APP_URL or ' +
            'PROPOSAL_STATUS_SYNC_SECRET is not configured.',
        );
        return;
    }

    const url = `${appUrl}/api/proposals/queue/process?limit=${TRIGGER_LIMIT}`;

    setTimeout(() => {
        fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'x-proposal-sync-secret': secret,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15_000),
        })
            .then((res) => {
                if (!res.ok) {
                    console.warn(`[QueueTrigger] Proposal queue trigger returned HTTP ${res.status}`);
                } else {
                    console.log('[QueueTrigger] Proposal queue triggered successfully.');
                }
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[QueueTrigger] Proposal queue trigger failed (non-blocking): ${message}`);
            });
    }, TRIGGER_DELAY_MS);
}
