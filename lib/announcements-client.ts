const DISMISSED_KEY_PREFIX = 'ann_dismissed:';
const SNOOZE_KEY_PREFIX = 'ann_snooze:';

function key(prefix: string, id: string): string {
    return `${prefix}${id}`;
}

export function isDismissed(id: string): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(key(DISMISSED_KEY_PREFIX, id)) === '1';
}

export function dismissForSession(id: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key(DISMISSED_KEY_PREFIX, id), '1');
}

export function isSnoozed(id: string): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(key(SNOOZE_KEY_PREFIX, id)) === '1';
}

export function snoozeForSession(id: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key(SNOOZE_KEY_PREFIX, id), '1');
}

export async function emitAnnouncementEvent(event: string, id: string): Promise<void> {
    try {
        await fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, id }),
        });
    } catch {
        // no-op
    }
}
